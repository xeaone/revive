const PsTreePromise = require('./lib/ps-tree-promise');
const PromiseTool = require('promise-tool');
const CpuCount = require('os').cpus().length;
const ChildProcess = require('child_process');
const Cluster = require('cluster');
const Events = require('events');
const Fs = require('fs');
const Os = require('os');

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

const Monitor = function (options) {
	const self = this;

	Events.EventEmitter.call(self);

	self.name = options.name;
	self.state = OFF;
	self.status = CREATE;

	self.cluster = options.cluster || false;
	self.instances = options.cluster === true ? options.instances || CpuCount : 1;

	self.pids = Array(self.instances).fill(0);
	self.workers = [];

	self.stdout = options.stdout;
	self.stderr = options.stderr;

	self.gid = options.gid;
	self.uid = options.uid;
	self.arg = options.arg || [];
	self.cwd = options.cwd || process.cwd();
	self.cmd = options.cmd || process.execPath;
	self.env = options.env || {};
	self.data = options.data || {};

	self.createCount = 1;
	self.startCount = 0;
	self.stopCount = 0;
	self.reloadCount = 0;
	self.restartCount = 0;
	self.sleepCount = 0;
	self.crashCount = 0;
	self.errorCount = 0;
	self.exitCount = 0;

	self.createDate = Date.now();
	self.startDate = null;
	self.stopDate = null;
	self.reloadDate = null;
	self.restartDate = null;
	self.sleepDate = null;
	self.crashDate = null;
	self.errorDate = null;
	self.exitDate = null;

	self.killTime = options.killTime || 1000;
	self.sleepTime = options.sleepTime || 1000;
	self.crashTime = options.crashTime || 60 * 1000;
	self.maxCrashCount = options.maxCrashCount || 1000;
	self.currentCrashCount = 0;

	self.stdio = options.stdio || [
		'ignore',
		(self.stdout) ? Fs.openSync(self.stdout, 'a') : 'pipe',
		(self.stderr) ? Fs.openSync(self.stderr, 'a') : 'pipe'
	];

	if (self.cluster) {
		var settings = {};

		process.cwd(self.cwd);

		if (self.uid) {
			process.setuid(self.uid);
			settings.uid = self.uid;
		}

		if (self.gid) {
			process.setgid(self.gid);
			settings.gid = self.gid;
		}

		settings.stdio = self.stdio;
		settings.exec = self.arg[0];
		settings.args = self.arg.slice(1);

		if (settings.stdio[settings.stdio.length-1] !== 'ipc') settings.stdio.push('ipc');

		Cluster.setupMaster(settings);
	}
};

Monitor.prototype = Object.create(Events.EventEmitter.prototype);
Monitor.prototype.constructor = Monitor;

Monitor.prototype.start = function (callback) {
	const self = this;

	return Promise.resolve().then(function () {
		return self._createWorkers();
	}).then(function () {
		self._status(START);
	}).then(function () {
		if (callback) return callback();
	}).catch(function (error) {
		throw error;
	});
};

Monitor.prototype.stop = function (callback) {
	const self = this;

	return Promise.resolve().then(function () {
		return self._destroyWorkers();
	}).then(function () {
		self._status(STOP);
	}).then(function () {
		if (callback) return callback();
	}).catch(function (error) {
		throw error;
	});
};

Monitor.prototype.restart = function (callback) {
	const self = this;

	return Promise.resolve().then(function () {
		return self._restartWorkers();
	}).then(function () {
		self._status(RESTART);
		if (callback) return callback();
	}).catch(function (error) {
		throw error;
	});
};

Monitor.prototype.reload = function (callback) {
	const self = this;

	return Promise.resolve().then(function () {
		return self._reloadWorkers();
	}).then(function () {
		self._status(RELOAD);
		if (callback) return callback();
	}).catch(function (error) {
		throw error;
	});
};

Monitor.prototype.json = function () {
	const self = this;
	return {
		name: self.name,
		state: self.state,
		status: self.status,

		cluster: self.cluster,
		instances: self.instances,

		pids: self.pids,
		// workers: self.workers,

		stdout: self.stdout,
		stderr: self.stderr,

		uid: self.uid,
		gid: self.gid,
		arg: self.arg,
		cwd: self.cwd,
		cmd: self.cmd,

		createCount: self.createCount,
		startCount: self.startCount,
		stopCount: self.stopCount,
		reloadCount: self.reloadCount,
		restartCount: self.restartCount,
		sleepCount: self.sleepCount,
		crashCount: self.crashCount,
		errorCount: self.errorCount,
		exitCount: self.exitCount,

		createDate: self.createDate,
		startDate: self.startDate,
		stopDate: self.stopDate,
		reloadDate: self.reloadDate,
		restartDate: self.restartDate,
		sleepDate: self.sleepDate,
		crashDate: self.crashDate,
		errorDate: self.errorDate,
		exitDate: self.exitDate,

		killTime: self.killTime,
		sleepTime: self.sleepTime,
		crashTime: self.crashTime,
		maxCrashCount: self.maxCrashCount,
		currentCrashCount: self.currentCrashCount,

		data: self.data,
		env: self.env
	};
};

