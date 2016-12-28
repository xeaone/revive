const PromiseTimers = require('promise-timers');
const Monitor = require('../monitor');

Promise.resolve().then(function (){
	return Monitor.start();
}).then(function () {
	return Monitor.stop();
}).then(function () {
	console.log('Monitor: Started, Stopped');
}).catch(function (error) {
	throw error;
});
