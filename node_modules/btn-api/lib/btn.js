var http = require('http');
var qs = require('querystring');
var events = require('events');
var util = require('util');
/***
 * uuid
 */
var uuid = require('./utils').uuid

/**
 * BTN api methods
 * for docs look at http://btnapps.net/apigen/class-btnapi.html
 */
var methods = ['userInfo', 'getChangelog', 'getNews', 'getNewsById', 'getBlog', 'getBlogById', 'getTVNews', 'getTVNewsById', 'getInbox', 'getInboxConversation', 'sendInboxConversation', 'getSchedule', 'getNewSeries', 'getTorrents', 'getTorrentsUrl', 'getForumsIndex', 'getForumsPage', 'getTorrentById', 'getUserSubscriptions', 'getUserSnatchlist', 'getUserStats']

/***
 * btn api client
 */
var Btn = module.exports = function(key) {
	events.EventEmitter.call(this);
	this.key = key

}
/***
 * Make it an event
 */
util.inherits(Btn, events.EventEmitter);
/***
 *
 */
methods.forEach(function(method) {

	Btn.prototype[method] = function() {
		var self = this
		var args = Array.prototype.slice.call(arguments);

		var callBack = args.pop()
		this.query({
			method : method,
			params : [self.key].concat(args),
			id : uuid()
		}, function(err, data) {
			if (err)
				callBack(err);
			else
				callBack(null, data.result);
		});
	}
})
/***
 *
 */
Btn.prototype.search = function() {
	var self = this
	var query = {}
	var limit = 2500
	var result = {
		run : function(callBack) {
			self.query({
				method : 'getTorrentsSearch',
				params : [self.key, query, limit],
				id : uuid()
			}, function(err, data) {
				if (err)
					callBack(err);
				else
					callBack(null, data.result);
			});
		}
	};
	['id', 'series', 'name', 'search', 'codec', 'container', 'source', 'resolution', 'origin', 'limit'].forEach(function(key) {
		result[key] = function(val) {
			query[key] = val
			return result
		}
	})
	return result
};
/***
 *
 */
Btn.prototype.query = function(data, callBack) {
	data = JSON.stringify(data) + '\n'

	var req = http.request({
		host : 'api.btnapps.net',
		port : 80,
		method : 'POST',
		path : '/',
		headers : {
			'content-length' : data.length,
			'content-type' : 'application/json',
			'xtype' : 'node-btn'
		}
	}, function(res) {

		res.setEncoding('utf8');

		var json = [];

		res.on('data', function(chunk) {
			json.push(chunk)
		}).on('end', function(chunk) {
			var code = res.statusCode;
			if (code === 200) {
				json = JSON.parse(json.join(''))

				callBack(null, json)
			} else if (code === 400) {
				callBack(new Error('Bad Request: invalid parameters'))
			} else if (code === 401) {
				callBack(new Error('Unauthorized: invalid api key'))
			} else if (code === 404) {
				callBack(new Error('Not Found: the method was not found'))
			} else if (code === 503) {
				callBack(new Error('Service Unavailable: invalid API Key, or you have hit the API too much'))
			} else {
				callBack(new Error('Something is wrong.'))
			}
		});
	});

	req.on('error', function(e) {
		callBack(e)
	});
	req.write(data);
	req.end()
};
