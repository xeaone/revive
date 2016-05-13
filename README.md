# Revive

Spawns a process, monitors it, and automatically revives.

```
npm install revive
```


## Example ##

```JavaScript
const Revive = require('revive');

const monitor = Revive('/home/user/code/node/app/index.js', {
	name: 'test',
	env: { PORT: 4444 },
	cwd: '/home/user/code/node/app/.',

	stdout: __dirname + '/log',
	stderr: __dirname + '/log',

	sleepTime: 1000,
	paddingTime: 5000,
	maxSleepCount: 1000
})

monitor.start();
```

# Options ##

`cwd: String`           REQUIRED current working directory

`name: String`          OPTIONAL name

`stdout: String`        OPTIONAL file path (event will still execute)

`stderr: String`        OPTIONAL file path (event will still execute)

`sleepTime: 1000`       DEFAULT sleep between revives (milliseconds)

`paddingTime: 5000`     DEFAULT padding between reset of `sleeps` (milliseconds)

`maxSleepCount: 1000`   DEFAULT revives between `sleepTime` + `paddingTime` (1000 trigger crash)

`env: {}`               DEFAULT environment variables

`data: {}`              DEFAULT custom object



Note: less `paddingTime` triggers more frequent crashes



## API ##

* `monitor.start()` Starts the monitor

* `monitor.stop()` Stops the monitor (kills the process if its running with SIGKILL)

* `monitor.restart()` Restarts the monitor by stopping then starting

* `monitor.toJson()` Creates a stringyifiable object



## Events ##

* `monitor.on('start', callback)` Warning async so process may not be available immediately.

* `monitor.on('stop', callback)`  The process and it's tree has been fully killed.

* `monitor.on('restart', callback)` Same as starting then stopping.

* `monitor.on('error', callback)` Emitted an error passing `(data)`.

* `monitor.on('stdout', callback)` Emitted an stdout passing `(data)`.

* `monitor.on('stderr', callback)` Emitted an stderr passing `(data)`.

* `monitor.on('crash', callback)` Triggered when `sleeps` equals `maxSleepCount`

* `monitor.on('exit', callback)` Exited passing `(code, signal)`. Triggered on crash, stop, sleep, and restart.


## Conditions ##

Basically you can use this package as is in any project even for profit. Conditions do apply.
You cannot modify and redistribute the code base in anyway accept in accordance with the primary maintainer's permission.
You can not charge others to directly or exclusively use this package. Indirectly it is acceptable to charge others but only to the extent that this package is used within the context of a project that uses this projects API.
