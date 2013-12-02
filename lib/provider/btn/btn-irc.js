var irc = require('./../../client/irc');
var config = require('./../../utils/config');
var events = require('events');
var util = require('util');

function BTNIRC(namespace) {
	events.EventEmitter.call(this);
	this.logger = require('./../../utils/logger').get(namespace);

	this.client = new irc(namespace, {
		nickname: config.btn.ircwatch.nickname,
		server: config.btn.ircwatch.server,
		port: config.btn.ircwatch.port,
		secure: config.btn.ircwatch.secure,
		iicert: config.btn.ircwatch.ignoreInvalidCert,
		channel: config.btn.ircwatch.channel,
		invitenick: '',
		invitemsg: '',
		nickpass: config.btn.ircwatch.nickservPassword,
		masters: config.btn.ircwatch.masterAuths,
		mastertimeout: config.btn.ircwatch.masterTimeout,
		debugging: config.app.ircDebugging
	});
	this.regex = /(.*) \| (s\d+e\d+|season \d+) \| (episode|season) \| (\d+) \| (.*) \| (.*) \| (.*) \| (.*) \| (.*) \| (.*) \| (\d+) \| (.*) \| (.*) \| (.*)/mi;
}

util.inherits(BTNIRC, events.EventEmitter);

BTNIRC.prototype.connect = function() {
	this.client.connect();
	this.listen();
};

BTNIRC.prototype.listen = function() {
	var self = this;

	this.client.setEvent(function(from, message) {
		self.match(message, false);
	});

	this.client.setMasterEvent(function(from, m) {
		if (typeof m === 'undefined') return;
		if (m.indexOf('!') !== 0) return;

		m = m.replace(/^!/, '');
		self.logger.debug('Got master-command: '+m+' from nick: '+from);

		if (m == 'hello') {
			self.client.say(from, 'Hello '+from);
		}

		else if (m == 'help') {
			self.client.say(from, '!hello - bot will respond if you are authenticated with it');
			self.client.say(from, '!help - displays collection of available commands');
			self.client.say(from, '!test <release> - runs a string through the bot, as if it came from the announce-channel');
			self.client.say(from, '!dirty - mark SickBeard cache as dirty, forcing a refresh on next announce');
		}

		else if (m.indexOf('test ') === 0) {
			var c = m.replace(/^test /, '');
			self.match(c, true);
		}

		else if (m == 'dirty') {
			self.emit('sbdirty');
			self.client.say(from, 'SickBeard cache marked as dirty, will be refreshed on next announce');
		}
	});

	this.logger.info('Listening for announces...');
};

BTNIRC.prototype.match = function(message, test) {
	var m = message.match(this.regex);

	if (m &&
		(typeof m[1] !== 'undefined') &&
		(typeof m[2] !== 'undefined') &&
		(typeof m[3] !== 'undefined') &&
		(typeof m[4] !== 'undefined') &&
		(typeof m[5] !== 'undefined') &&
		(typeof m[6] !== 'undefined') &&
		(typeof m[7] !== 'undefined') &&
		(typeof m[8] !== 'undefined') &&
		(typeof m[9] !== 'undefined') &&
		(typeof m[10] !== 'undefined') &&
		(typeof m[11] !== 'undefined') &&
		(typeof m[12] !== 'undefined') &&
		(typeof m[13] !== 'undefined') &&
		(typeof m[14] !== 'undefined')) {

		var release = {
			'show': m[1],
			'type': m[3].toLowerCase(),
			'year': parseInt(m[4]),
			'quality': {
				'source': m[7].toLowerCase(),
				'resolution': m[8].toLowerCase(),
				'container': m[5].toLowerCase(),
				'codec': m[6].toLowerCase()
			},
			'scene': ((m[9].toLowerCase() == 'yes') ? true : false),
			'fast': ((m[10].toLowerCase() == 'yes') ? true : false),
			'torrentid': parseInt(m[11]),
			'uploader': m[12],
			'language': m[13].toLowerCase(),
			'name': m[14],
			'setext': m[2]
		};

		var se;
		if (release['type'] == 'episode') {
			se = m[2].match(/s(\d+)e(\d+)/i);
			if (se && (typeof se[1] !== 'undefined') && (typeof se[2] !== 'undefined')) {
				release['season'] = parseInt(se[1]);
				release['episode'] = parseInt(se[2]);
			}
		}
		else if (release['type'] == 'season') {
			se = m[2].match(/season (\d+)/i);
			if (se && (typeof se[1] !== 'undefined')) {
				release['season'] = parseInt(se[1]);
			}
		}

		if (typeof release['season'] !== 'undefined') {
			this.logger.debug('Match show:'+"\t\t"+release['show']+' ('+release['year']+')');
			this.logger.debug('Match type:'+"\t\t"+release['setext']+' - '+release['quality']['container']+' / '+release['quality']['codec']+' / '+release['quality']['source']+' / '+release['quality']['resolution']);
			this.logger.debug('Match name:'+"\t\t"+release['name']);
			this.logger.debug('Match torrent ID:'+"\t\t"+release['torrentid']);
			this.logger.debug('Match language:'+"\t\t"+release['language']);

			this.emit('match', release, test);
		}
	}
};

module.exports = BTNIRC;
