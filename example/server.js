const http = require('http');

http.createServer(function (request, response) {
	console.log('Path Hit: ' + request.url);

	if (request.url === '/') {
		response.end('Home');
	} else if (request.url === '/break') {
		throw new Error('break the server');
	} else {
		response.end('Path Hit: ' + request.url);
	}
}).listen(process.env.PORT, function() {
	console.log('Server Listening On: http://localhost:' + process.env.PORT);
});

process.on('SIGTERM', function () {
	if (process.env.PREVENT_SIGTERM === 'true') {
		console.log('SIGTERM');

		setTimeout(function () {
			console.log('PREVENT_SIGTERM');
		}, 15000);
	}
});
