const Path = require('path');
const PromiseTimers = require('promise-timers');
const Revive = require(Path.join(__dirname, '../index.js'));

var monitor = Revive({
	name: 'test',

	arg: ['server.js'],
	cwd: __dirname,

	env: {
		PORT: 8000,
		PREVENT_SIGTERM: false
	},

	cluster: true,
	instances: 2,

	sleepTime: [3000],
	killTime: 1000,
	// crashTime: 4000,

	maxCrashCount: 2,

	stdout: __dirname + '/stdout.log',
	stderr: __dirname + '/stderr.log'

	// stdio: ['inherit', 'inherit', 'inherit', 'ipc']

});

monitor.on('status', function (status, p1, p2, p3) {
	console.log(status);
	// if (p1) console.log(p1);
	// if (p2) console.log(p2);
	// if (p3) console.log(p3);
});

// monitor.on('stdout', function (data) {
// 	console.log('stdout: ' + data);
// });

// monitor.on('stderr', function (data) {
// 	console.log('stderr: ' + data);
// });

// monitor.on('error', function (data) {
// 	console.log(monitor.json().status);
// 	console.log(data + '\n');
// });

// monitor.on('exit', function (code, signal) {
// 	console.log(monitor.json().status);
// 	console.log(code);
// 	console.log(signal + '\n');
// });


// Promise.resolve().then(function (){
// 	return monitor.start();
// }).then(function () {
// 	console.log('Monitor Started');
// });


// Promise.resolve().then(function (){
// 	return monitor.start();
// }).then(function () {
// 	return PromiseTimers.setTimeout(100);
// }).then(function () {
// 	return monitor.stop();
// }).then(function () {
// 	console.log('Monitor: Started, Stopped');
// }).catch(function (error) {
// 	throw error;
// });


Promise.resolve().then(function (){
	return monitor.start();
}).then(function () {
	console.log(monitor.pids);
}).then(function () {
	return monitor.restart();
}).then(function () {
	console.log(monitor.pids);
	console.log('Monitor Started, Restarted');
});


// Promise.resolve().then(function (){
// 	return monitor.start();
// }).then(function () {
// 	return PromiseTimers.setTimeout(100);
// }).then(function () {
// 	return monitor.stop();
// }).then(function () {
// 	return monitor.start();
// }).then(function () {
// 	console.log('Monitor: Started, Stopped, Started');
// });


// Promise.resolve().then(function (){
// 	return monitor.start();
// }).then(function () {
// 	setTimeout(function () {
// 		monitor.restart();
// 		console.log('Monitor: Started, Restarted');
// 	}, 1000);
// });
