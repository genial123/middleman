var util = require('util');
var config = require('./../../utils/config');
var http = require('./../../client/http');
var help = require('./../../utils/helpers');

var apiurl = util.format('%s/api', config.cp.url);

function CPHttp(namespace) {
	this.logger = require('./../../utils/logger').get(namespace);
	this.search = require('./../../utils/searcher').get(namespace);
	this.client = new http(namespace);
}

// Status 4 = snatched, 8 = wanted
CPHttp.prototype.__list = function(status, callback) {
	var self = this;
	var url = util.format('%s/%s/movie.list/', apiurl, config.cp.apikey);

	self.client.json(url, {}, function(err, resp) {
		if (err) return callback(err);
		if ((typeof resp['movies'] === 'undefined') || !resp['movies'].length) return callback(null, []);

		var result = [];
		for (var i in resp['movies']) {
			var movie = resp['movies'][i];

			if ((typeof movie['status_id'] !== 'undefined') && movie['status_id'] && (movie['status_id'] == status)) {
				result.push(movie);
			}
		}

		self.logger.debug('Got '+result.length+' movies to go through from CouchPotato');
		callback(null, result);
	});
};

CPHttp.prototype.findRelease = function(title, callback) {
	var self = this;
	title = title.toLowerCase().replace(/[^\w\s]/gi, '');
	self.__list(8, function(err, results) {
		if (err) return callback(err);
		if (!results.length) return callback(null, []);

		var done = [];
		var releases = [];

		for (var i in results) {
			var result = results[i]['library']['info'];
			result['library_id'] = results[i]['library_id'];

			var titles = [];

			if (typeof result['original_title'] !== 'undefined') {
				titles.push(result['original_title']);
			}
			if ((typeof result['titles'] !== 'undefined') && result['titles'].length) {
				for (var y in result['titles']) {
					titles.push(result['titles'][y]);
				}
			}

			if (!titles.length) continue;
			
			for (var x in titles) {
				if (help.inArray(result['library_id'], done)) continue;

				var score = help.sim(title, titles[x].replace(/[^\w\s]/gi, '').toLowerCase(), true);
				if (score < 85) continue;

				self.logger.debug(titles[x] + ' received a score of '+Math.round(score)+'% (>= 85%)');
				done.push(result['library_id']);
				releases.push(result);
			}
		}

		callback(null, releases);
	});
};

CPHttp.prototype.findRecentSnatches = function(callback) {
	this.__list(4, function(err, results) {
		if (err) return callback(err);
		if (!results.length) return callback(null, []);

		var done = [];
		var snatches = [];
		var time = Math.round(new Date().getTime() / 1000);

		for (var i in results) {
			var result = results[i];

			if ((typeof result['releases'] === 'undefined') || !result['releases'].length) continue;

			for (var y in result['releases']) {
				if (help.inArray(result['library']['info']['imdb'], done)) continue;
				var release = result['releases'][y];

				if ((typeof release['info']['provider'] === 'undefined') || (release['info']['provider'] != 'PassThePopcorn')) continue;
				if ((typeof release['status_id'] === 'undefined') || (release['status_id'] != 4)) continue;
				if ((typeof release['info']['date'] === 'undefined') || (release['info']['date'] < (time-config.ptp.antitrump.maxage))) continue;

				var snatch = {
					'imdb': result['library']['info']['imdb'],
					'ptp': release['info']['id'],
					'title': result['library']['info']['original_title'],
					'date': release['info']['date']
				};

				done.push(result['library']['info']['imdb']);
				snatches.push(snatch);
			}
		}

		callback(null, snatches);
	});
};

CPHttp.prototype.reScanMovie = function(id, callback) {
	var self = this;

	self.search.advanced(5, [0, 270, 0], [
		function(opts) {
			var url = util.format('%s/%s/movie.refresh?id=%s', apiurl, config.cp.apikey, id);
			self.client.json(url, {}, function(err, resp) {
				if (err) return opts.cb(err);

				if ((typeof resp['success'] !== 'undefined') && (resp['success'] === true)) {
					self.logger.debug('Checking up on newly re-scanned movie in 30 seconds...');

					return setTimeout(function() {
						return opts.cb(null);
					}, 30000);
				}
				opts.cb('Something went wrong telling CouchPotato to scan for movie');
			});
		}, function(err, opts) {
			if (err) return opts.again('Re-scan error: '+err);

			self.logger.info('Validating that CouchPotato scanned our movie successfully');
			self.__list(4, function(err, results) {
				if (err) return opts.again(err);
				if (!results.length) return opts.cb(null, {success: false});

				for (var i in results) {
					if (results[i]['library_id'] == id) {
						return opts.cb(null, {success: true});
					}
				}
				opts.cb(null, {success: false});
			});
		}, function(err, opts) {
			if (err) return opts.again('Re-scan validate error: '+err);

			if ((typeof opts.success !== 'undefined') && opts.success) {
				self.logger.info('CouchPotato has marked our re-scan as snatched, assuming everything went OK');
				return opts.cb(null);
			}

			opts.again('CouchPotato re-scanned the movie but still hasn\'t snatched it, either we don\'t want it or CouchPotato is slow');
		}
	], callback);
};

CPHttp.prototype.reAddMovie = function(imdb, callback) {
	var self = this;

	self.search.advanced(0, [0, 270, 0], [
		function(opts) {
			var url = util.format('%s/%s/movie.add/?identifier=%s&ignore_previous=1', apiurl, config.cp.apikey, imdb);
			self.client.json(url, {}, function(err, resp) {
				if (err) return opts.cb(err);

				if ((typeof resp['success'] !== 'undefined') && (resp['success'] === true)) {
					self.logger.debug('Checking up on newly re-added movie in 30 seconds...');

					return setTimeout(function() {
						return opts.cb(null);
					}, 30000);
				}
				opts.cb('Something went wrong telling CouchPotato to re-add movie');
			});
		}, function(err, opts) {
			if (err) return opts.again('Re-add error: '+err);

			self.logger.info('Validating that CouchPotato added and re-snatched our movie successfully');
			self.__list(4, function(err, results) {
				if (err) return opts.again(err);
				if (!results.length) return opts.cb(null, {success: false});

				for (var i in results) {
					if (results[i]['library']['identifier'] == imdb) {
						return opts.cb(null, {success: true});
					}
				}
				opts.cb(null, {success: false});
			});
		}, function(err, opts) {
			if (err) return opts.again('Re-add/snatch validate error: '+err);

			if ((typeof opts.success !== 'undefined') && opts.success) {
				self.logger.info('CouchPotato has marked our re-added movie as snatched, assuming everything went well');
				return opts.cb(null);
			}

			opts.again('CouchPotato re-added the movie but still hasn\'t snatched it');
		}
	], callback);
};

module.exports = CPHttp;