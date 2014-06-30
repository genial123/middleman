var path = require('path');
var exec = require('child_process').exec;
var async = require('async');
var util = require('util');
var config = require('./config');
var logger = require('./logger')('dispatch');

function git(cmd, callback) {
	exec(util.format('git %s', cmd), {
		cwd: path.join(__dirname, '../../')
	}, function(err, stdout, stderr) {
		if (err) err.message = stderr.trim();
		callback(err, stdout);
	});
}

function checkGit(callback) {
	git('--version', function(err, out) {
		if (err) logger.debug(err.message);

		if (!err && out.match(/git version/i))
			return callback(null);

		logger.warn('Could not execute \'git --version\', version checking and automatic updates are disabled');
		logger.warn('You will have to install git or keep Middleman up-to-date yourself');
		callback('Could not find git version, assuming git isn\'t available');
	});
}

function gitFetch(callback) {
	git('fetch', function(err, out) {
		if (err) {
			logger.error('Could not fetch newest version using git, skipping version checking');
			return callback('Fetching newest version available from Github using git failed');
		}
		callback(null);
	});
}

function gitStash(callback) {
	git('stash', function(err, out) {
		if (err) {
			logger.error('Could not stash unstaged changes using git, skipping automatic update');
			return callback('Stashing unstaged changes failed');
		}
		callback(null);
	});
}

function gitPull(callback) {
	git('pull', function(err, out) {
		if (err) {
			logger.error('Could not pull newest version avaiable, skipping automatic update');
			return callback('Pulling newest version available from Github using git failed');
		}
		callback(null);
	});
}

function requireBranch(required, callback) {
	git('branch --no-color', function(err, out) {
		if (err) logger.debug(err.message);

		if (!err) {
			var branch = out.match(/\* (.*)/);
			if (branch && (typeof branch[1] !== 'undefined')) {
				if (branch[1].trim() == required)
					return callback(null);

				logger.warn('Currently active branch is not \''+required+'\', version checking and automatic updates are disabled');
				logger.warn('You will have to \'checkout '+required+'\' or keep Middleman up-to-date yourself');
				return callback('Currently active Middleman branch is not \''+required+'\', won\'t try compare versions');
			}
		}

		logger.error('Could not determine currently active Middleman branch, skipping version checking');
		callback('Something went wrong, could not determine currently active Middleman branch');
	});
}

function countRevList(left, right, callback) {
	git(util.format('rev-list --count --left-right %s...%s', left, right), function(err, out) {
		if (err) logger.debug(err.message);

		if (!err) {
			var diff = out.match(/(\d+)/g);
			if (diff && (typeof diff[1] !== 'undefined'))
				return callback(null, parseInt(diff[1]));
		}

		logger.error('Could not count branch difference, skipping version checking');
		callback('Something went wrong, could not count branch difference between \''+left+'\' and \''+right+'\'');
	});
}

function versionCompare(err, data, callback) {
	if (err) return callback(err);

	var commitDiff = data[3];

	var masterPackage = data[4];
	var masterVersion = masterPackage.version;

	var originPackage = data[5];
	var originVersion = originPackage.version;

	logger.debug('Middleman current version: '+masterVersion.string+', newest version: '+originVersion.string);

	if (commitDiff)
		logger.warn('Your Middleman installation is '+commitDiff+' commit(s) behind');

	if (originVersion.major > masterVersion.major) {
		if (config.app.autoUpdate != 'major')
			return manualUpdateWarning(originVersion.string, 'major', callback);
		logger.info('Newest version of Middleman ('+originVersion.string+') is a major update');
	}

	else if (originVersion.minor > masterVersion.minor) {
		if (['major', 'minor'].indexOf(config.app.autoUpdate) === -1)
			return manualUpdateWarning(originVersion.string, 'major', callback);
		logger.info('Newest version of Middleman ('+originVersion.string+') is a minor update');
	}

	else if (originVersion.patch > masterVersion.patch) {
		if (['major', 'minor', 'patch'].indexOf(config.app.autoUpdate) === -1)
			return manualUpdateWarning(originVersion.string, 'major', callback);
		logger.info('Newest version of Middleman ('+originVersion.string+') is a patch update');
	}

	else {
		return callback('Middleman is up-to-date, running version: '+masterVersion.string+' - nice!');
	}

	logger.info('Automatically updating Middleman from version '+masterVersion.string+' to '+originVersion.string);
	updateApplication(callback);
}

function manualUpdateWarning(version, type, callback) {
	logger.warn('Newest version of Middleman ('+version+') is a '+type+' update, not allowed to auto-update');
	logger.warn('You need to update manually by stopping Middleman and running \'git pull\'');

	setTimeout(function() {
		callback(null);
	}, 2000);
}

function updateApplication(callback) {
	logger.info('DO NOT INTERRUPT MIDDLEMAN - UPDATING: Stashing any unsaved changes in application directory...');
	gitStash(function(err) {
		if (err) return callback(err);

		logger.info('DO NOT INTERRUPT MIDDLEMAN - UPDATING: Pulling newest version of Middleman from Github...');
		gitPull(function(err) {
			if (err) return callback(err);

			logger.info('DO NOT INTERRUPT MIDDLEMAN - UPDATING: Restarting process in 3 seconds...');
			setTimeout(function() {
				process.exit(0);
			}, 3000);
		});
	});
}

function package(rev, callback) {
	git(util.format('show %s:package.json', rev), function(err, data) {
		if (err) return callback(err);

		try {
			var json = JSON.parse(data.trim());

			var version = json.version.match(/^(\d+)\.(\d+)\.(\d+)$/);
			json.version = {
				major: parseInt(version[1]),
				minor: parseInt(version[2]),
				patch: parseInt(version[3]),
				string: version[0]
			};

			callback(null, json);
		}
		catch (e) {
			callback('Could not parse package as JSON');
		}
	});
};

exports.checkVersion = function(callback) {
	logger.info('Trying to check Middleman version using Git');

	async.series([
		checkGit,
		async.apply(requireBranch, 'master'),
		gitFetch,
		async.apply(countRevList, 'master', 'origin/master'),
		async.apply(package, 'HEAD'),
		async.apply(package, 'origin/master')
	],
	function(err, data) {
		versionCompare(err, data, callback);
	});
};

exports.package = package;
