const Monitor = require('../monitor');

Promise.resolve().then(function (){
	return Monitor.start();
}).then(function () {
	return Monitor.stop();
}).then(function () {
	return Monitor.start();
}).then(function () {
	console.log('Monitor: Started, Stopped, Started');
}).catch(function (error) {
	throw error;
});
