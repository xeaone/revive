# Revive

Spawns a process, monitors it's states, and automatically revives it.

```
npm install revive
```


## Example ##

```JavaScript
const Revive = require('revive');

const monitor = Revive('/home/user/code/node/app/index.js', {
	name: 'test',				// set name

	env: { PORT: 4444 },			// set environment variables

	cwd: '/home/user/code/node/app/.',	// set current working directory

	stdout: __dirname + '/log',		// (OPTIONAL) set a path for the stdout the stdout event will still execute

	stderr: __dirname + '/log',		// (OPTIONAL) set a path for the stderr the stderr event will still execute

	sleepTime: 1000, 				// (DEFAULT) set time in milliseconds to sleep between revives

	paddingTime: 5000				// (DEFAULT) set time in milliseconds between revives that will
							// reset the sleeps so as not to trigger a crash
							// less time enables more frequent executes of a crashes

	maxSleepCount: 1000, 			// set amount of revives between sleepTime + paddingTime						
})

monitor.start();
```


## API ##

* `monitor.start()` Starts the monitor

* `monitor.stop()` Stops the monitor (kills the process if its running with SIGKILL)

* `monitor.restart()` Restarts the monitor by stopping then starting

* `monitor.toJson()` Creates a stringyifiable object



## Events ##

* `monitor.on('start', callback)` The process was started. (Warning Async: child process may not be available)

* `monitor.on('stop', callback)`  The process and it's tree has been fully killed.

* `monitor.on('restart', callback)` Same as starting then stopping.

* `monitor.on('error', callback)` Process emitted an error passing `(data)`.

* `monitor.on('stdout', callback)` Process emitted an stdout passing `(data)`.

* `monitor.on('stderr', callback)` Process emitted an stderr passing `(data)`.

* `monitor.on('crash', callback)` The process has crashed. This happens when the process exited then slept for the maxSleepCount.

* `monitor.on('exit', callback)` Process has fully exited passing `(code, signal)`. This event takes place any time the child process has exited tigers are the following, crash, stop, sleep, and restart.


## Conditions ##

Basically you can use this package as is in any project even for profit. Conditions do apply.
You cannot modify and redistribute the code base in anyway accept in accordance with the primary maintainer's permission.
You can not charge others to directly or exclusively use this package. Indirectly it is acceptable to charge others but only to the extent that this package is used within the context of a project that uses this projects API.
