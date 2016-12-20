const Path = require('path');
const Revive = require(Path.join(__dirname, '../index.js'));

var monitor = Revive({
	name: 'test',

	arg: ['server.js'],
	cwd: __dirname,

	env: {
		PORT: 8000,
		// PREVENT_SIGTERM: false
	},

	cluster: true,
	instances: 2,

	// sleepTime: [1000],
	// crashTime: 4000,

	maxCrashCount: 2,

	stdout: __dirname + '/stdout.log',
	stderr: __dirname + '/stderr.log'
});

monitor.on('status', function (status, p1, p2, p3) {
	console.log(status);
	if (p1) console.log(p1);
	if (p2) console.log(p2);
	if (p3) console.log(p3);
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

monitor.start();

setTimeout(function () {
	monitor.stop(function () {
		setTimeout(function () {
			monitor.start();
		}, 1000);
	});
}, 1000);

// monitor.restart();
