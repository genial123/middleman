var util = require('util');
var path = require('path');
var config = require('./../../util/config');
var help = require('./../../util/helpers');

var loginUrl = 'https://tls.passthepopcorn.me/ajax.php?action=login';
var searchUrl = 'https://tls.passthepopcorn.me/torrents.php?json=noredirect&searchstr=%s&order_by=relevance&order_way=descending';
var downloadUrl = 'https://tls.passthepopcorn.me/torrents.php?action=download&id=%s';

function PTPHttp(logger, searcher) {
	this.logger = logger;
	this.searcher = searcher;
	this.client = require('./../../client/http')(logger);
}

PTPHttp.prototype.__login = function(full, callback) {
	var self = this;
	var data = {};

	if (full) {
		data = {
			'username': config.ptp.username,
			'password': config.ptp.password,
			'passkey': config.ptp.passkey,
			'keeplogged': '1',
			'login': 'Login'
		};
	}

	self.client.json(loginUrl, data, function(err, resp) {
		if (err) return callback(err);

		if ((typeof resp['Result'] !== 'undefined') && (resp['Result'] == 'Ok')) {
			self.logger.debug('Login successful!');
			return callback(null, true);
		}
		return callback(null, false);
	});
};

PTPHttp.prototype.login = function(callback) {
	var self = this;

	self.__login(false, function(err, success) {
		if (err) return callback(err);
		if (success) return callback(null);

		self.__login(true, function(err, success) {
			if (err) return callback(err);
			if (success) return callback(null);

			callback('PTP: Login failed, wrong user/pass/key combination?');
		});
	});
};

PTPHttp.prototype.downloadTorrent = function(torrentId, dir, callback) {
	var self = this;

	self.searcher.simple(0, 0, 1, function(opts) {
		self.client.download(util.format(downloadUrl, torrentId), path.join(dir, torrentId+'.torrent'), {}, 'application/x-bittorrent', opts.cb);
	}, callback);
};

PTPHttp.prototype.getMovieInfo = function(ptpId, title, callback) {
	var self = this;

	self.searcher.simple(0, 15, 5, function(opts) {
		self.__getMovieInfo(ptpId, title, function(err, movie) {
			if (err) return opts.again(err);
			return opts.cb(null, movie);
		});
	}, callback);
};

PTPHttp.prototype.__getMovieInfo = function(ptpId, title, callback) {
	var self = this;
	title = title.replace(/[^\w\s]/gi, ' ');
	self.client.json(util.format(searchUrl, encodeURIComponent(title)), {}, function(err, resp) {
		if (err) return callback(err);

		if ((typeof resp['Movies'] !== 'undefined') && (resp['Movies'].length > 0)) {
			for (var i in resp['Movies']) {
				var movie = resp['Movies'][i];

				if ((typeof movie['GroupId'] === 'undefined') || (movie['GroupId'] != ptpId)) continue;
				if (typeof movie['ImdbId'] === 'undefined') continue;

				return callback(null, movie);
			}
		}

		return callback('Found no movie-matches on PTP');
	});
};

PTPHttp.prototype.getTorrent = function(ptpId, torrentId, title, callback) {
	var self = this;

	self.searcher.simple(0, 15, 5, function(opts) {
		self.__getMovieInfo(ptpId, title, function(err, movie) {
			if (err) return opts.again(err);

			if ((typeof movie['Torrents'] !== 'undefined') && (movie['Torrents'].length > 0)) {
				for (var i in movie['Torrents']) {
					var torrent = movie['Torrents'][i];

					if ((typeof torrent['Id'] === 'undefined') || (typeof torrent['Size'] === 'undefined')) continue;
					if (torrent['Id'] != torrentId) continue;

					return opts.cb(null, torrent);
				}
			}

			return opts.again('Found no torrent-match for movie');
		});
	}, callback);
};

PTPHttp.prototype.torrentExists = function(torrentId, imdbId, callback) {
	var self = this;

	self.searcher.simple(0, 0, 1, function(opts) {
		self.client.json(util.format(searchUrl, imdbId), {}, function(err, resp) {
			if (err) return opts.cb(err);

			if ((typeof resp['Movies'] !== 'undefined') && (resp['Movies'].length > 0)) {
				for (var i in resp['Movies']) {
					var movie = resp['Movies'][i];
					if ((typeof movie['Torrents'] === 'undefined') || !movie['Torrents'].length) continue;

					for (var y in movie['Torrents']) {
						var torrent = movie['Torrents'][y];
						if ((typeof torrent['Id'] === 'undefined') || (torrent['Id'] != torrentId)) continue;

						return opts.cb(null, true);
					}
				}
			}

			self.logger.debug('Found no torrent with id: '+torrentId+' for movie: '+imdbId);
			opts.cb(null, false);
		});
	}, callback);
};

module.exports = function(logger, searcher) {
	return new PTPHttp(logger, searcher);
};
