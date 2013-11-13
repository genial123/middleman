var qs = require('querystring');
var request = require('request');
var fs = require('fs');
var config = require('./../utils/config');
var help = require('./../utils/helpers');

var jar = request.jar();
var maxtries = 3;
var wait = 15;

function HTTPClient(namespace) {
	this.logger = require('./../utils/logger').get(namespace);
}

HTTPClient.prototype.json = function(url, fields, callback) {
	this.__prepare({
		type: 'json',
		url: url,
		fields: fields
	}, callback);
};

HTTPClient.prototype.authed = function(url, fields, user, pass, callback) {
	this.__prepare({
		type: 'authed',
		url: url,
		fields: fields,
		username: user,
		password: pass
	}, callback);
};

HTTPClient.prototype.download = function(url, path, fields, callback) {
	this.__prepare({
		type: 'download',
		url: url,
		path: path,
		fields: fields
	}, callback);
};

HTTPClient.prototype.__prepare = function(params, callback) {
	var options = {
		'url': params['url'],
		'timeout': (config.http.timeout*1000),
		'method': 'GET',
		'jar': jar,
		'rejectUnauthorized': !config.http.ignoreInvalidSSL
	};

	if ((typeof params['username'] !== 'undefined') && (typeof params['password'] !== 'undefined')) {
		options['auth'] = {
			'username': params['username'],
			'password': params['password']
		};
	}

	if ((typeof params['fields'] !== 'undefined') && (help.objectSize(params['fields']) > 0)) {
		var data = qs.stringify(params['fields']);
		options['method'] = 'POST';
		options['headers'] = {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': data.length
		};
		options['body'] = data;
	}

	this.__httpLoop(options, params, 0, callback);
};

HTTPClient.prototype.__httpLoop = function(options, params, count, callback) {
	var self = this;
	self.__httpCall(options, params, function(err, result) {
		if (!err) return callback(null, result);

		if (++count < maxtries) {
			self.logger.warn(err);
			self.logger.debug('Retrying URL '+(count+1)+'/'+maxtries+' in '+wait+' seconds...');
			return setTimeout(function() {
				self.__httpLoop(options, params, count, callback);
			}, (1000*wait));
		}

		callback(err);
	});
};

HTTPClient.prototype.__httpCall = function(options, params, callback) {
	this.logger.debug(options.url);

	switch (params['type']) {
		case 'json':
			request(options, function(err, resp, body) {
				if (err) return callback(err);
				if ((resp.statusCode < 200) || (resp.statusCode > 300)) return callback('Received HTTP code '+resp.statusCode+' - '+options.url);
				if (!body) return callback('Missing response - '+options.url);

				try {
					var json = JSON.parse(body);
					return callback(null, json);
				}
				catch (e) {
					return callback('Broken response - '+options.url);
				}
			});
			break;

		case 'download':
			request(options).pipe(fs.createWriteStream(params['path']));
			callback(null, true);
			break;

		case 'authed':
			request(options, function(err, resp, body) {
				if (err) return callback(err);
				if ((resp.statusCode < 200) || (resp.statusCode > 300)) return callback('Received HTTP code '+resp.statusCode+' - '+options.url);
				if (!body) return callback('Missing response - '+options.url);

				return callback(null, true);
			});
			break;
	}
};

module.exports = HTTPClient;
