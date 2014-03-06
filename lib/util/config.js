var async = require('async');
var events = require('events');
var util = require('util');
var help = require('./helpers');

var db = require('./cache')('config', {exitOnError: true});

var defaults = {
	app: {
		forever: true,
		logColors: true,
		ircDebugging: false,
		cleanLogs: 10,
		hooks: ''
	},
	ptp: {
		username: 'my_username',
		password: 'my_password',
		passkey: 'my_passkey',
		irckey: 'my_irckey',
		antitrump: {
			enabled: false,
			interval: 15,
			maxage: 86400,
			maxtrumps: 3,
			testmode: false
		},
		ircwatch: {
			enabled: false,
			maxage: 1,
			useIrcSSL: false,
			ignoreInvalidIrcSSL: false,
			nickname: 'my_botnick',
			nickservPassword: 'my_password',
			masterAuths: [''],
			masterTimeout: 600,
			freeleechDir: '/path/to/my/dir'
		}
	},
	btn: {
		apikey: 'my_apikey',
		ircwatch: {
			enabled: false,
			allowForeign: false,
			useIrcSSL: false,
			ignoreInvalidIrcSSL: false,
			nickname: 'my_botnick',
			nickservPassword: 'my_password',
			masterAuths: [''],
			masterTimeout: 600
		}
	},
	cp: {
		url: 'http://<hostname>:<port>',
		apikey: 'my_apikey'
	},
	sb: {
		ttl: 60,
		url: 'http://<sickbeard>:<port>',
		apikey: 'my_apikey',
		username: 'my_username',
		password: 'my_password'
	},
	http: {
		timeout: 30,
		ignoreInvalidSSL: false
	}
};

function mergeConfig(i, callback) {
	var v = db.get(i);
	if (!v) v = {};
	var c = d(defaults[i], v);
	db.set(i, c, callback);
}

function removeKey(k, callback) {
	db.remove(k, callback);
}

function cleanup(callback) {
	var dk = Object.keys(defaults);
	var ak = db.list();
	var series = [];

	for (var i in ak) {
		if (!help.inArray(ak[i], dk))
			series.push(async.apply(removeKey, ak[i]));
	}

	async.series(series, callback);
};

function d(defaults, config) {
	for (var i in defaults) {
		if (Object.prototype.toString.call(defaults[i]) == '[object Object]')
			defaults[i] = (typeof config[i] !== 'undefined') ? d(defaults[i], config[i]) : defaults[i];
		else defaults[i] = (typeof config[i] !== 'undefined') ? config[i] : defaults[i];
	}
	return defaults;
}

function Config() {
	events.EventEmitter.call(this);

	var self = this;
	var series = [];
	
	for (var i in defaults) series.push(async.apply(mergeConfig, i));
	series.push(cleanup);
	
	async.series(series, function(err) {
		if (err) console.log('ERROR: %s', err);

		var list = db.list();
		for (var i in list) {
			self.__dg(list[i]);
		}

		self.emit('ready');
	});
}
util.inherits(Config, events.EventEmitter);

Config.prototype.__dg = function(i) {
	this.__defineGetter__(i, function() {
		return db.get(i);
	});
};

module.exports = new Config();
