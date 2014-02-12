var util = require('util');
var BaseProvider = require('./../base');

function BTN(logger, searcher) {
	BTN.super_.call(this, logger, searcher);

	this.__http = null;
	this.__irc = null;
	this.__quality = null;
}
util.inherits(BTN, BaseProvider);

BTN.prototype.http = function() {
	if (!this.__http) this.__http = require('./btn-http')(this.logger, this.searcher);
	return this.__http;
};

BTN.prototype.irc = function() {
	if (!this.__irc) this.__irc = require('./btn-irc')(this.logger);
	return this.__irc;
};

BTN.prototype.quality = function() {
	if (!this.__quality) {
		var mapping = require('./btn-quality');
		this.__quality = require('./../../util/quality')(mapping);
	}
	return this.__quality;
};

module.exports = function(logger, searcher) {
	return new BTN(logger, searcher);
};
