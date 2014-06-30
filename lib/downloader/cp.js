var util = require('util');
var config = require('./../util/config');
var help = require('./../util/helpers');

var apiurl = util.format('%s/api', config.cp.url);

function CPHttp(logger, searcher) {
	this.logger = logger;
	this.searcher = searcher;
	this.client = require('./../client/http')(logger);
}

CPHttp.prototype.__profile = function(id, callback) {
	var self = this;
	var url = util.format('%s/%s/profile.list', apiurl, config.cp.apikey);

	self.client.json(url, {}, function(err, resp) {
		if (err) return callback(err);
		if ((typeof resp.list === 'undefined') || !resp.list.length) return callback('Empty list of profiles received from CouchPotato');
		
		for (var i in resp.list) {
			var profile = resp.list[i];
			
			if (profile._id == id)
				return callback(null, profile);
		}

		callback('Could not find CouchPotato-profile with id: '+id);
	});
};

CPHttp.prototype.__qualities = function(identifiers, callback) {
	var self = this;
	var url = util.format('%s/%s/quality.list', apiurl, config.cp.apikey);

	self.client.json(url, {}, function(err, resp) {
		if (err) return callback(err);
		if ((typeof resp.list === 'undefined') || !resp.list.length) return callback('Empty list of qualities received from CouchPotato');

		var results = [];

		for (var i in resp.list) {
			var quality = resp.list[i];

			if (help.inArray(quality.identifier, identifiers))
				results.push(quality);
		}

		callback(null, results);
	});
};

CPHttp.prototype.profileQualities = function(id, callback) {
	var self = this;

	self.__profile(id, function(err, profile) {
		if (err) return callback(err, []);
		if (!profile.qualities.length) return callback(null, []);

		self.__qualities(profile.qualities, callback);
	});
};

// status: 8:active, 4:done
CPHttp.prototype.__movies = function(status, callback) {
	var self = this;
	var url = util.format('%s/%s/media.list/?status=%s', apiurl, config.cp.apikey, status);

	self.client.json(url, {}, function(err, resp) {
		if (err) return callback(err);
		if ((typeof resp.movies === 'undefined') || !resp.movies.length) return callback(null, []);

		self.logger.debug('Got '+resp.movies.length+' movies to go through from CouchPotato');
		callback(null, resp.movies);
	});
};

CPHttp.prototype.movie = function(id, callback) {
	var self = this;
	var url = util.format('%s/%s/media.get/?id=%s', apiurl, config.cp.apikey, id);

	self.client.json(url, {}, function(err, resp) {
		if (err) return callback(err);
		if ((typeof resp.media === 'undefined') || (resp.media.type != 'movie')) return callback('Could not find movie with id '+id);

		callback(null, resp.media);
	});
};

CPHttp.prototype.movieReleaseIds = function(id, callback) {
	var self = this;

	self.movie(id, function(err, movie) {
		if (err) return callback(err);
		if (!movie.releases.length) return callback(null, []);

		var results = [];
		movie.releases.forEach(function(release) {
			if ((typeof release.info.id === 'undefined') || !release.info.id) return;
			if (typeof release.info.provider === 'undefined') return;
			if (release.info.provider.trim().toLowerCase() != 'passthepopcorn') return;

			results.push(release.info.id);
		});

		self.logger.debug('Got '+results.length+' release(s) from CouchPotato for movie '+id);
		callback(null, results);
	});
};

CPHttp.prototype.matchTitles = function(titles, callback) {
	var self = this;

	if (Object.prototype.toString.call(titles) != '[object Array]')
		titles = [titles];
	for (var i in titles)
		titles[i] = titles[i].toLowerCase().replace(/[^\w\s]/gi, '');

	self.__movies('active', function(err, movies) {
		if (err) return callback(err);
		if (!movies.length) return callback(null, []);

		var checked = [];
		var results = [];

		movies.forEach(function(movie) {
			var search = [];
			var title = 'N/A';

			if (typeof movie.info.original_title !== 'undefined') {
				search.push(movie.info.original_title);
				title = movie.info.original_title;
			}
			if ((typeof movie.info.titles !== 'undefined') && movie.info.titles.length) {
				movie.info.titles.forEach(function(t) {
					search.push(t);
				});
			}

			if (!search.length) return;

			search.forEach(function(s) {
				titles.forEach(function(t) {
					if (help.inArray(movie._id, checked)) return;

					var score = help.sim(t, s.replace(/[^\w\s]/gi, '').toLowerCase(), true);
					if (score < 85) return;

					self.logger.debug(s+' (original title: '+title+') received a score of '+Math.round(score)+'% (>= 85%)');
					checked.push(movie._id);
					results.push(movie);
				});
			});
		});

		callback(null, results);
	});
};

CPHttp.prototype.doneMovies = function(callback) {
	this.__movies('done', callback);
};

CPHttp.prototype.reScanMovie = function(id, torrentId, callback) {
	var self = this;

	self.searcher.advanced(5, [0, 270, 0], [
		function(opts) {
			var url = util.format('%s/%s/media.refresh?id=%s', apiurl, config.cp.apikey, id);
			self.client.json(url, {}, function(err, resp) {
				if (err) return opts.cb(err);

				if ((typeof resp.success !== 'undefined') && (resp.success === true)) {
					self.logger.debug('Checking up on newly re-scanned movie in 30 seconds...');

					return setTimeout(function() {
						return opts.cb(null);
					}, 30000);
				}
				opts.cb('Something went wrong telling CouchPotato to scan for movie');
			});
		}, function(err, opts) {
			if (err) return opts.again('Re-scan error: '+err);

			self.logger.info('Validating that CouchPotato scanned our movie ('+torrentId+') successfully');

			self.movieReleaseIds(id, function(err, releaseIds) {
				if (err) return opts.again(err);

				if (help.inArray(torrentId, releaseIds))
					return opts.cb(null, {success: true});

				opts.cb(null, {success: false});
			});
		}, function(err, opts) {
			if (err) return opts.again('Re-scan validate error: '+err);

			if ((typeof opts.success !== 'undefined') && opts.success) {
				self.logger.info('CouchPotato has discovered torrent #'+torrentId+', assuming everything went OK');
				return opts.cb(null);
			}

			opts.again('CouchPotato re-scanned the movie but still hasn\'t discovered the torrent, either we don\'t want it or CouchPotato is slow');
		}
	], callback);
};

CPHttp.prototype.reAddMovie = function(imdb, callback) {
	var self = this;

	self.searcher.advanced(0, [0, 270, 0], [
		function(opts) {
			var url = util.format('%s/%s/movie.add/?identifier=%s&ignore_previous=1', apiurl, config.cp.apikey, imdb);
			self.client.json(url, {}, function(err, resp) {
				if (err) return opts.cb(err);

				if ((typeof resp.success !== 'undefined') && (resp.success === true)) {
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
					var movie = results[i];
					if (movie.info.imdb == imdb) {
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

module.exports = function(logger, searcher) {
	return new CPHttp(logger, searcher);
};
