const Path = require('path');
const Revive = require('../index');

var monitor = Revive({
	name: 'test',

	arg: ['server.js'],
	cwd: Path.join(process.cwd(), 'example'),

	env: { PORT: 8000 },

	sleepTime: 1000,
	maxSleepCount: 3,
	paddingTime: 1000,

	stdout: __dirname + '/stdout.log',
	stderr: __dirname + '/stderr.log'
});

monitor.on('start', function () {
	console.log(monitor.json().status + '\n');
});

monitor.on('stop', function () {
	console.log(monitor.json().status + '\n');
});

monitor.on('restart', function () {
	console.log(monitor.json().status + '\n');
});

monitor.on('crash', function () {
	console.log(monitor.json().status + '\n');
});

monitor.on('error', function (data) {
	console.log(monitor.json().status);
	console.log(data + '\n');
});

monitor.on('stdout', function (data) {
	console.log('stdout: ' + data);
});

monitor.on('stderr', function (data) {
	console.log('stderr: ' + data);
});

monitor.on('exit', function (code, signal) {
	// console.log('exit');
	console.log(monitor.json().status);
	console.log(code);
	console.log(signal + '\n');
});

monitor.start();
// monitor.stop();
// monitor.restart();

setTimeout(function () {
	// monitor.start();
	// monitor.stop();
	// monitor.restart();
}, 5000);
