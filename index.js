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

// signal
const SIGKILL = 'SIGKILL';
const SIGTERM = 'SIGTERM';

// state
const ON = 'ON';
const OFF = 'OFF';

// status
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

		this.state = OFF;
		this.status = CREATE;
		this.id = options.id;
		this.name = options.name;

		this.cluster = options.cluster || false;
		this.instances = options.cluster === true ? options.instances || CUPS : 1;

		this.workers = Array(this.instances).fill(null);

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

		// this.killTime = this.killTime === null || this.killTime === undefined ? 1000 : this.killTime;

		this.sleepTime = options.sleepTime;
		this.sleepTime = this.sleepTime === null || this.sleepTime === undefined ? [1000] : this.sleepTime;
		this.sleepTime = this.sleepTime.constructor.name !== 'Array' ? [this.sleepTime] : this.sleepTime;

		this.crashTime = options.crashTime || 60 * 1000;
		this.maxCrashCount = options.maxCrashCount || 1000;
		this.currentCrashCount = 0;

		this.json = this.toJSON;

		this.stdio = [
			'ignore',
			(this.stdout) ? Fs.openSync(this.stdout, 'a') : 'pipe',
			(this.stderr) ? Fs.openSync(this.stderr, 'a') : 'pipe'
		];

		if (this.cluster) {
			let settings = {};

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

			if (settings.stdio[settings.stdio.length-1] !== 'ipc') {
				settings.stdio.push('ipc');
			}

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

	async _createWorker (index) {

		let worker;
		let env = Object.assign({}, this.env);

		if (this.cluster && Cluster.isMaster) {
			worker = Cluster.fork(env).process;
		} else {
			worker = Cp.spawn(this.cmd, this.arg, {
				env: env,
				cwd: this.cwd,
				uid: this.uid,
				gid: this.gid,
				stdio: this.stdio
			});
		}

		if (worker.stdout) {
			worker.stdout.on('data', function (data) {
				this.emit('stdout', data.toString());
			}.bind(this));
		}

		if (worker.stderr) {
			worker.stderr.on('data', function (data) {
				this.emit('stderr', data.toString());
			}.bind(this));
		}

		worker.on('error', function (error) {
			this._error(error);
		}.bind(this));

		worker.on('exit', function (code, signal) {
			this._exit(code, signal);
		}.bind(this));

		this.workers.splice(index, 1, worker);

		return worker;
	}

	async _destoryWorker (index) {
		const worker = this.workers.splice(index, 1, null)[0];

		if (!worker) return;

		const pid = worker.pid;
		const childPids = await Pids(pid);

		const exited = function () {
			return new Promise(function (resolve) {
				worker.on('error',  resolve);
				worker.on('exit', resolve);
			});
		}

		for (let childPid of childPids) {
			await Kill(childPid, SIGKILL);
		}

		// await Kill(pid, SIGTERM);
		// await Timeout(this.killTime);
		await Kill(pid, SIGKILL);
		await exited();

		return worker;
	}

	async _createWorkers () {
		for (let i = 0, l = this.instances; i < l; i++) {
			await this._createWorker(i);
		}
	}

	async _destroyWorkers () {
		for (let i = 0, l = this.instances; i < l; i++) {
			await this._destoryWorker(i);
		}
	}

	async _restartWorkers (sleepTime) {
		this.state = OFF;

		if (sleepTime !== null && sleepTime !== undefined) {
			this._status(SLEEP);
			await Timeout(sleepTime);
		}

		await this._destroyWorkers();
		await this._createWorkers();

		this.state = ON;
	}

	async _reloadWorkers () {
		this.state = OFF;

		for (let i = 0, l = this.instances; i < l; i++) {
			await this._destoryWorker(i);
			await this._createWorker(i);
		}

		this.state = ON;
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
		} else if (this.state === OFF) {
			return;
		} else if (this.state === ON) {
			await this._crash();
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

}
