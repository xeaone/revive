const Monitor = require('../monitor');

Promise.resolve().then(function (){
	return Monitor.start();
}).then(function () {
	return Monitor.restart();
}).then(function () {
	console.log('Monitor: Started, Restarted');
}).catch(function (error) {
	throw error;
});
