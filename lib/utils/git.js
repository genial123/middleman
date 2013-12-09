var exec = require('child_process').exec;
var async = require('async');
var util = require('util');
var config = require('./config');
var logger = require('./logger').get('dispatch');

function git(cmd, callback) {
	exec(util.format('git %s', cmd), function(err, stdout, stderr) {
		callback(err, stdout);
	});
}

function gitReady(callback) {
	git('--version', function(err, out) {
		if (err) return callback(err);

		if (out.match(/git version/i))
			return callback(null);
		callback('Could not find git version, assuming git isn\'t available');
	});
}

function checkMaster(callback) {
	git('branch --no-color', function(err, out) {
		if (err) return callback(err);

		var branch = out.match(/\* (\w+)/);
		if (branch && (typeof branch[1] !== 'undefined')) {
			if (branch[1] == 'master')
				return callback(null);
			return callback('Currently active branch is not master, won\'t try to compare to master');
		}
		callback('Could not determine currently active branch');
	});
}

function findDiff(callback) {
	git('rev-list --count --left-right master...origin/master', function(err, out) {
		if (err) return callback(err);
		var diff = out.match(/(\d+)/g);

		git('describe --tags master', function(err, curTag) {
			if (err) return callback(err);
			var cur = curTag.trim();

			if (diff[1] === '0') return callback('Middleman is up-to-date, running version: '+cur+' - nice!');
			
			git('describe --tags origin/master', function(err, newTag) {
				if (err) return callback(err);
				var nwt = newTag.trim();

				logger.warn('Middleman is out of date, running version: '+cur+' - newest version: '+nwt);
				logger.warn('You version of Middleman is currently '+diff[1]+' commits behind master');
				logger.warn('To update, stop Middleman and run \'git pull\'');
				
				setTimeout(function() {
					callback(null);
				}, 2000);
			});
		});
	});
}

exports.check = function(callback) {
	logger.info('Trying to determine current Middleman version using Git');

	async.series([
		gitReady,
		checkMaster,
		async.apply(git, 'fetch'),
		findDiff
	], callback);
};
