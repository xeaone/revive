**Process Management Tool | Auto Restarts | Advanced Events | And More**
**Warning 1.1.1 Breaking API Changes**

# Revive
A process management tool. Events, status, cluster, and automatic restarts.

```
npm install revive
```


## Example ##

```JavaScript
const Revive = require('revive');

const options = {
	name: 'test',

	cmd: process.execPath,

	arg: ['app.js'],
	env: { PORT: 8000 },
	cwd: '/home/user/code/node/app/.',

	cluster: true,
	instances: 2,

	stdout: '/logs/stdout.log',
	stderr: '/logs/stderr.log',

	sleepTime: 1000,
	waitTime: 6 * 1000,
	maxCrashCount: 1000
};

const monitor = Revive(options);

monitor.on('start', function () {
	console.log(monitor.toJSON());
});

monitor.start();
```


# Options ##
* `name: String`          Defaults to `null` the name of the process.

* `arg: Array`            Defaults to `null` arguments or node script.

* `cwd: String`           Defaults to `process.cwd()` the current working directory.

* `cmd: String`           Defaults to `process.execPath` the systems absolute executable/node path.

* `cluster: Boolean`      Defaults to `false`.

* `instances: Number`  Defaults to `Os.cpus().length`

* `stdout: String`        Defaults to `'pipe'` otherwise a file path. If a path is provided than this event will not fire.

* `stderr: String`        Defaults to `'pipe'` otherwise a file path. If a path is provided than this event will not fire.

* `sleepTime:Array`       Defaults to `[1000]` in milliseconds to sleep between starts after a crash. The values must be greater than the `waitTime`.

* `waitTime: Number`      Defaults to `6 * 1000` in milliseconds or one minute. The wait time between `sleeps`/`crashes` that will count towards the `maxCrashCount`

* `maxCrashCount: Number` Defaults to `1000` crashes. A crash is triggered and the process exited at `nth + 1`.

* `env: {}`               Environment variables for the process.

* `data: {}`              A custom object for you.


## API ##
* `monitor.start()` Starts the monitor

* `monitor.stop()` Stops the monitor (kills the process if its running with SIGKILL).

* `monitor.restart()` Restarts the monitor by stopping then starting (process must be started).

* `monitor.json()` Creates a stringyifiable object. The object returns help stats and data about the process. When using clusters it is important to keep in mind that much of the data will be multiplied by the number of `instances`,



## Events ##
* `monitor.on('start', callback)` Warning async so process may not be available immediately.

* `monitor.on('stop', callback)`  The process and it's tree has been fully killed.

* `monitor.on('restart', callback)` Same as stopping then starting or vice versa.

* `monitor.on('error', callback)` Emitted an error passing `(data)`. Triggered on could not spawn, kill, or message fail.

* `monitor.on('stdout', callback)` Emitted an stdout passing `(data)` (Only available if no `Options.stdout` is `pipe`).

* `monitor.on('stderr', callback)` Emitted an stderr passing `(data)` (Only available if no `Options.stderr` is `pipe`).

* `monitor.on('sleep', callback)` Triggered when process crashes and enters sleep.

* `monitor.on('crash', callback)` Triggered when the process crashes.

* `monitor.on('exit', callback)` Exited passing `(code, signal)`.


## License ##

Licensed Under MPL 2.0

Copyright (c) 2016 [Alexander Elias](https://github.com/AlexanderElias/)
