var util = require('util');
var BaseProvider = require('./../base');

function PTP(logger, searcher) {
	PTP.super_.call(this, logger, searcher);

	this.__http = null;
	this.__irc = null;
	this.__quality = null;
}
util.inherits(PTP, BaseProvider);

PTP.prototype.http = function() {
	if (!this.__http) this.__http = require('./ptp-http')(this.logger, this.searcher);
	return this.__http;
};

PTP.prototype.irc = function() {
	if (!this.__irc) this.__irc = require('./ptp-irc')(this.logger);
	return this.__irc;
};

PTP.prototype.quality = function() {
	return {};
	if (!this.__quality) {
		var mapping = require('./ptp-quality');
		this.__quality = require('./../../util/quality')(mapping);
	}
	return this.__quality;
};

module.exports = function(logger, searcher) {
	return new PTP(logger, searcher);
};
