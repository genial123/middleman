var async = require('async');
var fs = require('fs');
var env = require('./env');

var ready = false;
var dirs = [
	env.home,
	env.data,
	env.logs,
	env.temp
];

function _createDirectory(path, callback) {
	fs.exists(path, function(ex) {
		if (ex) return callback(null);
		
		fs.mkdir(path, 0775, function(err) {
			if (err) return callback(err);
			callback(null);
		});
	});
}

function initDirs(callback) {
	var s = [];
	for (var i in dirs)
		s.push(async.apply(_createDirectory, dirs[i]));
	async.series(s, callback);
}

function initConfig(callback) {
	var config = require('./util/config');
	config.on('ready', function() {
		callback(null);
	});
}

exports.init = function(callback) {
	if (ready) return callback(null);
	
	async.series([
		initDirs,
		initConfig
	], function(err) {
		if (!err) ready = true;
		callback(err);
	});
};
