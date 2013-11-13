var env = require('./../env');

function Cache(db, opts, base) {
	if (typeof opts === 'undefined') opts = {};
	if (typeof base === 'undefined') base = env.home;
	this.store = require('ministore')(base, opts);
	this.cache = this.store(db.toLowerCase()+'.json');
}

Cache.prototype.set = function(k, v, callback) {
	this.cache.set(k, v, callback);
};

Cache.prototype.get = function(k) {
	return this.cache.get(k);
};

Cache.prototype.remove = function(k, callback) {
	this.cache.remove(k, callback);
};

Cache.prototype.list = function() {
	return this.cache.list();
};

Cache.prototype.increasable = function(k, m) {
	var v = this.get(k);
	if (v && (v >= m)) return false;
	return true;
};

Cache.prototype.increase = function(k, callback) {
	var self = this;
	var v = self.get(k);
	if (!v) v = 0;
	self.set(k, (v+1), function(err) {
		if (err) return callback(err);
		callback(null);
	});
};

module.exports = Cache;
