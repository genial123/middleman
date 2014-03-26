var path = require('path');
var stdio = require('stdio');
var forever = require('forever-monitor');
var env = require('./lib/env');
var init = require('./lib/init');
var help = require('./lib/util/helpers');

if (env.user.toLowerCase() == 'root') help.exit('Script should not be run as root, exiting.');

var opts = stdio.getopt({
	init: {description: 'Initialize application'},
	hook: {description: 'Send a test event to the hook script'}
});

init.init(function(err) {
	if (err) return help.exit(err);
	if (opts.init) return console.log('Initialized!');
	if (opts.hook) {
		var hooks = require('./lib/util/hooks');
		return hooks.test();
	}

	function createChild() {
		var child = new (forever.Monitor)('lib/dispatch.js', {
			max: Number.MAX_VALUE,
			command: process.execPath.replace('Program Files', 'Progra~1'),
			silent: false,
			minUptime: 2000,
			spinSleepTime: 10000,
			errFile: path.join(env.logs, 'forever.debug.log')
		});

		child.on('exit', function() {
			createChild();
		});

		child.start();
	}

	createChild();
});
