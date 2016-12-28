const Path = require('path');
const Revive = require(Path.join(__dirname, '../index.js'));

const monitor = Revive({
	name: 'test',

	arg: ['server.js'],
	cwd: __dirname,

	env: {
		PORT: 8000,
		PREVENT_SIGTERM: true
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

monitor.on('status', function (status) {
	console.log(status);
});

module.exports = monitor;
