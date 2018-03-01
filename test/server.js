const http = require('http');

const server = http.createServer(function (request, response) {
	console.log('Path Hit: ' + request.url);

	if (request.url === '/') {
		response.end('Home');
	} else if (request.url === '/break') {
		throw new Error('break the server');
	} else {
		response.end('Path Hit: ' + request.url);
	}
}).listen(process.env.PORT || 0, function() {
	console.log(`Server PID: ${process.pid}`);
	console.log(`Server Listening On: http://localhost: ${server.address().port}`);
});

process.on('SIGTERM', function () {
	if (process.env.PREVENT_SIGTERM === 'true') {
		console.log('SIGTERM');

		setTimeout(function () {
			console.log('PREVENT_SIGTERM');
		}, 15000);
	}
});
