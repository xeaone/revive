const PsTree = require('ps-tree');

const ChildProcess = require('child_process');
// const TreeKill = require('tree-kill');
const Events = require('events');
const Os = require('os');
const Fs = require('fs');

const Cluster = require('cluster');
const CpuCount = require('os').cpus().length;

const ON = 'on';
const OFF = 'off';
const EXITED = 'exited';
const STARTED = 'started';
const STARTING = 'starting';
const STOPPED = 'stopped';
const STOPPING = 'stopping';
const CRASHED = 'crashed';
const CRASHING = 'crashing';
const ERRORED = 'errored';
// const ERRORING = 'erroring';
const SLEEPED = 'sleeped';
const SLEEPING = 'sleeping';
const RESTARTED = 'restarted';
const RESTARTING = 'restarting';

const SIGKILL = 'SIGKILL';
const SIGTERM = 'SIGTERM';

function kill (pid, signal, callback) {
	if (Os.platform() === 'win32') {
		ChildProcess.exec('taskkill /pid ' + pid + ' /T /F');
		if (callback) callback();
	} else {
		PsTree(pid, function (error, pids) {
			pids = (pids || []).map(function (item) {
				return item.PID;
			});

			pids.push(pid);

			pids.forEach(function (pid) {
				try { process.kill(pid, signal); }
				catch (e) {/*ignore*/}
			});

			if (callback) callback();
		});
	}
}

const Monitor = function (options) {
	const self = this;

	Events.EventEmitter.call(self);

	self.state = OFF;
	self.status = null;
	self.name = options.name;

	self.pids = [];
	self.workers = [];

	self.cluster = options.cluster || false;
	self.instances = options.cluster === true ? options.instances || CpuCount : 1;

	self.gid = options.gid;
	self.uid = options.uid;
	self.arg = options.arg || [];
	self.cwd = options.cwd || process.cwd();
	self.cmd = options.cmd || process.execPath;

	self.env = options.env || {};
	self.data = options.data || {};

	self.stdout = options.stdout;
	self.stderr = options.stderr;

	self.crashTime = options.crashTime || 6 * 1000; // ms
	self.sleepTime = options.sleepTime || 1000; // ms
	self.maxCrashCount = options.maxCrashCount || 1000;
	self.currentCrashCount = 0;

	self.exits = 0;
	self.stops = 0;
	self.starts = 0;
	self.errors = 0;
	self.sleeps = 0;
	self.crashes = 0;
	self.restarts = 0;

	self.exited = null;
	self.stopped = null;
	self.started = null;
	self.errored = null;
	self.sleeped = null;
	self.crashed = null;
	self.restarted = null;

	self.stdio = [
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

		settings.stdio.push('ipc');

		Cluster.setupMaster(settings);
	}
};

Monitor.prototype = Object.create(Events.EventEmitter.prototype);
Monitor.prototype.constructor = Monitor;

Monitor.prototype.start = function (callback) {
	const self = this;
	if (self.status !== STARTED && self.status !== STARTING) self._start(true, callback);
	else if (callback) return callback();
};

Monitor.prototype.stop = function (callback) {
	const self = this;
	if (self.status !== STOPPED && self.status !== STOPPING) self._stop(true, callback);
	else if (callback) return callback();
};

Monitor.prototype.restart = function (callback) {
	const self = this;
	if (self.status !== RESTARTED && self.status !== RESTARTING) self._restart(true, callback);
	else if (callback) return callback();
};

Monitor.prototype.json = function () {
	const self = this;
	return {
		name: self.name,
		state: self.state,
		status: self.status,

		pids: self.pids,

		cluster: self.cluster,
		instances: self.instances,

		uid: self.uid,
		gid: self.gid,

		exits: self.exits,
		stops: self.stops,
		starts: self.starts,
		errors: self.errors,
		sleeps: self.sleeps,
		crashes: self.crashes,
		restarts: self.restarts,

		exited: self.exited,
		stopped: self.stopped,
		started: self.started,
		errored: self.errored,
		sleeped: self.sleeped,
		crashed: self.crashed,
		restarted: self.restarted,

		crashTime: self.crashTime,
		sleepTime: self.sleepTime,
		maxCrashCount: self.maxCrashCount,
		currentCrashCount: self.currentCrashCount,

		stdout: self.stdout,
		stderr: self.stderr,

		cwd: self.cwd,
		arg: self.arg,
		env: self.env,
		data: self.data
	};
};

