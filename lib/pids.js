'use strict';

const Cp = require('child_process');

function normalizeHeader (data) {
	if (process.platform !== 'win32') {
		return data;
	} else if (data === 'Name') {
		return 'COMMAND';
	} else if (data === 'ParentProcessId') {
		return 'PPID';
	} else if (data === 'ProcessId') {
		return 'PID';
	} else if (data === 'Status') {
		return 'STAT';
	} else {
		throw new Error(`Unknown process header: ${data}`);
	}
}

module.exports = function (pid) {
	return new Promise(function (resolve, reject) {

		const spawn = process.platform === 'win32'
			? Cp.spwan('wmic.exe', ['PROCESS', 'GET', 'Name,ProcessId,ParentProcessId,Status'])
			: Cp.spawn('ps', ['-A', '-o', 'ppid,pid,stat,comm']);

		let pids = [pid];
		let data = '';
		let headers;

		spawn.stdout.on('data', function (d) {
			data += d.toString();
		});

		spawn.on('error', reject);

		spawn.on('close', function (code) {

			const rows = [];
			const lines = data.split('\n');

			for (let line of lines) {

				let columns = line.trim().split(/\s+/);

				if (!headers) {
					headers = columns;
					headers = headers.map(normalizeHeader);
				} else {

					let row = {};
					let h = headers.slice();

					while (h.length) {
						row[h.shift()] = h.length ? columns.shift() : columns.join(' ');
					}

					rows.push(row);
				}

			}

			for (let row of rows) {
				if (pids.includes(row.PPID)) {
					pids.push(row.PID);
				}
			}

			resolve(pids);

		});
	});
};
