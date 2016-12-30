const PsTree = require('ps-tree');

module.exports = function (pid) {
	return new Promise(function (resolve) {
		PsTree(pid, function (error, pids) {

			pids = (pids || []).map(function (item) {
				return item.PID;
			});

			pids.push(pid);

			return resolve(pids);
		});
	});
};
