const Monitor = require('../monitor');

Promise.resolve().then(function (){
	return Monitor.start();
}).then(function () {
	return Monitor.reload();
}).then(function () {
	console.log('Monitor: Started, Reloaded');
}).catch(function (error) {
	throw error;
});
