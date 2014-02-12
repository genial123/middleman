function BaseProvider(logger, searcher) {
	this.logger = logger;
	this.searcher = searcher;

	this.__sb = null;
	this.__cp = null;
}

BaseProvider.prototype.sb = function() {
	if (!this.__sb) this.__sb = require('./../downloader/sb')(this.logger, this.searcher);
	return this.__sb;
};

BaseProvider.prototype.cp = function() {
	if (!this.__cp) this.__cp = require('./../downloader/cp')(this.logger, this.searcher);
	return this.__cp;
};

module.exports = BaseProvider;
