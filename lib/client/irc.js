var Bot = require('girc');
var hooks = require('./../util/hooks');
var help = require('./../util/helpers');

function Irc(logger, options) {
	this.logger = logger;

	this.nickname = options.nickname;
	this.server = options.server;
	this.port = options.port;
	this.secure = options.secure;
	this.iicert = options.iicert;
	this.channel = options.channel;
	this.invitenick = options.invitenick;
	this.invitemsg = options.invitemsg;
	this.nickpass = options.nickpass;
	this.masterAuths = options.masters;
	this.masterTimeout = options.mastertimeout;
	this.debugging = options.debugging;

	this.client = null;
	this.whoisTimer = null;
	this.whoisTimeout = 900;
}

Irc.prototype.connect = function() {
	var self = this;

	this.client = new Bot({
		server: this.server,
		port: this.port,
		secure: this.secure,
		iicert: this.iicert,
		nick: this.nickname,
		user: this.nickname,
		real: this.nickname,
		debug: this.debugging,
		plugins: {
			nickserv: {
				password: this.nickpass
			},
			master: {
				timeout: this.masterTimeout,
				auths: this.masterAuths
			}
		}
	});

	this.client.on('connected', function() {
		self.__setWhoisTimer();
		self.logger.info('Connected to '+self.server+':'+self.port+'!');

		hooks.notify(self.logger, 'connect');
	});

	this.client.on('reconnect', function() {
		self.logger.info('Reconnecting to '+self.server+':'+self.port+'...');
	});

	this.client.on('join', function(nick, channel) {
		if (nick == self.client.Plugins.Nick.currentNick)
			self.logger.info('Joined channel '+channel);
	});

	this.client.on('disconnected', function(message) {
		clearTimeout(self.whoisTimer);
		self.logger.error('IRC disconnected: '+message);

		hooks.notify(self.logger, 'disconnect');
	});

	this.client.on('wait', function(time) {
		self.logger.debug('Waiting '+Math.round(time/1000)+' seconds...');
	});

	this.client.on('regmaster', function(nick) {
		var mins = Math.round(self.masterTimeout/60);
		self.client.say(nick, 'Successfully authenticated for the next '+mins+' minute(s)');
		self.logger.info('Nick: '+nick+' successfully authenticated with bot for the next '+mins+' minute(s)!');
	});

	this.client.on('unregmaster', function(nick) {
		self.logger.info('Nick: '+nick+' unregistered with bot');
	});

	this.client.on('identifying', function() {
		self.logger.info('Identifying with NickServ...');
	});

	this.client.on('unidentified', function() {
		self.logger.info('Logged out of NickServ');
	});

	this.client.on('wrongnick', function() {
		self.logger.warn('Nick not registered with NickServ, trying to change');
		self.client.forceNick();
	});

	this.client.addListener('identified', function() {
		self.logger.info('Identified with NickServ!');
		self.__requestChanInvite();
	});

	this.logger.info('Connecting to '+this.nickname+'@'+this.server+':'+this.port+'...');
	this.client.connect();
};

Irc.prototype.__requestChanInvite = function() {
	if (this.invitenick && this.invitemsg) {
		this.logger.info('Requesting chan-invite...');
		this.client.say(this.invitenick, this.invitemsg);
		return true;
	}
	return false;
};

Irc.prototype.__setWhoisTimer = function() {
	var self = this;
	clearTimeout(self.whoisTimer);
	self.whoisTimer = setTimeout(function() {
		self.__whoisTimeoutReached();
	}, (self.whoisTimeout*1000));
};

Irc.prototype.__whoisTimeoutReached = function() {
	var self = this;
	self.logger.debug('Executing whois to make sure we are idle on all channels');
	
	self.__checkWhois(function(err) {
		if (err) {
			self.logger.error('Whois-error: '+err);
			self.logger.info('Trying to get back into our channels...');

			if (!self.__requestChanInvite()) {
				self.logger.debug('Network doesn\'t support invite-requests, going to relog with NickServ...');
				self.client.Plugins.NickServ.logout();
			}
		}
		else {
			self.logger.debug('All channels returned from whois successfully');
		}
		self.__setWhoisTimer();
	});
};

Irc.prototype.__checkWhois = function(callback) {
	var self = this;
	if (!self.channel) return callback(null);
	self.client.whois(self.nickname, function(whois) {
		if ((typeof whois.channels === 'undefined') || !help.inArray(self.channel, whois.channels)) {
			return callback('Client was expected to idle '+self.channel+' but wasn\'t according to whois');
		}
		return callback(null);
	});
};

Irc.prototype.setEvent = function(event) {
	this.client.on(this.channel, function(from, message) {
		event(from, message);
	});
};

Irc.prototype.setMasterEvent = function(event) {
	this.client.on('master', function(from, message) {
		event(from, message);
	});
};

Irc.prototype.say = function(nick, message) {
	this.logger.debug(message);
	this.client.say(nick, '\x0307~::{\x03 '+message+' \x0307}::~\x03');
};

module.exports = function(logger, options) {
	return new Irc(logger, options);
};