Monitor.prototype._createWorker = function () {
	const self = this;

	return Promise.resolve().then(function () {
		var env = {};
		var worker = null;

		env = Object.assign(env, process.env);
		env = Object.assign(env, self.env);

		if (self.cluster && Cluster.isMaster) {
			worker = Cluster.fork(env);
		} else {
			worker = {
				process:
					ChildProcess.spawn(self.cmd, self.arg, {
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

		return worker;
	});
};

Monitor.prototype._destoryWorker = function (pid) {
	const self = this;

	if (Os.platform() === 'win32') {
		return Promise.resolve().then(function () {
			ChildProcess.exec('taskkill /pid ' + pid + ' /T /F');
		});
	} else {
		return PsTreePromise(pid).then(function (pids) {
			return Promise.all(pids.map(function (currentPid) {
				try { process.kill(currentPid, SIGTERM); }
				catch (e) {/*ignore*/}

				return PromiseTool.setTimeout(self.killTime).then(function () {
					try { process.kill(currentPid, SIGKILL); }
					catch (e) {/*ignore*/}
				});
			}));
		});
	}
};

Monitor.prototype._createWorkers = function () {
	const self = this;

	if (self.state === OFF) {
		self.state = ON;

		return Promise.all(self.pids.map(function (pid, index) {
			return self._createWorker().then(function (worker) {
				self.workers.splice(index, 1, worker);
				self.pids.splice(index, 1, worker.process.pid);
			});
		}));
	} else {
		return Promise.resolve();
	}
};

Monitor.prototype._destroyWorkers = function () {
	const self = this;

	if (self.state === ON) {
		self.state = OFF;

		return Promise.all(self.pids.map(function (pid) {
			return self._destoryWorker(pid);
		}));
	} else {
		return Promise.resolve();
	}
};

Monitor.prototype._restartWorkers = function (sleepTime) {
	const self = this;

	return Promise.resolve().then(function () {
		if (!sleepTime) return null;
		self._status(SLEEP);
		return PromiseTool.setTimeout(sleepTime);
	}).then(function () {
		// self.isSleeping = false;
		return self._destroyWorkers();
	}).then(function () {
		return self._createWorkers();
	});
};

Monitor.prototype._reloadWorkers = function () {
	const self = this;

	if (self.state === ON) {
		return PromiseTool.series(self.pids.map(function (pid, index) {
			return function () {
				return Promise.resolve().then(function () {
					return self._destoryWorker(pid);
				}).then(function () {
					return self._createWorker();
				}).then(function (worker) {
					self.workers.splice(index, 1, worker);
					self.pids.splice(index, 1, worker.process.pid);
				});
			};
		}));
	} else {
		return Promise.resolve().then(function () {
			return self._createWorkers();
		});
	}
};

Monitor.prototype._crash = function () {
	const self = this;

	const nowDate = Date.now();
	const lastCrashDate = self.crashDate || nowDate;
	const delayedCrashDate = lastCrashDate + self.crashTime;

	self.currentCrashCount = nowDate > delayedCrashDate ? 0 : self.currentCrashCount+1;
	self.currentSleepTime = self.sleepTime[self.currentCrashCount] || self.sleepTime[self.currentCrashCount.length-1];
	self.isMaxCrash = self.currentCrashCount > self.maxCrashCount;
	self.state = self.isMaxCrash ? OFF : self.state;

	self._status(CRASH);
	self._restartWorkers(self.currentSleepTime);
};

Monitor.prototype._error = function (error) {
	const self = this;
	self._status(ERROR, error);
	self._destroyWorkers();
};

Monitor.prototype._exit = function (code, signal) {
	const self = this;

	if (self.isMaxCrash) self._destroyWorkers();
	else if (self.state === ON) self._crash();
	else if (self.state === OFF) return null;
	else self._status(EXIT, code, signal);
};

Monitor.prototype._status = function (status, code_error, signal) {
	const self = this;

	self.status = status;
	self.emit('status', status, code_error, signal);

	if (status === START) {
		self.startCount++;
		self.startDate = Date.now();
		self.emit('start');
	} else if (status === STOP) {
		self.stopCount++;
		self.stopDate = Date.now();
		self.emit('stop');
	} else if (status === RELOAD) {
		self.reloadCount++;
		self.reloadDate = Date.now();
		self.emit('reload');
	} else if (status === RESTART) {
		self.restartCount++;
		self.restartDate = Date.now();
		self.emit('restart');
	} else if (status === SLEEP) {
		self.sleepCount++;
		self.sleepDate = Date.now();
		self.emit('sleep');
	} else if (status === CRASH) {
		self.crashCount++;
		self.crashDate = Date.now();
		self.emit('crash');
	} else if (status === ERROR) {
		self.errorCount++;
		self.errorDate = Date.now();
		self.emit('error', code_error);
	} else if (status === EXIT) {
		self.exitCount++;
		self.exitDate = Date.now();
		self.emit('exit', code_error, signal);
	}
};

module.exports = function (options) {
	return new Monitor(options);
};
