var path = require('path');
var winston = require('winston');
var env = require('./../env');
var config = require('./config');
var help = require('./helpers');

var loggers = ['DISPATCH', 'CLEANUP', 'PTPIRC', 'PTPANTI', 'BTNIRC'];

var getDate = function() {
	var d = new Date();
	return d.getFullYear() + '-'
		+ help.pad(d.getMonth()+1) + '-'
		+ help.pad(d.getDate());
};

var getDateTime = function() {
	var d = new Date();
	return d.getFullYear() + '-'
		+ help.pad(d.getMonth()+1) + '-'
		+ help.pad(d.getDate()) + ' '
		+ help.pad(d.getHours()) + ':'
		+ help.pad(d.getMinutes()) + ':'
		+ help.pad(d.getSeconds());
};

for (var i in loggers) {
	var tsports = [];

	tsports.push(new winston.transports.DailyRotateFile({
		name: loggers[i].toLowerCase()+'#full',
		level: 'silly',
		colorize: config.app.logColors,
		timestamp: getDateTime,
		filename: path.join(env.logs, 'middleman'),
		datePattern: '.yyyy-MM-dd.log',
		json: false,
		label: loggers[i]
	}));
	tsports.push(new winston.transports.DailyRotateFile({
		name: loggers[i].toLowerCase()+'#fullerr',
		level: 'warn',
		colorize: config.app.logColors,
		timestamp: getDateTime,
		filename: path.join(env.logs, 'middleman'),
		datePattern: '.yyyy-MM-dd.error.log',
		json: false,
		label: loggers[i]
	}));

	winston.loggers.add(loggers[i], {
		console: {
			timestamp: getDateTime,
			level: 'silly',
			colorize: true,
			label: loggers[i]
		},
		transports: tsports
	});
}

exports.get = function(name) {
	return winston.loggers.get(name.toUpperCase());
};
