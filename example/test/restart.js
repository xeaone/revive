const Monitor = require('../monitor');

Promise.resolve().then(function (){
	return Monitor.restart();
}).then(function () {
	console.log('Monitor: Restarted');
}).catch(function (error) {
	throw error;
});
