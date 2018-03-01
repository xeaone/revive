
# Revive
A process management tool. Events, status, cluster, and automatic restarts.

## Install
```
npm install revive --save
```

## Example
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
	crashTime: 6 * 1000,
	maxCrashCount: 1000
};

const monitor = new Revive(options);

monitor.on('start', function () {
	console.log(monitor.toJSON());
});

monitor.start();
```

## Options
- `name: String`                Defaults to `null` the name of the process.
- `arg: Array, String`          Defaults to `null` arguments or node script.
- `cwd: String`                 Defaults to `process.cwd()` the current working directory.
- `cmd: String`                 Defaults to `process.execPath` the systems absolute executable/node path.
- `cluster: Boolean`            Defaults to `false`.
- `instances: Number`           Defaults to `os.cpus().length` if cluster is set to `true`
- `stdout: String`              Defaults to `'pipe'` otherwise a file path. If a path is provided than this event will not fire.
- `stderr: String`              Defaults to `'pipe'` otherwise a file path. If a path is provided than this event will not fire.
- `sleepTime: Array, Number`    Defaults to `1000` in milliseconds to sleep between start after a crash.
- `crashTime: Number`           Defaults to `60000`ms. The time until the `maxCrashCount` resets. So if `1000` crashes happen in `60`s then the process will exit.
- `maxCrashCount: Number`       Defaults to `1000` crashes. A crash is triggered and the process exited at `nth + 1`.
- `env: {}`                     Environment variables for the process.
- `data: {}`                    A custom object for you.

## API
All methods execept toJson are async.
- `monitor.start()` Starts the monitor
- `monitor.stop()` Stops the monitor (kills the process if its running with `SIGKILL`).
- `monitor.restart()` Restarts the monitor by stopping then starting (process must be started).
- `monitor.toJSON()` Creates a stringyifiable object. The object returns stats and data about the process.

## Cluster Events
- `monitor.on('status', callback)`
- `monitor.on('start', callback)` Starts the process. Warning async so process may not be available immediately.
- `monitor.on('stop', callback)`  The process and it's tree is sent a `SIGTERM` signal. If the process does not terminate after ten seconds then the process is sent a `SIGKILL` signal.
- `monitor.on('restart', callback)` Same as stopping then starting or vice versa.
- `monitor.on('stdout', callback)` Emits an stdout. Only available if no `Options.stdout` is `pipe`.
	- `Stdout` Parameter the stdout message.
- `monitor.on('stderr', callback)` Emits an stderr. Only available if no `Options.stderr` is `pipe`.
	- `Stderr` Parameter the stderr message.
- `monitor.on('error', callback)` Emits when the process could not spawn, kill, or a message failed.
	- `Error` Parameter the error message.
- `monitor.on('exit', callback)` The process has exited.
	- `Code` The numeric exit code
	- `Signal` The string signal

## Instance Events
- `monitor.on('reload', callback)` Zero downtime restart if `cluster` is set to `true` and `instances` is greater than one.
- `monitor.on('sleep', callback)` Triggered when process crashes and enters sleep.
- `monitor.on('crash', callback)` Triggered when the process crashes.

## Issues
Immediate `start` then `stop` execution does not send the signals. This could be a problem with node.js.

## Authors
[AlexanderElias](https://github.com/AlexanderElias)

## License
[Why You Should Choose MPL-2.0](http://veldstra.org/2016/12/09/you-should-choose-mpl2-for-your-opensource-project.html)
This project is licensed under the MPL-2.0 License
