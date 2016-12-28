const Monitor = require('../monitor');

Promise.resolve().then(function (){
	return Monitor.start();
}).then(function () {
	return Monitor.start();
}).then(function () {
	console.log('Monitor: Started, Started');
}).catch(function (error) {
	throw error;
});
