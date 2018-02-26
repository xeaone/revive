const Monitor = require('./monitor');

Promise.resolve().then(function (){
	return Monitor.start();
}).then(function () {
	console.log('Monitor: Started');
}).catch(function (error) {
	console.error(error);
});
