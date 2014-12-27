var async = require('async');
var hooks = require('./../util/hooks');
var help = require('./../util/helpers');
var config = require('./../util/config');

var logger = require('./../util/logger')('btnirc');
var searcher = require('./../util/searcher')(logger, 5);
var provider = require('./../provider/btn')(logger, searcher);

var btn = provider.http();
var irc = provider.irc();
var sb = provider.sb();
var q = provider.quality();

var sbcache = null;
var cachedirty = false;

irc.connect();
irc.addListener('match', function(release, test) {
	if (!cachedirty && sbcache && ((sbcache['lastupdate']+(config.sb.ttl*60)) > Math.round((new Date().getTime())/1000))) {
		logger.debug('Shows cached recently, not going to query SickBeard');
		return validateRelease(release, test);
	}

	logger.debug('Cache is too old, going to get a fresh set of data from SickBeard');
	cacheShows(function(err) {
		if (err) return logger.error('SickBeard error: '+err);

		validateRelease(release, test);
	});
});

irc.addListener('sbdirty', function() {
	cachedirty = true;
});

function cacheShows(callback) {
	collectShows(function(err, shows) {
		if (err) return callback(err);

		shows['lastupdate'] = Math.round((new Date().getTime())/1000);
		sbcache = shows;
		cachedirty = false;
		return callback(null);
	});
}

function collectShows(callback) {
	sb.listShows(function(err, shows) {
		if (err) return callback(err);

		var jobs = [];
		var total = help.objectSize(shows);
		logger.debug('Received '+total+' shows from SickBeard');

		if (!total) return callback(null, {});

		for (var i in shows)
			jobs.push(async.apply(collectShow, shows[i]));

		async.series(jobs, function(err, doneShows) {
			if (!doneShows.length) return callback(null, {});

			var results = {};

			for (var i in doneShows) {
				if (!doneShows[i]) continue;
				results[doneShows[i]['tvdbid']] = doneShows[i];
			}

			callback(null, results);
		});
	});
}

function collectShow(show, callback) {
	sb.getQuality(show, function(err, done) {
		if (err) logger.error(err);
		callback(null, done);
	});
}

function validateRelease(release, test) {
	logger.debug('Current set of shows is '+help.timeDiff(sbcache['lastupdate'])+' old (limit: '+config.sb.ttl+' min)');
	var done = [];
	var title = release['show'].toLowerCase().replace(/[^\w\s]/gi, '');

	for (var i in sbcache) {
		var titles = [];
		if ((typeof sbcache[i]['show_name'] !== 'undefined') && sbcache[i]['show_name']) {
			titles.push(sbcache[i]['show_name']);
		}
		if ((typeof sbcache[i]['tvrage_name'] !== 'undefined') && sbcache[i]['tvrage_name']) {
			titles.push(sbcache[i]['tvrage_name']);
		}

		if (!titles.length) continue;

		for (var y in titles) {
			if (help.inArray(sbcache[i]['tvdbid'], done)) continue;
			var score = help.sim(title, titles[y].replace(/[^\w\s]/gi, '').toLowerCase(), true);
			if (score < 85) continue;

			logger.debug(titles[y]+' received a score of '+Math.round(score)+'% (>= 85%)');
			done.push(sbcache[i]['tvdbid']);
			validateMatch(sbcache[i], release, test);
		}
	}

	if (!done.length) logger.info('Didn\'t find a match for '+release['show']+' - '+release['setext']);
}

function validateMatch(show, release, test) {
	logger.info('Found name-match with SickBeard: '+release['show']+' - '+release['setext']);

	if ((typeof show['language'] !== 'undefined') && (show['language'] == 'en')) {
		if ((release['language'] != 'english') && !config.btn.ircwatch.allowForeign) {
			return logger.info('Foreign release ignored: '+release['show']+' - '+release['setext']);
		}
	}

	var quality = q.quality(release.quality);
	var wanted = show['quality']['archive'].concat(show['quality']['initial']);

	if (!quality) return logger.error('Could not figure out what release-quality was: '+release['show']+' - '+release['setext']);
	logger.debug('Determined quality to be: '+quality['display']);

	if (!help.inArray(quality['key'], wanted)) return logger.info('Ignoring it, we don\'t want that quality ('+quality['display']+')');
	logger.info('We want that quality ('+quality['display']+'), checking if SickBeard already has any episodes');

	// Resolve air-by-date if necessary
	if (typeof release['airdate'] !== 'undefined') {
		logger.debug('Trying to resolve air-date: '+release['airdate']);
		sb.resolveAirDate(show['tvdbid'], release['airdate'], function(err, se) {
			if (err) return logger.error(err);

			release['setext'] = 'S'+help.pad(se[0])+'E'+help.pad(se[1]);
			release['season'] = parseInt(se[0]);
			release['episode'] = parseInt(se[1]);
			logger.info('Resolved '+release['show']+' - '+release['airdate']+' to be '+release['setext']);

			determineMatchType(show, release, quality, test);
		});
	}

	else {
		determineMatchType(show, release, quality, test);
	}
}

function determineMatchType(show, release, quality, test) {
	// Single episode
	if ((release['type'] == 'episode') && (typeof release['season'] !== 'undefiend') && (typeof release['episode'] !== 'undefined')) {
		validateEpisode(show, release, quality, test);
	}

	// Full season
	else if ((release['type'] == 'season') && (typeof release['season'] !== 'undefined')) {
		validateSeason(show, release, quality, test);
	}

	else {
		logger.error('Received announce I can\'t determine to be either episode or season');
	}
}

