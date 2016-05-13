'use strict';

const Revive = require('./index');

const ARG = ['app.js'];
const CWD = '/Users/Alex/psudo-server/www/node/test/.';

var monitor = Revive({
	name: 'test',

	arg: ARG,
	cwd: CWD,
	env: { PORT: 4444 },

	sleepTime: 3000,
	maxSleepCount: 5,
	paddingTime: 5000,

	stdout: __dirname + '/stdout.log',
	stderr: __dirname + '/stderr.log'
});

monitor.on('start', function () {
	console.log(monitor.toJSON().status + '\n');
});

monitor.on('stop', function () {
	console.log(monitor.toJSON().status + '\n');
});

monitor.on('restart', function () {
	console.log(monitor.toJSON().status + '\n');
});

monitor.on('error', function (data) {
	console.log(monitor.toJSON().status);
	console.log(data + '\n');
});

monitor.on('crash', function () {
	console.log(monitor.toJSON().status + '\n');
});

monitor.on('stdout', function (data) {
	console.log('stdout: ' + data);
});

monitor.on('stderr', function (data) {
	console.log('stderr: ' + data);
});

monitor.on('exit', function (code, signal) {
	console.log(monitor.toJSON().status);
	console.log(code);
	console.log(signal + '\n');
});

monitor.start();


// setTimeout(function () {
// 	monitor.restart();
// }, 5000);
