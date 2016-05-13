'use strict';

const Exec = require('child_process').exec;
const Spawn = require('child_process').spawn;
const SleepAsync = require('sleep-async')();
const PsTree = require('ps-tree');
const Events = require('events');
const Util = require('util');
const Os = require('os');
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

const WINDOWS = 'win32';
const SIGKILL = 'SIGKILL';
const PLATFORM = Os.platform();

const sleep = function (self) {
	self.status = SLEEPING;

	SleepAsync.sleep(self.sleepTime, function () {
		if (self.status === STOPPING || self.status === STOPPED) return;
		birth(self);
	});
};

const kill = function (self, callback) {
	var pid = self.pid;
	var last = null;

	if (pid === 0) return;
	if (PLATFORM === WINDOWS) { Exec('taskkill /pid ' + pid + ' /T /F'); return; }

	PsTree(pid, function (_, pids) {
		pids = (pids || []).map(function (item) {
			return parseInt(item.PID, 10);
		});

		pids.push(pid);
		last = pids.length - 1;

		pids.forEach(function (pid, index) {
			try { process.kill(pid, SIGKILL); }
			catch (e) { /* ignore */ }

			if (index === last && callback) return callback();
		});
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
		// if (self.stdout) self.child.stdout.pipe(Fs.createWriteStream(self.stdout));

		self.child.stdout.on('data', function (data) {
			self.emit('stdout', data.toString());
		});
	}

	if (self.child.stderr) {
		// if (self.stderr) self.child.stderr.pipe(Fs.createWriteStream(self.stderr));

		self.child.stderr.on('data', function (data) {
			self.emit('stderr', data.toString());
		});
	}

	self.child.on('error', function (error) {
		self._error(error);
	});

	self.child.on('exit', function (code, signal) {
		self._exited(code, signal);

		if (self.sleeps > self.maxSleepCount) self._crashed();

		else if (self.status === RESTARTING) birth(self);

		else if (self.status === STARTING || self.status === STARTED) sleep(self);

		else if (self.status === STOPPING || self.status === STOPPED) self._stopped();
	});

	if (self.status === SLEEPING) self._sleeped();
	if (self.status === STARTING) self._started();
	if (self.status === RESTARTING) self._restarted();
};

const Monitor = function (options) {
	const self = this;

	Events.EventEmitter.call(self);

	self.status = CREATED;

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

	self.sleepTime = options.sleepTime || 1000; // milliseconds
	self.paddingTime = options.paddingTime || 5000; // milliseconds
	self.maxSleepCount = options.maxSleepCount || 1000; // count

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

	if (self.status === STARTING || self.status === STARTED || self.status === RESTARTING || self.status === SLEEPING) return;

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

	if (self.status === RESTARTING || self.status === SLEEPING) return;

	self.status = RESTARTING;

	kill(self);
};

Monitor.prototype.toJSON = function () {
	const self = this;

	return {
		pid: self.pid,
		name: self.name,
		status: self.status,

		exited: self.exited,
		created: self.created,
		stopped: self.stopped,
		started: self.started,
		errored: self.errored,
		sleeped: self.sleeped,
		crashed: self.crashed,
		restarted: self.restarted,

		exits: self.exits,
		stops: self.stops,
		starts: self.starts,
		errors: self.errors,
		sleeps: self.sleeps,
		crashes: self.crashes,
		restarts: self.restarts,

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

	// resets the sleeps
	const nowDate = Date.now();
	const paddingTime = self.paddingTime;
	const sleepTime = self.sleepTime;
	const sleepedDate = self.sleeped || nowDate;
	const lastSleepTime = nowDate - sleepedDate;
	const maxSleepTime = sleepTime + paddingTime;
	if (lastSleepTime > maxSleepTime) self.sleeps = 0;
	else self.sleeps++;

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