function validateEpisode(show, release, quality, test) {
	sb.getEpisode(show['tvdbid'], release['season'], release['episode'], function(err, episode) {
		if (err) return logger.error('SickBeard error: '+err);

		var epStatus = episode['status'].toLowerCase().trim();
		if (['skipped', 'ignored', 'archived'].indexOf(epStatus) !== -1)
			return logger.info('Existing episode has status "'+epStatus+'" - we don\'t want this, ignoring');

		var epQuality = q.quality({'sickname': episode['quality']});
		if (!epQuality) {
			logger.info('Could not find an existing episode of '+release['show']+' - '+release['setext']+' - we want it!');
			return checkTvdbId(show, release['episode'], release, quality, test);
		}

		logger.debug('Existing episode has quality: '+epQuality['display']);
		var comp = q.compare(epQuality, quality);
		var proper = checkProperRepack(release);

		if (proper) {
			logger.debug('Release is a PROPER or REPACK, we want this even if we already have the same quality');
			if (comp < 0) return logger.info('Release quality is less than what we already have, ignoring');

			logger.info('Release '+release['name']+' is of higher or similar quality than already exists');
			checkTvdbId(show, release['episode'], release, quality, test);
		}

		else if (help.inArray(quality['key'], show['quality']['archive'])) {
			logger.debug('Release quality is archivable, checking if quality is higher');
			if (comp < 1) return logger.info('Release quality is less than or equal to what we already have, ignoring');

			logger.info('Release '+release['name']+' is of higher quality than already exists');
			checkTvdbId(show, release['episode'], release, quality, test);
		}

		else {
			logger.debug('Release quality is not flagged as archive in SickBeard, the episode we already have is good enough');
		}
	});
}

function validateSeason(show, release, quality, test) {
	sb.getSeason(show['tvdbid'], release['season'], function(err, season) {
		if (err) return logger.error('SickBeard error: '+err);

		var searchable = false;
		var ignored = false;
		var proper = checkProperRepack(release);

		if (proper) logger.debug('Season is a PROPER or REPACK, ignoring archive - we want this even if we already have the same quality');

		for (var i in season) {
			var epStatus = season[i]['status'].toLowerCase().trim();
			if (['skipped', 'ignored', 'archived'].indexOf(epStatus) !== -1) {
				logger.info('Existing episode has status "'+epStatus+'" - we don\'t want this, ignoring');
				ignored = true;
				break;
			}

			var epQuality = q.quality({'sickname': season[i]['quality']});
			if (!epQuality) {
                logger.info('Missing episode from this season, can not match quality but assuming we want this - continuing');
                searchable = true;
                continue;
			}

			logger.debug('Existing episode has quality: '+epQuality['display']);
			var comp = q.compare(epQuality, quality);

			if (proper) {
				if (comp >= 0) {
					logger.debug('Release quality is higher or similar than what we already have, bookmarked - so far we want this');
					searchable = true;
				}
				else {
					logger.debug('Release quality is less than what we already have, will not grab the PROPER/REPACK season');
					ignored = true;
				}
			}

			else {
				if (comp > 0) {
					logger.debug('Release quality is higher than what we already have');

					if (help.inArray(quality['key'], show['quality']['archive'])) {
						logger.debug('Release quality is archivable, bookmarked - so far we want this...');
						searchable = true;
					}
					else {
						logger.debug('Release quality is not flagged as archive in SickBeard, the episode we already have is good enough');
					}
				}
				else {
					logger.debug('Existing episode already has announced quality, not bookmarking for download yet');
				}
			}
		}

		if (searchable && !ignored) {
			logger.info('Determined that season is eligible for download');
			checkTvdbId(show, 0, release, quality, test);
		}
		else {
			logger.info('Season is not eligible for download');
		}
	});
}

function checkProperRepack(release) {
	var name = release['name'].toLowerCase();
	if ((name.indexOf('.proper.') !== -1) || (name.indexOf('.repack.') !== -1))
		return true;
	return false;
}

function checkTvdbId(show, epNum, release, quality, test) {
	logger.debug('Making sure ID from BTN matches with SickBeard...');

	btn.getTorrent(release['torrentid'], function(err, torrent) {
		if (err) return logger.error('BTN API-error: '+err);

		logger.debug('TheTVDB: '+torrent['TvdbID']+' - TVRage: '+torrent['TvrageID']+' - SickBeard: '+show['tvdbid']);

		/* Hack: TVRage-fork of SickBeard places TVRage IDs in the shows tvdbid */
		if ((show['tvdbid'] != torrent['TvdbID']) && (show['tvdbid'] != torrent['TvrageID']))
			return logger.info('ID from BTN does not match with SickBeard, aborting because of false-positive');

		logger.debug('Shows match - going to tell SickBeard to scan');
		if (test) {
			cachedirty = true;
			return logger.info('This is where I tell SickBeard to scan the episode, if I weren\'t in test-mode! :)');
		}

		if (epNum) {
			logger.info('Starting a single-episode SickBeard scan...');
			sb.scanEpisode(show['tvdbid'], release['season'], epNum, quality, function(err) {
				if (err) return logger.error('SickBeard error: '+err);

				cachedirty = true;
				logger.info('Successfully commanded SickBeard to search for '+release['show']+' - '+release['setext']);

				hooks.notify(logger, 'download');
			});
		}
		else {
			logger.info('Starting a show SickBeard backlog scan...');
			sb.backlogShow(show['tvdbid'], release['season'], quality, function(err) {
				if (err) return logger.error('SickBeard error: '+err);

				cachedirty = true;
				logger.info('Successfully commanded SickBeard to start backlog scanning '+release['show']);

				hooks.notify(logger, 'download');
			});
		}
	});
}
