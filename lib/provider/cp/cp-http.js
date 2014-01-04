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

// status: 8:active, 4:done
CPHttp.prototype.__movies = function(status, callback) {
	var self = this;
	var url = util.format('%s/%s/movie.list/?status=%s', apiurl, config.cp.apikey, status);

	self.client.json(url, {}, function(err, resp) {
		if (err) return callback(err);
		if ((typeof resp['movies'] === 'undefined') || !resp['movies'].length) return callback(null, []);

		self.logger.debug('Got '+resp['movies'].length+' movies to go through from CouchPotato');
		callback(null, resp['movies']);
	});
};

CPHttp.prototype.movieReleases = function(id, callback) {
	var self = this;
	var url = util.format('%s/%s/release.for_movie/?id=%s', apiurl, config.cp.apikey, id);

	self.client.json(url, {}, function(err, resp) {
		if (err) return callback(err);
		if ((typeof resp['releases'] === 'undefined') || !resp['releases'].length) return callback(null, []);

		self.logger.debug('Found '+resp['releases'].length+' release(s) from CouchPotato for movie #'+id);
		callback(null, resp['releases']);
	});
};

CPHttp.prototype.matchTitles = function(titles, callback) {
	var self = this;

	if (Object.prototype.toString.call(titles) != '[object Array]')
		titles = [titles];
	for (var i in titles)
		titles[i] = titles[i].toLowerCase().replace(/[^\w\s]/gi, ' ');

	self.__movies('active', function(err, results) {
		if (err) return callback(err);
		if (!results.length) return callback(null, []);

		var checked = [];
		var releases = [];

		for (var i in results) {
			var result = results[i]['library']['info'];
			result['library_id'] = results[i]['library_id'];

			var resTitles = [];
			var title = 'none';

			if (typeof result['original_title'] !== 'undefined') {
				resTitles.push(result['original_title']);
				title = result['original_title'];
			}
			if ((typeof result['titles'] !== 'undefined') && result['titles'].length) {
				for (var y in result['titles']) {
					resTitles.push(result['titles'][y]);
				}
			}

			if (!resTitles.length) continue;

			for (var x in resTitles) {
				for (var y in titles) {
					if (help.inArray(result['library_id'], checked)) continue;

					var score = help.sim(titles[y], resTitles[x].replace(/[^\w\s]/gi, ' ').toLowerCase(), true);
					if (score < 85) continue;

					self.logger.debug(resTitles[x]+' (original title: '+title+') received a score of '+Math.round(score)+'% (>= 85%)');
					checked.push(result['library_id']);
					releases.push(result);
				}
			}
		}

		callback(null, releases);
	});
};

CPHttp.prototype.doneMovies = function(callback) {
	this.__movies('done', callback);
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
			self.__movies('done', function(err, results) {
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
			self.__movies('done', function(err, results) {
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
