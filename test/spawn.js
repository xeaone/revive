const Cp = require('child_process');
const Path = require('path');

const path = Path.join(__dirname, 'server.js');
const childOne = Cp.spawn('node', [path]);
const childTwo = Cp.spawn('node', [path]);

console.log(process.pid);

childOne.on('error', function (error) {
	console.error(error);
});

childOne.stdout.on('data', function (data) {
	console.log(data.toString());
});

childTwo.on('error', function (error) {
	console.error(error);
});

childTwo.stdout.on('data', function (data) {
	console.log(data.toString());
});
