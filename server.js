var forever = require('forever-monitor');
var env = require('./lib/env');

function exit(m) {
	console.error('[!] %s', m);
	process.exit(1);
}

if (env.user.toLowerCase() == 'root') exit('Script should not be run as root, exiting.');

var stdio = require('stdio');
var init = require('./lib/init');

var opts = stdio.getopt({
	init: {description: 'Initialize application'},
	hook: {description: 'Send a test event to the hook script'}
});

init.init(function(err) {
	if (err) return exit(err);
	if (opts.init) return console.log('Initialized!');
	if (opts.hook) {
		var hooks = require('./lib/util/hooks');
		return hooks.test();
	}

	var config = require('./lib/util/config');

	function createChild() {
		var child = new (forever.Monitor)('lib/dispatch.js', {
			max: (config.app.forever ? Number.MAX_VALUE : 0),
			command: process.execPath.replace('Program Files', 'Progra~1'),
			silent: false,
			options: [],
			minUptime: 2000,
			spinSleepTime: 10000,
			errFile: env.logs+'/forever.debug.log'
		});

		child.on('exit', function() {
			if (config.app.forever) {
				createChild();
			}
		});

		child.start();
	}

	createChild();
});
