// const TreeKill = require('tree-kill');
const ChildProcess = require('child_process');
const Events = require('events');
const Util = require('util');
const Fs = require('fs');
const Xtend = require('xtend');

const Cluster = require('cluster');
const CpuCount = require('os').cpus().length;

const EXITED = 'exited';
const CREATED = 'created';
const STARTED = 'started';
const STOPPED = 'stopped';
const CRASHED = 'crashed';
const ERRORED = 'errored';
const SLEEPED = 'sleeped';
const RESTARTED = 'restarted';

const Monitor = function (options) {
	const self = this;

	Events.EventEmitter.call(self);

	self.name = options.name;
	self.status = CREATED;

	self.pids = [];
	self.workers = [];

	self.cluster = options.cluster;
	self.instances = options.instances || CpuCount;

	self.gid = options.gid;
	self.uid = options.uid;

	self.arg = options.arg || [];
	self.cwd = options.cwd || process.cwd();
	self.cmd = options.cmd || process.execPath;

	self.env = options.env || {};
	self.data = options.data || {};

	self.stdout = options.stdout;
	self.stderr = options.stderr;

	self.waitTime = options.waitTime || 6 * 1000; // ms
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
	self.created = Date.now();

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

Util.inherits(Monitor, Events.EventEmitter);

Monitor.prototype.start = function () {
	const self = this;
	if (self.status !== STARTED) self._starting();
};

Monitor.prototype.stop = function () {
	const self = this;
	if (self.status !== STOPPED) self._stopping();
};

Monitor.prototype.restart = function () {
	const self = this;
	if (self.status !== RESTARTED) self._restarting();
};

Monitor.prototype.json = function () {
	const self = this;
	return {
		name: self.name,
		status: self.status,

		pids: self.pids,
		workers: self.workers,

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
		created: self.created,

		waitTime: self.waitTime,
		sleepTime: self.sleepTime,
		maxCrashCount: self.maxCrashCount,
		currentCrashCount: self.currentCrashCount,

		cwd: self.cwd,
		arg: self.arg,
		env: self.env,

		stdout: self.stdout,
		stderr: self.stderr,

		data: self.data
	};
};

Monitor.prototype._replace = function (pid, newWorker) {
	const self = this;

	self.workers.forEach(function (worker, index) {
		if (worker.process.pid === pid) {
			self.workers.splice(index, 1, newWorker);
			self.pids.splice(index, 1, newWorker.process.pid);
		}
	});
};

Monitor.prototype._worker = function () {
	const self = this;

	var worker = null;
	var env = Xtend(process.env, self.env);

	if (self.cluster) {
		worker = Cluster.fork(env);
	} else {
		worker = {
			process: ChildProcess.spawn(self.cmd, self.arg, { cwd: self.cwd, uid: self.uid, gid: self.gid, stdio: self.stdio, env: env })
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
		self._errored(error);
	});

	worker.process.on('exit', function (code, signal) {
		self._exiting(code, signal, this.pid);
	});

	return worker;
};

Monitor.prototype._starting = function (callback, pid) {
	const self = this;

	var worker = null;

	if (pid) {
		worker = self._worker();
		self._replace(pid, worker);
	} else if (self.cluster && Cluster.isMaster) {
		for (var i = 0; i < self.instances; i++) {
			worker = self._worker();
			self.workers.push(worker);
			self.pids.push(worker.process.pid);
		}
	} else {
		worker = self._worker();
		self.workers.splice(0, 1, worker);
		self.pids.splice(0, 1, worker.process.pid);
	}

	self._started();

	if (callback) return callback();
};

Monitor.prototype._stopping = function (callback) {
	const self = this;

	self._stopped();

	self.workers.forEach(function (worker) {
		if (worker.kill && worker.kill(0)) worker.kill('SIGINT');
		else if (worker.process && worker.process.kill(0)) worker.process.kill('SIGINT');
	});

	if (callback) return callback();

	// if (self.pid === 0) {
	// 	self._stopped();
	// 	if (callback) return callback();
	// } else {
	// 	TreeKill(self.pid, SIGKILL, function () {
	// 		self.pid = 0;
	// 		self._stopped();
	// 		if (callback) return callback();
	// 	});
	// }
};

Monitor.prototype._restarting = function (callback) {
	const self = this;

	self._restarted();

	self._stopping(function () {
		self._starting(function () {
			if (callback) return callback();
		});
	});
};

Monitor.prototype._sleeping = function (callback) {
	const self = this;

	const nowDate = Date.now();
	const lastSleepDate = self.sleeped || nowDate;
	const waitSleepDate = lastSleepDate + self.waitTime;
	const currentSleepTime = self.sleepTime[self.sleeps] || self.sleepTime[self.sleepTime.length-1];

	// resets sleeps zero value becuase self._sleeped adds one
	if (nowDate > waitSleepDate) self.currentCrashCount = 0;
	else self.currentCrashCount ++;

	self._sleeped();

	setTimeout(function () {
		if (callback) return callback();
	}, currentSleepTime);
};

Monitor.prototype._crashing = function (code, signal, pid) {
	const self = this;

	self._crashed();

	self._sleeping(function () {
		if (self.cluster) self._starting(null, pid);
		else self._starting();
	});
};

Monitor.prototype._exiting = function (code, signal, pid) {
	const self = this;

	if (self.status === STOPPED) return null;
	else if (self.status === ERRORED) throw new Error('Revive: could not start process');
	else if (self.currentCrashCount < self.maxCrashCount) self._crashing(code, signal, pid);
	else self._exited(code, signal);
};

Monitor.prototype._started = function () {
	const self = this;
	self.starts++;
	self.status = STARTED;
	self.started = Date.now();
	self.emit('start');
	self.emit('status', self.status);
};

Monitor.prototype._stopped = function () {
	const self = this;
	self.stops++;
	self.status = STOPPED;
	self.stopped = Date.now();
	self.emit('stop');
	self.emit('status', self.status);
};

Monitor.prototype._restarted = function () {
	const self = this;
	self.restarts++;
	self.status = RESTARTED;
	self.restarted = Date.now();
	self.emit('restart');
	self.emit('status', self.status);
};

Monitor.prototype._sleeped = function () {
	const self = this;
	self.sleeps++;
	self.status = SLEEPED;
	self.sleeped = Date.now();
	self.emit('sleep');
	self.emit('status', self.status);
};

Monitor.prototype._crashed = function () {
	const self = this;
	self.crashes++;
	self.status = CRASHED;
	self.crashed = Date.now();
	self.emit('crash');
	self.emit('status', self.status);
};

Monitor.prototype._errored = function (error) {
	const self = this;
	self.errors++;
	self.status = ERRORED;
	self.errored = Date.now();
	self.emit('error', error);
	self.emit('status', self.status, error);
};

Monitor.prototype._exited = function (code, signal) {
	const self = this;
	self.exits++;
	self.status = EXITED;
	self.exited = Date.now();
	self.emit('exit', code, signal);
	self.emit('status', self.status, code, signal);
};

module.exports = function (options) {
	return new Monitor(options);
};
