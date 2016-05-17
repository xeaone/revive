'use strict';

const Spawn = require('child_process').spawn;
const SleepAsync = require('sleep-async')();
const TreeKill = require('tree-kill');
const Events = require('events');
const Util = require('util');
const Fs = require('fs');

const CREATED = 'created';
const STARTED = 'started';
const STOPPED = 'stopped';
const CRASHED = 'crashed';
const ERRORED = 'errored';
const STARTING = 'starting';
const STOPPING = 'stopping';
const SLEEPING = 'sleeping';
const RESTARTING = 'restarting';

const SIGKILL = 'SIGKILL';

const sleep = function (self) {
	self.status = SLEEPING;

	SleepAsync.sleep(self.sleepTime, function () {
		if (self.status === STOPPING || self.status === STOPPED) return;
		birth(self);
		return;
	});
};

const kill = function (self) {
	if (self.pid === 0) return;

	TreeKill(self.pid, SIGKILL, function () {
		self.pid = 0;
		return;
	});
};

const birth = function (self) {

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
		self._error(error);
	});

	self.child.on('exit', function (code, signal) {
		self._exited(code, signal);

		if (self.status === ERRORED) return;
		else if (self.isCrashed) self._crashed();
		else if (self.status === RESTARTING) birth(self);
		else if (self.status === STOPPING || self.status === STOPPED) self._stopped();
		else if (self.status === STARTING || self.status === STARTED || self.status === SLEEPING) sleep(self);
	});

	if (self.status === SLEEPING) self._sleeped();
	else if (self.status === STARTING) self._started();
	else if (self.status === RESTARTING) self._restarted();
};

const Monitor = function (options) {
	const self = this;

	Events.EventEmitter.call(self);

	self.status = options.status || CREATED;

	self.pid = 0;
	self.child = null;
	self.name = options.name;

	self.arg = options.arg || [];
	self.cwd = options.cwd || '.';
	self.cmd = options.cmd || process.execPath;

	self.env = options.env || {};
	self.data = options.data || {};

	self.stdout = options.stdout;
	self.stderr = options.stderr;

	self.isCrashed = false;
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

	if (self.status === STARTING || self.status === STARTED || self.status === RESTARTING || self.status === SLEEPING || self.status === STOPPING) return;

	self.status = STARTING;

	birth(self);
};

Monitor.prototype.stop = function () {
	const self = this;

	if (self.status === STOPPING || self.status === STOPPED) return;

	self.status = STOPPING;

	kill(self);
};

Monitor.prototype.restart = function () {
	const self = this;

	if (self.status === RESTARTING || self.status === SLEEPING || self.status === STOPPING) return;

	if (self.status === STOPPED || self.status === CREATED) {
		self.status = RESTARTING;
		birth(self);
		return;
	}

	if (self.status === STARTING || self.status === STARTED) {
		self.status = RESTARTING;
		kill(self);
		return;
	}
};

Monitor.prototype.toJSON = function () {
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
	self.status = STARTED;
	self.restarted = Date.now();
	self.emit('restart');
};

Monitor.prototype._sleeped = function (code, signal) {
	const self = this;

	const nowDate = Date.now();
	const paddingTime = self.paddingTime;
	const sleepTime = self.sleepTime;
	const sleepedDate = self.sleeped || nowDate;
	const lastSleepTime = nowDate - sleepedDate;
	const maxSleepTime = sleepTime + paddingTime;

	// if true resets the sleeps
	if (lastSleepTime > maxSleepTime) self.sleeps = 0;
	else self.sleeps++;

	if (self.sleeps > self.maxSleepCount) self.isCrashed = true;

	self.status = STARTED;
	self.sleeped = Date.now();
	self.emit('sleep', code, signal);
};

Monitor.prototype._error = function (error) {
	const self = this;

	self.errors++;
	self.status = ERRORED;
	self.errored = Date.now();
	self.emit('error', error);
};

Monitor.prototype._exited = function (code, signal) {
	const self = this;

	self.exits++;
	self.exited = Date.now();
	self.emit('exit', code, signal);
};

Monitor.prototype._crashed = function () {
	const self = this;

	self.crashes++;
	self.status = CRASHED;
	self.crashed = Date.now();
	self.emit('crash');
};


const monitor = function (options) {
	return new Monitor(options);
};

module.exports = monitor;
