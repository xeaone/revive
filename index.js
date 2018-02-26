'use strict';

const Cp = require('child_process');
const Cluster = require('cluster');
const Events = require('events');
const Fs = require('fs');
const Os = require('os');

const Timeout = require('./lib/timeout');
const Pids = require('./lib/pids');
const Kill = require('./lib/kill');

const CUPS = Os.cpus().length;

const SIGKILL = 'SIGKILL';
const SIGTERM = 'SIGTERM';

const ON = 'ON';
const OFF = 'OFF';

const EXIT = 'EXIT';
const STOP = 'STOP';
const START = 'START';
const CRASH = 'CRASH';
const SLEEP = 'SLEEP';
const ERROR = 'ERROR';
const CREATE = 'CREATE';
const RELOAD = 'RELOAD';
const RESTART = 'RESTART';

module.exports = class Monitor extends Events {

	constructor (options) {
		super();

		this.json = toJSON;

		this.id = options.id;
		this.name = options.name;
		this.state = OFF;
		this.status = CREATE;

		this.cluster = options.cluster || false;
		this.instances = options.cluster === true ? options.instances || CUPS : 1;

		this.pids = Array(this.instances).fill(0);
		this.workers = [];

		this.stdout = options.stdout;
		this.stderr = options.stderr;

		this.gid = options.gid;
		this.uid = options.uid;
		this.cwd = options.cwd || process.cwd();
		this.cmd = options.cmd || process.execPath;
		this.env = options.env || {};
		this.data = options.data || {};

		this.arg = options.arg;
		this.arg = this.arg === null || this.arg === undefined ? [] : this.arg;
		this.arg = this.arg.constructor.name === 'String' ? [this.arg] : this.arg;

		this.createCount = 1;
		this.startCount = 0;
		this.stopCount = 0;
		this.reloadCount = 0;
		this.restartCount = 0;
		this.sleepCount = 0;
		this.crashCount = 0;
		this.errorCount = 0;
		this.exitCount = 0;

		this.createDate = Date.now();
		this.startDate = null;
		this.stopDate = null;
		this.reloadDate = null;
		this.restartDate = null;
		this.sleepDate = null;
		this.crashDate = null;
		this.errorDate = null;
		this.exitDate = null;

		this.killTime = options.killTime || 1000;

		this.sleepTime = options.sleepTime;
		this.sleepTime = this.sleepTime === null || this.sleepTime === undefined ? [1000] : this.sleepTime;
		this.sleepTime = this.sleepTime.constructor.name !== 'Array' ? [this.sleepTime] : this.sleepTime;

		this.crashTime = options.crashTime || 60 * 1000;
		this.maxCrashCount = options.maxCrashCount || 1000;
		this.currentCrashCount = 0;

		this.stdio = [
			'ignore',
			(this.stdout) ? Fs.openSync(this.stdout, 'a') : 'pipe',
			(this.stderr) ? Fs.openSync(this.stderr, 'a') : 'pipe'
		];

		if (this.cluster) {
			var settings = {};

			process.cwd(this.cwd);

			if (this.uid) {
				process.setuid(this.uid);
				settings.uid = this.uid;
			}

			if (this.gid) {
				process.setgid(this.gid);
				settings.gid = this.gid;
			}

			settings.stdio = this.stdio;
			settings.exec = this.arg[0];
			settings.args = this.arg.slice(1);

			if (settings.stdio[settings.stdio.length-1] !== 'ipc') settings.stdio.push('ipc');

			Cluster.setupMaster(settings);
		}

	}

	async start () {
		await this._createWorkers();
		this._status(START);
	};

	async stop () {
		await this._destroyWorkers();
		this._status(STOP);
	};

	async restart () {
		await this._restartWorkers();
		this._status(RESTART);
	};

	async reload () {
		await this._reloadWorkers();
		this._status(RELOAD);
	};

	toJSON () {
		return {
			id: this.id,
			name: this.name,
			state: this.state,
			status: this.status,

			cluster: this.cluster,
			instances: this.instances,

			pids: this.pids,
			// workers: this.workers,

			stdout: this.stdout,
			stderr: this.stderr,

			uid: this.uid,
			gid: this.gid,
			arg: this.arg,
			cwd: this.cwd,
			cmd: this.cmd,

			createCount: this.createCount,
			startCount: this.startCount,
			stopCount: this.stopCount,
			reloadCount: this.reloadCount,
			restartCount: this.restartCount,
			sleepCount: this.sleepCount,
			crashCount: this.crashCount,
			errorCount: this.errorCount,
			exitCount: this.exitCount,

			createDate: this.createDate,
			startDate: this.startDate,
			stopDate: this.stopDate,
			reloadDate: this.reloadDate,
			restartDate: this.restartDate,
			sleepDate: this.sleepDate,
			crashDate: this.crashDate,
			errorDate: this.errorDate,
			exitDate: this.exitDate,

			killTime: this.killTime,
			sleepTime: this.sleepTime,
			crashTime: this.crashTime,
			maxCrashCount: this.maxCrashCount,
			currentCrashCount: this.currentCrashCount,
			currentSleepTime: this.currentSleepTime,

			data: this.data,
			env: this.env
		};
	}

	async _createWorker (index) {
		const self = this;

		let worker;
		let env = Object.assign({}, process.env, self.env);

		if (self.cluster && Cluster.isMaster) {
			worker = Cluster.fork(env);
		} else {
			worker = {
				process:
					Cp.spawn(self.cmd, self.arg, {
						env: env,
						cwd: self.cwd,
						uid: self.uid,
						gid: self.gid,
						stdio: self.stdio
					})
			};
		}

		if (worker.process.stdout) {
			worker.process.stdout.on('data', function (data) {
				self.emit('stdout', data.toString());
			});
		}

		if (worker.process.stderr) {
			worker.process.stderr.on('data', function (data) {
				self.emit('stderr', data.toString());
			});
		}

		worker.process.on('error', function (error) {
			self._error(error);
		});

		worker.process.on('exit', function (code, signal) {
			self._exit(code, signal, this.pid);
		});


		// NOTE from _createWorkers
		if (typeof index === 'number') {
			self.workers.splice(index, 1, worker);
			self.pids.splice(index, 1, worker.process.pid);
		}

		return worker;
	}

	async _destoryWorker (pid) {
		const pids = await Pids(pid);

		for (let currentPid of pids) {
			await Kill(currentPid, SIGTERM);
			await Timeout(this.killTime);
			await Kill(currentPid, SIGKILL);
		}
		
	}

	async _createWorkers () {
		const self = this;

		if (self.state === OFF) {
			self.state = ON;

			await Promise.all(self.pids.map(function (pid, index) {
				return self._createWorker(index);
			}));

		}
	}

	async _destroyWorkers () {
		const self = this;

		if (self.state === ON) {
			self.state = OFF;

			await Promise.all(self.pids.map(function (pid, index) {
				return self._destoryWorker(pid, index);
			}));

		}
	}

	async _restartWorkers (sleepTime) {

		if (sleepTime !== null && sleepTime !== undefined) {
			this._status(SLEEP);
			await Timeout(sleepTime);
		}

		// this.isSleeping = false;
		await this._destroyWorkers();
		await this._createWorkers();
	}

	async _reloadWorkers () {
		if (this.state === ON) {

			for (let i = 0, l = this.pids.length; i < l; i++) {
				let pid = this.pids[i];
				await this._destoryWorker(pid);
				let worker = await this._createWorker();
				this.workers.splice(i, 1, worker);
				this.pids.splice(i, 1, worker.process.pid);
			}

		} else {
			await this._createWorkers();
		}
	}

	async _crash () {
		const nowDate = Date.now();
		const lastCrashDate = this.crashDate || nowDate;
		const delayedCrashDate = lastCrashDate + this.crashTime;

		this.currentCrashCount = nowDate > delayedCrashDate ? 0 : this.currentCrashCount+1;
		this.currentSleepTime = this.sleepTime[this.currentCrashCount] || this.sleepTime[this.currentCrashCount.length-1];
		this.isMaxCrash = this.currentCrashCount > this.maxCrashCount;
		this.state = this.isMaxCrash ? OFF : this.state;

		this._status(CRASH);
		await this._restartWorkers(this.currentSleepTime);
	};

	async _error (error) {
		this._status(ERROR, error);
		await this._destroyWorkers();
	}

	async _exit (code, signal) {
		if (this.isMaxCrash) {
			await this._destroyWorkers();
		} else if (this.state === ON) {
			await this._crash();
		} else if (this.state === OFF) {
			return null;
		} else {
			this._status(EXIT, code, signal);
		}
	}

	_status (status, code_error, signal) {

		this.status = status;
		this.emit('status', status, code_error, signal);

		if (status === START) {
			this.startCount++;
			this.startDate = Date.now();
			this.emit('start');
		} else if (status === STOP) {
			this.stopCount++;
			this.stopDate = Date.now();
			this.emit('stop');
		} else if (status === RELOAD) {
			this.reloadCount++;
			this.reloadDate = Date.now();
			this.emit('reload');
		} else if (status === RESTART) {
			this.restartCount++;
			this.restartDate = Date.now();
			this.emit('restart');
		} else if (status === SLEEP) {
			this.sleepCount++;
			this.sleepDate = Date.now();
			this.emit('sleep');
		} else if (status === CRASH) {
			this.crashCount++;
			this.crashDate = Date.now();
			this.emit('crash');
		} else if (status === ERROR) {
			this.errorCount++;
			this.errorDate = Date.now();
			this.emit('error', code_error);
		} else if (status === EXIT) {
			this.exitCount++;
			this.exitDate = Date.now();
			this.emit('exit', code_error, signal);
		}
	}

}
