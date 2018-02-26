const Pids = require('../lib/pids');

Promise.resolve().then(function () {
	return Pids(process.argv[2]);
}).then(function (pids) {
	console.log(pids);
}).catch(function (error) {
	console.error(error);
});
