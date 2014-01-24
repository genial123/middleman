function Quality(mapping) {
	for (var i in mapping)
		mapping[i]['key'] = i;
	
	this.mapping = mapping;
	this.keys = Object.keys(mapping);
}

Quality.prototype.__matchQuality = function(o, q) {
	for (var i in q) {
		if (typeof o[i] === 'undefined') continue;
		
		var r = new RegExp('^'+q[i]+'$', 'i');
		if (!o[i].match(r)) return false;
	}
	return true;
};

Quality.prototype.__findQualityIdx = function(o) {
	for (var i in this.mapping) {
		if (this.__matchQuality(o, this.mapping[i]))
			return this.keys.indexOf(i);
	}
	return -1;
};

Quality.prototype.compare = function(a, b) {
	if (typeof a['key'] === 'undefined') a = this.quality(a);
	if (typeof b['key'] === 'undefined') b = this.quality(b);

	var ia = this.keys.indexOf(a['key']);
	var ib = this.keys.indexOf(b['key']);

	if (ia > ib) return 1;
	if (ia < ib) return -1;
	return 0;
};

Quality.prototype.quality = function(o) {
	var k = this.__findQualityIdx(o);
	if (k !== -1) return this.mapping[this.keys[k]];
	return null;
};

module.exports = function(m) {
	return new Quality(m);
};
