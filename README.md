# Revive

Spawns a process, monitors it, and automatically revives.
Only has two dependencies!

```
npm install revive
```




## Example ##

```JavaScript
const Revive = require('revive');

const ARG = ['app.js'];
const CWD = '/home/user/code/node/app/.';

const options = {
	name: 'test',

	arg: ARG,
	cwd: CWD,
	env: { PORT: 4444 },

	stdout: '/logs/stdout.log',
	stderr: '/logs/stderr.log',

	sleepTime: 1000,
	paddingTime: 5000,
	maxSleepCount: 1000
};

const monitor = Revive(options);

monitor.on('start', function () {
	console.log(monitor.toJSON());
});

monitor.start();
```




# Options ##

* `arg: Array`            REQUIRED arguments or node script

* `cwd: String`           REQUIRED current working directory

* `cmd: String`           OPTIONAL defaults to process.execPath basically the systems node path

* `name: String`          OPTIONAL name

* `stdout: String`        OPTIONAL pipe to file path (event will still execute)

* `stderr: String`        OPTIONAL pipe to file path (event will still execute)

* `sleepTime: 1000`       DEFAULT sleep between revives (milliseconds)

* `paddingTime: 5000`     DEFAULT padding between reset of `sleeps` (milliseconds)

* `maxSleepCount: 1000`   DEFAULT revives between `sleepTime` + `paddingTime` (1000 trigger crash)

* `env: {}`               DEFAULT environment variables

* `data: {}`              DEFAULT custom object

Note: less `paddingTime` triggers more frequent crashes




## API ##

* `monitor.start()` Starts the monitor

* `monitor.stop()` Stops the monitor (kills the process if its running with SIGKILL)

* `monitor.restart()` Restarts the monitor by stopping then starting (process must be started)

* `monitor.toJSON()` Creates a stringyifiable object




## Events ##

* `monitor.on('start', callback)` Warning async so process may not be available immediately.

* `monitor.on('stop', callback)`  The process and it's tree has been fully killed.

* `monitor.on('restart', callback)` Same as starting then stopping.

* `monitor.on('error', callback)` Emitted an error passing `(data)`. Triggered on could not spawn, kill, or message fail.

* `monitor.on('stdout', callback)` Emitted an stdout passing `(data)`.

* `monitor.on('stderr', callback)` Emitted an stderr passing `(data)`.

* `monitor.on('crash', callback)` Triggered when `sleeps` equals `maxSleepCount`

* `monitor.on('exit', callback)` Exited passing `(code, signal)`. Triggered on crash, stop, sleep, and restart.




## TODO ##

* command line utility



## License ##

Copyright (c) 2016 Alexander Steven Elias All Rights Reserved


## Terms Of Use ##

### Can ###
* You can use this package as is in any project even for profit.

* You can charge others to use your project which contains the original unmodified code of this package.

* You can submit a request to modify the code. Any modification accepted are adopted as if the original author modified it.

### Cant ###
* You can't charge others to directly or exclusively use this package.

* You can't modify the code in anyway accept in accordance with the original author's permission.
