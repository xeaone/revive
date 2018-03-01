'use strict';

module.exports = async function (pid, signal) {
	
	if (typeof pid === 'string') {
		pid = parseInt(pid, 10);
	}

	try {
		process.kill(pid, signal);
	} catch (error) {

		if (error.code !== 'ESRCH') {
			throw error;
		}

	}

}
