var ns = 'BTNIRC';

var btnirc = require('./../provider/btn/btn-irc');
var btnhttp = require('./../provider/btn/btn-http');
var sbhttp = require('./../provider/sb/sb-http');

var logger = require('./../utils/logger').get(ns);
var help = require('./../utils/helpers');
var config = require('./../utils/config');

var irc = new btnirc(ns);
var btn = new btnhttp(ns);
var sb = new sbhttp(ns);

var qualityOrder = ['sdtv', 'sddvd', 'hdtv', 'hdwebdl', 'hdbluray'];
var btnParams = {
	'sdtv': {
		'name': 'sd tv',
		'source': ['hdtv', 'pdtv', 'web-dl', 'webrip', 'bluray', 'tvrip'],
		'resolution': 'sd'
	},
	'sddvd': {
		'name': 'sd dvd',
		'source': ['dvdrip', 'bdrip'],
		'resolution': 'sd'
	},
	'hdtv': {
		'name': 'hd tv',
		'source': ['hdtv'],
		'resolution': '720p'
	},
	'hdwebdl': {
		'name': '720p web-dl',
		'source': ['web-dl', 'webrip'],
		'resolution': '720p'
	},
	'hdbluray': {
		'name': '720p bluray',
		'source': ['bluray'],
		'resolution': '720p'
	},
	'fullhdtv': {
		'name': '1080p hd tv',
		'source': ['hdtv'],
		'resolution': '1080p'
	},
	'fullwebdl': {
		'name': '1080p web-dl',
		'source': ['web-dl', 'webrip'],
		'resolution': '1080p'
	},
	'fullhdbluray': {
		'name': '1080p bluray',
		'source': ['bluray'],
		'resolution': '1080p'
	},
	'rawhdtv': {
		'name': 'rawhd tv',
		'source': ['hdtv'],
		'resolution': '1080i'
	}
};

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

		var total = help.objectSize(shows);
		var count = 0;
		logger.debug('Received '+total+' shows from SickBeard');

		if (!total) return;

		for (var i in shows) {
			shows[i]['tvdbid'] = i;
			sb.getQuality(shows[i], function(err, show) {
				if (err) {
					count++;
					return logger.error('SickBeard error: '+err);
				}
				
				shows[show['tvdbid']] = show;
				if (++count >= total) {
					callback(null, shows);
				}
			});
		}
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

	var quality = determineReleaseQuality(release);
	var wantedQuality = show['quality']['archive'].concat(show['quality']['initial']);
	
	if (!quality) return logger.error('Could not figure out what release-quality was: '+release['show']+' - '+release['setext']);
	logger.debug('Determined quality to be: '+quality['id']);

	if (!help.inArray(quality['id'], wantedQuality)) return logger.info('Ignoring it, we don\'t want that quality');
	logger.debug('We want that quality, checking if SickBeard already has any episodes');

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

		var epQuality = determineEpisodeQuality(episode);
		if (!epQuality) {
			logger.info('Could not find an existing episode of '+release['show']+' - '+release['setext']+' - we want it!');
			return checkTvdbId(show, release['episode'], release, test);
		}

		logger.debug('Existing episode has quality: '+epQuality['name']);
		var rqidx = qualityOrder.indexOf(quality['id']);
		var epidx = qualityOrder.indexOf(epQuality['id']);
		var proper = checkProperRepack(release);

		if ((epidx < 0) || (rqidx < 0)) return logger.error('Could not figure out release or episode quality-index');

		if (proper) {
			logger.debug('Release is a PROPER or REPACK, we want this even if we already have the same quality');
			if (rqidx < epidx) return logger.debug('Release quality is less than what we already have, ignoring');

			logger.info('Release '+release['name']+' is of higher or similar quality than already exists');
			checkTvdbId(show, release['episode'], release, test);
		}

		else if (help.inArray(quality['id'], show['quality']['archive'])) {
			logger.debug('Release quality is archivable, checking if quality is higher');
			if (rqidx <= epidx) return logger.debug('Release quality is less than or equal to what we already have, ignoring');

			logger.info('Release '+release['name']+' is of higher quality than already exists');
			checkTvdbId(show, release['episode'], release, test);
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
		var rqidx = qualityOrder.indexOf(quality['id']);
		var proper = checkProperRepack(release);

		if (proper) logger.debug('Season is a PROPER or REPACK, ignoring archive - we want this even if we already have the same quality');

		if (rqidx < 0) {
			logger.error('Could not figure out release quality-index, it\'s not safe to continue');
			ignored = true;
		}
		else {
			for (var i in season) {
				var epQuality = determineEpisodeQuality(season[i]);
				if (!epQuality) {
					logger.error('Looks like we\'re missing an episode from this season? I don\'t think it\'s safe to continue.');
					ignored = true;
					break;
				}

				logger.debug('Existing episode has quality: '+epQuality['name']);
				var epidx = qualityOrder.indexOf(epQuality['id']);
				if (epidx < 0) {
					logger.error('Could not figure out release or episode quality-index, it\'s not safe to continue');
					ignored = true;
					break;
				}

				if (proper) {
					if (rqidx >= epidx) {
						logger.debug('Release quality is higher or similar than what we already have, bookmarked - so far we want this...');
						searchable = true;
					}
					else {
						logger.debug('Release quality is less than what we already have, not bookmarking for download yet');
					}
				}

				else {
					if (rqidx > epidx) {
						logger.debug('Release quality is higher than what we already have');

						if (help.inArray(quality['id'], show['quality']['archive'])) {
							logger.info('Release quality is archivable, bookmarked - so far we want this...');
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
		}

		if (searchable && !ignored) {
			logger.info('Determined that season is eligible for download');
			checkTvdbId(show, 0, release, test);
		}
		else {
			logger.debug('Season is not eligible for download');
		}
	});
}

function checkProperRepack(release) {
	var name = release['name'].toLowerCase();
	if ((name.indexOf('.proper.') !== -1) || (name.indexOf('.repack.') !== -1))
		return true;
	return false;
}

function determineReleaseQuality(release) {
	for (var i in btnParams) {
		if (!help.inArray(release['source'], btnParams[i]['source'])) continue;
		if (release['resolution'] != btnParams[i]['resolution']) continue;

		var quality = btnParams[i];
		quality['id'] = i;
		return quality;
	}
	return null;
}

function determineEpisodeQuality(episode) {
	if ((typeof episode['status'] === 'undefined') || (typeof episode['quality'] === 'undefined')) return null;

	for (var i in btnParams) {
		if (episode['quality'].toLowerCase() != btnParams[i]['name']) continue;

		var quality = btnParams[i];
		quality['id'] = i;
		return quality;
	}
}

function checkTvdbId(show, epNum, release, test) {
	logger.debug('Making sure TVDB-id from BTN matches SickBeard\'s...');

	btn.getTorrent(release['torrentid'], function(err, torrent) {
		if (err) return logger.error('BTN API-error: '+err);

		logger.debug('BTN: '+torrent['TvdbID']+' - SickBeard: '+show['tvdbid']);
		if (torrent['TvdbID'] != show['tvdbid']) return;

		logger.debug('Shows match - going to tell SickBeard to scan');
		if (test) {
			cachedirty = true;
			return logger.info('This is where I tell SickBeard to scan the episode, if I weren\'t in test-mode! :)');
		}

		if (epNum) {
			logger.debug('Starting a single-episode SickBeard scan...');
			sb.scanEpisode(show['tvdbid'], release['season'], epNum, function(err) {
				if (err) return logger.error('SickBeard error: '+err);

				cachedirty = true;
				logger.info('Successfully commanded SickBeard to search for '+release['show']+' - '+release['setext']);
			});
		}
		else {
			logger.debug('Starting a show SickBeard backlog scan...');
			sb.backlogShow(show['tvdbid'], release['season'], function(err) {
				if (err) return logger.error('SickBeard error: '+err);

				cachedirty = true;
				logger.info('Successfully commanded SickBeard to start backlog scanning '+release['show']);
			});
		}
	});
}
