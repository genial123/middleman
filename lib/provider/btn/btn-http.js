var btn = require('btn-api');
var config = require('./../../util/config');
var client = new btn(config.btn.apikey);

function BTNHttp(logger, searcher) {
	this.logger = logger;
	this.searcher = searcher;
}

BTNHttp.prototype.getTorrent = function(id, callback) {
	var self = this;

	self.searcher.simple(0, 15, 5, function(opts) {
		self.logger.debug('Sending BTN API-call to look up torrent with id: '+id);

		client.getTorrents({
			id: id
		}, function(err, data) {
			if (err) return opts.cb('BTN torrent-get failed - correct API-key?');

			if ((typeof data['torrents'] !== 'undefined') && (typeof data['torrents'][id] !== 'undefined') && (typeof data['torrents'][id]['TvdbID'] !== 'undefined'))
				return opts.cb(null, data['torrents'][id]);

			opts.again('Could not find a torrent-match for episode');
		});
	}, callback);
};

module.exports = function(logger, searcher) {
	return new BTNHttp(logger, searcher);
};
