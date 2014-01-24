var util = require('util');
var config = require('./../util/config');
var help = require('./../util/helpers');

var apiurl = util.format('%s/api', config.sb.url);
var blurl = util.format('%s/manage/backlogShow', config.sb.url);

function SBHttp(logger, searcher) {
	this.logger = logger;
	this.searcher = searcher;
	this.client = require('./../client/http')(logger);
}

SBHttp.prototype.__json = function(url, callback) {
	this.client.json(url, {}, function(err, resp) {
		if (err) return callback(err);

		if ((typeof resp['result'] !== 'undefined') && (resp['result'] == 'success'))
			return callback(null, resp);
		if (typeof resp['message'] !== 'undefined')
			return callback(resp['message']);

		callback('SickBeard returned something I can\'t understand');
	});
};

SBHttp.prototype.listShows = function(callback) {
	var self = this;
	var url = util.format('%s/%s/shows?paused=0', apiurl, config.sb.apikey);
	self.__json(url, function(err, resp) {
		if (err) return callback(err);

		if ((typeof resp['data'] !== 'undefined') && help.objectSize(resp['data']) > 0)
			return callback(null, resp['data']);

		self.logger.debug('Got no unpaused shows from SickBeard, nothing to parse');
	});
};

SBHttp.prototype.__listSeasons = function(tvdbid, callback) {
	var self = this;
	var url = util.format('%s/%s/show.seasons?tvdbid=%s', apiurl, config.sb.apikey, tvdbid);
	self.__json(url, function(err, resp) {
		if (err) return callback(err);

		if ((typeof resp['data'] !== 'undefined') && help.objectSize(resp['data']) > 0) {
			return callback(null, resp['data']);
		}
		callback('Got no seasons from SickBeard for show '+tvdbid);
	});
};

SBHttp.prototype.resolveAirDate = function(tvdbid, airdate, callback) {
	this.__listSeasons(tvdbid, function(err, seasons) {
		if (err) return callback(err);
		var ad = airdate.replace(/\./g, '-');

		for (var s in seasons) {
			if (!help.objectSize(seasons[s])) continue;
			for (var e in seasons[s]) {
				if (seasons[s][e]['airdate'] == ad) {
					return callback(null, [s, e]);
				}
			}
		}
		callback('Could not resolve seasons/episode for show: '+tvdbid+', date: '+airdate);
	});
};

SBHttp.prototype.getQuality = function(show, callback) {
	var url = util.format('%s/%s/show.getquality?tvdbid=%s', apiurl, config.sb.apikey, show['tvdbid']);
	this.__json(url, function(err, resp) {
		if (err) return callback(err);

		if ((typeof resp['data'] !== 'undefined') && help.objectSize(resp['data']) > 0) {
			show['quality'] = resp['data'];
			return callback(null, show);
		}
		callback('Could not get quality-settings for one of your unpaused shows from SickBeard: '+show['tvdbid']);
	});
};

SBHttp.prototype.getEpisode = function(tvdbid, season, episode, callback) {
	var url = util.format('%s/%s/episode?tvdbid=%s&season=%s&episode=%s', apiurl, config.sb.apikey, tvdbid, season, episode);
	this.__json(url, function(err, resp) {
		if (err) return callback(err);

		if ((typeof resp['data'] !== 'undefined') && (help.objectSize(resp['data']) > 0))
			return callback(null, resp['data']);
		
		callback('Could not get episode-info from SickBeard for tvdbid: '+tvdbid);
	});
};

SBHttp.prototype.getSeason = function(tvdbid, season, callback) {
	var url = util.format('%s/%s/show.seasons?tvdbid=%s&season=%s', apiurl, config.sb.apikey, tvdbid, season);
	this.__json(url, function(err, resp) {
		if (err) return callback(err);

		if ((typeof resp['data'] !== 'undefined') && (help.objectSize(resp['data']) > 0))
			return callback(null, resp['data']);
		
		callback('Could not get show-info from SickBeard for tvdbid: '+tvdbid);
	});
};

SBHttp.prototype.scanEpisode = function(tvdbid, season, episode, callback) {
	var self = this;

	self.searcher.advanced(0, [0, 0, 0], [
		function(opts) {
			var url = util.format('%s/%s/episode.search?tvdbid=%s&season=%s&episode=%s', apiurl, config.sb.apikey, tvdbid, season, episode);
			self.__json(url, function(err) {
				self.logger.debug('Checking up on newly scanned episode in 30 seconds...');

				return setTimeout(function() {
					opts.cb(err);
				}, 30000);
			});
		}, function(err, opts) {
			if (!err) {
				self.logger.info('SickBeard has marked our episode-scan as snatched, assuming everything went OK');
				return opts.cb(null);
			}
			return opts.again('Episode-error: '+err);
		}
	], callback);
};

SBHttp.prototype.backlogShow = function (tvdbid, season, callback) {
	var self = this;

	self.searcher.advanced(0, [0, 0, 0], [
		function(opts) {
			var url = util.format('%s?tvdb_id=%s', blurl, tvdbid);
			self.client.authed(url, {}, config.sb.username, config.sb.password, function(err) {
				self.logger.debug('Checking up on the show we recently did a backlog-scan on in 30 seconds...');

				return setTimeout(function() {
					opts.cb(err);
				}, 30000);
			});
		}, function(err, opts) {
			if (err) return opts.again('Backlog-error: '+err);

			self.logger.info('Validating that SickBeard backlog-scanned the season successfully');
			var url = util.format('%s/%s/show.seasons?tvdbid=%s&season=%s', apiurl, config.sb.apikey, tvdbid, season);
			self.__json(url, function(err, resp) {
				if (err) return opts.again(err);

				if ((typeof resp['data'] !== 'undefined') && (help.objectSize(resp['data']) > 0)) {
					for (var i in resp['data']) {
						if ((typeof resp['data'][i]['status'] !== 'undefined') && (resp['data'][i]['status'].toLowerCase() == 'snatched')) {
							return opts.cb(null, {success: true});
						}
					}
				}
				opts.cb(null, {success: false});
			});
		}, function(err, opts) {
			if (err) return opts.again('Backlog validate error: '+err);

			if ((typeof opts.success !== 'undefined') && opts.success) {
				self.logger.info('SickBeard has marked our season as snatched, assuming everything went OK');
				return opts.cb(null);
			}

			opts.again('SickBeard scanned the season but still hasn\'t marked anything as snatched');
		}
	], callback);
};

module.exports = function(logger, searcher) {
	return new SBHttp(logger, searcher);
};
