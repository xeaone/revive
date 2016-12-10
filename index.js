const Spawn = require('child_process').spawn;
const SleepAsync = require('sleep-async')();
const TreeKill = require('tree-kill');
const Events = require('events');
const Util = require('util');
const Fs = require('fs');

const EXITED = 'exited';
const STARTED = 'started';
const STOPPED = 'stopped';
const CRASHED = 'crashed';
const ERRORED = 'errored';
const SLEEPED = 'sleeped';
const RESTARTED = 'restarted';

const SIGKILL = 'SIGKILL';

const Monitor = function (options) {
	const self = this;

	Events.EventEmitter.call(self);

	self.pid = 0;
	self.child = null;
	self.name = options.name;

	self.arg = options.arg || [];
	self.cwd = options.cwd || process.cwd();
	self.cmd = options.cmd || process.execPath;

	self.env = options.env || {};
	self.data = options.data || {};

	self.stdout = options.stdout;
	self.stderr = options.stderr;

	self.status = STOPPED;
	self.isMaxCrashes = false;
	self.sleepTime = options.sleepTime || 1000; // ms
	self.paddingTime = options.paddingTime || 5000; // ms
	self.maxSleepCount = options.maxSleepCount || 1000;

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
};

Util.inherits(Monitor, Events.EventEmitter);

Monitor.prototype.start = function () {
	const self = this;
	if (self.status === STARTED || self.status === RESTARTED) {
		return;
	} else {
		self._starting();
	}
};

Monitor.prototype.stop = function () {
	const self = this;
	if (self.status === STOPPED) {
		return;
	} else {
		self._stopping();
	}
};

Monitor.prototype.restart = function () {
	const self = this;
	if (self.status === CRASHED) {
		return;
	} else {
		self._restarting();
	}
};

Monitor.prototype.json = function () {
	const self = this;

	return {
		pid: self.pid,
		name: self.name,
		status: self.status,

		exits: self.exits,
		stops: self.stops,
		starts: self.starts,
		errors: self.errors,
		sleeps: self.sleeps,
		crashes: self.crashes,
		restarts: self.restarts,

		exited: self.exited,
		created: self.created,
		stopped: self.stopped,
		started: self.started,
		errored: self.errored,
		sleeped: self.sleeped,
		crashed: self.crashed,
		restarted: self.restarted,

		sleepTime: self.sleepTime,
		paddingTime: self.paddingTime,
		maxSleepCount: self.maxSleepCount,

		cwd: self.cwd,
		arg: self.arg,
		stdout: self.stdout,
		stderr: self.stderr,
		env: self.env,

		data: self.data
	};
};

Monitor.prototype._starting = function (callback) {
	const self = this;

	self.child = Spawn(self.cmd, self.arg, {
		cwd: self.cwd,
		env: self.env,
		stdio: [
			'ignore',
			(self.stdout) ? Fs.openSync(self.stdout, 'a') : 'pipe',
			(self.stderr) ? Fs.openSync(self.stderr, 'a') : 'pipe'
		]
	});

	self.pid = self.child.pid;

	if (self.child.stdout) {
		self.child.stdout.on('data', function (data) {
			self.emit('stdout', data.toString());
		});
	}

	if (self.child.stderr) {
		self.child.stderr.on('data', function (data) {
			self.emit('stderr', data.toString());
		});
	}

	self.child.on('error', function (error) {
		self._errored(error);
	});

	self.child.on('exit', function (code, signal) {
		if (self.status === ERRORED) {
			throw new Error('Revive: could not start process');
		} else if (signal > 128) {
			self._exited(code, signal);
		} else {
			self._crashing();
		}
	});

	self._started();

	if (callback) return callback();
};

Monitor.prototype._stopping = function (callback) {
	const self = this;

	if (self.pid === 0) {
		self._stopped();
		if (callback) return callback();
	} else {
		TreeKill(self.pid, SIGKILL, function () {
			self.pid = 0;
			self._stopped();
			if (callback) return callback();
		});
	}
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
	const lastSleepTime = nowDate - self.sleeped || nowDate;
	const maxSleepTime = self.sleepTime + self.paddingTime;

	// if true resets the sleeps
	if (lastSleepTime > maxSleepTime) self.sleeps = 0;
	else self.sleeps++;

	self._sleeped();

	SleepAsync.sleep(self.sleepTime, function () {
		if (callback) return callback();
	});
};

Monitor.prototype._crashing = function (callback) {
	const self = this;

	self._crashed();

	if (self.sleeps < self.maxSleepCount) {
		self._stopping(function () {
			self._sleeping(function () {
				self._starting(function () {
					if (callback) return callback();
				});
			});
		});
	} else {
		if (callback) return callback();
	}
};

Monitor.prototype._started = function () {
	const self = this;
	self.starts++;
	self.status = STARTED;
	self.started = Date.now();
	self.emit('start');
};

Monitor.prototype._stopped = function () {
	const self = this;
	self.stops++;
	self.status = STOPPED;
	self.stopped = Date.now();
	self.emit('stop');
};

Monitor.prototype._restarted = function () {
	const self = this;
	self.restarts++;
	self.status = RESTARTED;
	self.restarted = Date.now();
	self.emit('restart');
};

Monitor.prototype._sleeped = function () {
	const self = this;
	self.sleeps++;
	self.status = SLEEPED;
	self.sleeped = Date.now();
	self.emit('sleep');
};

Monitor.prototype._crashed = function () {
	const self = this;
	self.crashes++;
	self.status = CRASHED;
	self.crashed = Date.now();
	self.emit('crash');
};

Monitor.prototype._errored = function (error) {
	const self = this;
	self.errors++;
	self.status = ERRORED;
	self.errored = Date.now();
	self.emit('error', error);
};

Monitor.prototype._exited = function (code, signal) {
	const self = this;
	self.exits++;
	self.status = EXITED;
	self.exited = Date.now();
	self.emit('exit', code, signal);
};

module.exports = function (options) {
	return new Monitor(options);
};