Monitor.prototype._createWorker = function () {
	const self = this;

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
					cwd: self.cwd,
					uid: self.uid,
					gid: self.gid,
					stdio: self.stdio,
					env: env
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
};

/*
	actions
*/

Monitor.prototype._start = function (emit, callback) {
	const self = this;
	if (emit) self._emit(STARTING);

	var i = null;
	var worker = null;

	for (i = 0; i < self.instances; i++) {
		worker = self._createWorker();
		self.workers.splice(i, 1, worker);
		self.pids.splice(i, 1, worker.process.pid);
	}

	if (emit) self._emit(STARTED);
	if (callback) return callback();
};

Monitor.prototype._stop = function (emit, callback) {
	const self = this;
	if (emit) self._emit(STOPPING);

	var killCount = 0;
	var killTimeouts = [];

	self.workers.forEach(function (worker, index) {
		worker.process.on('exit', function () {
			killCount++;

			clearTimeout(killTimeouts[index]);

			if (killCount >= self.instances) {
				if (emit) self._emit(STOPPED);
				if (callback) return callback();
			}

			this.removeAllListeners('exit');
		});

		kill(worker.process.pid, SIGTERM, function () {
			killTimeouts.push(setTimeout(function () {
				kill(worker.process.pid, SIGKILL);
			}, 10000));
		});
	});
};

Monitor.prototype._restart = function (emit, callback) {
	const self = this;
	if (emit) self._emit(RESTARTING);

	self._stop(false, function () {
		self._start(false, function () {
			if (emit) self._emit(RESTARTED);
			if (callback) return callback();
		});
	});
};

Monitor.prototype._sleep = function (callback) {
	const self = this;
	self._emit(SLEEPING);

	const nowDate = Date.now();
	const lastSleepDate = self.sleeped || nowDate;
	const waitSleepDate = lastSleepDate + self.crashTime;
	const currentSleepTime = self.sleepTime[self.sleeps] || self.sleepTime[self.sleepTime.length-1];

	// resets sleeps zero value becuase adds one
	if (nowDate > waitSleepDate) self.currentCrashCount = 0;
	else self.currentCrashCount ++;

	setTimeout(function () {
		self._emit(SLEEPED);
		if (callback) return callback();
	}, currentSleepTime);
};

Monitor.prototype._crash = function (pid) {
	const self = this;
	self._emit(CRASHING);

	self._sleep(function () {
		self.workers.forEach(function (worker, index) {
			if (worker.process.pid === pid) {
				worker = self._createWorker();
				self.workers.splice(index, 1, worker);
				self.pids.splice(index, 1, worker.process.pid);
			}
		});
		self._emit(CRASHED);
	});
};

Monitor.prototype._error = function (error) {
	const self = this;
	self._emit(ERRORED, error);
};

Monitor.prototype._exit = function (code, signal, pid) {
	const self = this;

	if (self.status === STOPPED || self.status === STOPPING) return null;
	// else if (self.status === ERRORED) throw new Error('Revive: could not start process');
	else if (self.currentCrashCount < self.maxCrashCount) self._crash(pid);
	else self._emit(EXITED, code, signal);
};

/*
	emits
*/

Monitor.prototype._emit = function (status) {
	const self = this;

	self.status = status;

	self.emit(status);
	self.emit('status', status, arguments[1], arguments[2]);

	if (status === STARTED) {
		self.starts++;
		self.started = Date.now();
		self.state = ON;
	} else if (status === STOPPED) {
		self.stops++;
		self.stopped = Date.now();
		self.state = OFF;
	} if (status === RESTARTED) {
		self.restarts++;
		self.restarted = Date.now();
		self.state = ON;
	} if (status === SLEEPED) {
		self.sleeps++;
		self.sleeped = Date.now();
		self.state = OFF;
	} if (status === CRASHED) {
		self.crahses++;
		self.crashed = Date.now();
		self.state = OFF;
	} if (status === ERRORED) {
		self.errors++;
		self.errored = Date.now();
		self.state = OFF;
	} if (status === EXITED) {
		self.exits++;
		self.exited = Date.now();
		self.state = OFF;
	}
};

module.exports = function (options) {
	return new Monitor(options);
};
