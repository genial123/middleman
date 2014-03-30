var fs = require('fs');
var util = require('util');
var exec = require('child_process').exec;
var config = require('./config');
var help = require('./helpers');

function notify(module, event, callback) {
	exec(util.format(config.app.hooks+' %s %s', event, module), function(err, stdout, stderr) {
		if (err) return callback('Hook error: '+err.toString().trim());
		if (stderr) return callback('Hook error: '+stderr.trim());
		callback(null, 'Ran hook successfully, returned: '+stdout.trim());
	});
}

exports.notify = function(logger, event) {
	if (!config.app.hooks) return;
	var module = help.loggerLabel(logger);
	
	logger.debug('Running hook for event: '+event+', execute: '+config.app.hooks);

	notify(module, event, function(err, out) {
		if (err) return logger.error(err);
		logger.info(out);
	});
};

exports.test = function() {
	if (!config.app.hooks) return console.error('[!] Missing hook command in config, cannot test.');

	console.log('Running hook for event: test, execute: '+config.app.hooks);

	notify('dispatch', 'test', function(err, out) {
		if (err) return console.error('[!] '+err);
		console.log(out);
	});
};
