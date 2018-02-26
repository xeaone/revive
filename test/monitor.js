const Revive = require('../index');

const monitor = new Revive({
	name: 'test',

	arg: ['server.js'],
	cwd: __dirname,

	env: {
		PORT: 3000,
		PREVENT_SIGTERM: false
	},

	cluster: true,
	instances: 2,

	sleepTime: 1000,
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
