var stdio = require('stdio');
var fs = require('fs');
var path = require('path');
var forever = require('forever-monitor');
var daemonize = require('daemonize2');

/*
 * Args + env
 */
var opts = stdio.getopt({
	init: {description: 'Initialize application'},
	hook: {description: 'Send a test event to the hook script'},
	daemon: {description: 'Start Middleman as a *NIX daemon'},
	datadir: {args: 1, description: 'Specify data directory for Middleman'},
	pidfile: {args: 1, description: 'Specify pid file for Middleman daemon'}
});

if (opts.datadir) process.env._datadir = opts.datadir;
if (opts.pidfile) process.env._pidfile = opts.pidfile;

/*
 * Post-env
 */
var env = require('./lib/env');
var init = require('./lib/init');
var help = require('./lib/util/helpers');

if (!env.uid) help.exit('Script should not be run as root, exiting.');

/*
 * Daemonize
 */
if (opts.daemon && !process.env._daemon) {
	if (!opts.datadir) help.exit('Need a data directory if I\'m gonna daemonize myself');
	if (!opts.pidfile) help.exit('Need a pid file if I\'m gonna daemonize myself');

	process.env._daemon = true;
	daemonize.setup({
		main: path.join(__dirname, 'server.js'),
		name: 'middleman',
		pidfile: opts.pidfile
	}).start();
}

else {
	/*
	 * Init application
	 */
	init.init(function(err) {
		if (err) return help.exit(err);
		if (opts.init) return console.log('Initialized!');
		if (opts.hook) {
			var hooks = require('./lib/util/hooks');
			return hooks.test();
		}

		/*
		 * Setup forever-monitor
		 */
		var child = null;
		var killed = false;

		function createChild() {
			child = new (forever.Monitor)(path.join(__dirname, 'lib/dispatch.js'), {
				max: Number.MAX_VALUE,
				command: process.execPath.replace('Program Files', 'Progra~1'),
				silent: false,
				minUptime: 2000,
				spinSleepTime: 10000,
				errFile: path.join(env.logs, 'forever.debug.log')
			});

			child.on('exit', function() {
				if (!killed) createChild();
			});

			child.start();
		}

		/*
		 * Cleanup on termination
		 * Windows hates this
		 */
		if (env.platform != 'win') {
			process.on('SIGINT', function() {
				killed = true;
				if (child) child.stop();
			})
			.on('SIGTERM', function() {
				killed = true;
				if (child) child.stop();

				if (!opts.pidfile) return;
				fs.exists(opts.pidfile, function(pex) {
					if (!pex) return;

					fs.unlinkSync(opts.pidfile);
				});
			});
		}

		/*
		 * Run child
		 */
		createChild();
	});
}
