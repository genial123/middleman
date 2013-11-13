var fs = require('fs');
var path = require('path');
var env = require('./../env');
var config = require('./config');
var help = require('./helpers');
var logger = require('./logger').get('cleanup');

var logMinAge = 0;

function cleanLogs() {
	if (config.app.cleanLogs) logMinAge = (new Date().getTime()-(config.app.cleanLogs*24*60*60*1000));
	if (!logMinAge) return;

	logger.debug('Cleaning up logs with mtime < '+config.app.cleanLogs+' day(s) ago');
	
	fs.readdir(env.logs, function(err, files) {
		if (err) return logger.error('List-error: '+err);
		if (!files.length) return;

		for (var i in files) {
			if (help.endsWith(files[i], '.log') && (files[i].indexOf('forever.debug.log') === -1)) {
				checkLog(path.join(env.logs, files[i]));
			}
		}
	});
}

function checkLog(path) {
	fs.stat(path, function(err, stats) {
		if (err) return logger.error('Stat-error: '+err);
		
		if (stats.mtime.getTime() < logMinAge) {
			logger.debug(path+' is older than '+config.app.cleanLogs+' day(s) - purging...');
			fs.unlink(path);
		}
	});
}

exports.clean = function() {
	cleanLogs();
};
