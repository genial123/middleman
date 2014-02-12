var async = require('async');
var env = require('./../env');
var help = require('./../util/helpers');
var config = require('./../util/config');

var logger = require('./../util/logger')('ptpanti');
var searcher = require('./../util/searcher')(logger, 10);
var provider = require('./../provider/ptp')(logger, searcher);

var ptp = provider.http();
var cp = provider.cp();

logger.info('Setting up cache...');
var store = require('./../util/cache')('ptpanti', {}, env.data);

var time;
var lastEdit = {};
var mostRecent = {};

logger.info('Spawning new antitrump-runs every '+config.ptp.antitrump.interval+' minutes');
var timer = setInterval(function() {
	antiTrump();
}, (config.ptp.antitrump.interval*60*1000));
antiTrump();

function antiTrump() {
	logger.info('Starting a new antitrump-run, snatch timelimit: '+config.ptp.antitrump.maxage+' ('+help.tts(config.ptp.antitrump.maxage)+')');
	time = Math.round(new Date().getTime() / 1000);

	cp.doneMovies(function(err, movies) {
		if (err) return logger.error('CouchPotato error: '+err);
		if (!movies.length) return logger.info('No movies received from CouchPotato');

		var jobs = [];

		for (var i in movies) {
			var id = movies[i]['library_id'];
			if ((typeof lastEdit[id] !== 'undefined') && (lastEdit[id] != movies[i]['last_edit'])) {
				logger.debug('Movie #'+id+' has been changed, need to re-scan releases');
				delete mostRecent[id];
			}
			if ((typeof mostRecent[id] !== 'undefined') && (mostRecent[id] < (time-config.ptp.antitrump.maxage))) continue;

			lastEdit[id] = movies[i]['last_edit'];
			jobs.push(async.apply(findReleases, movies[i]));
		}

		if (!jobs.length) return logger.info('No recent snatches or changed movies found from CouchPotato-results');
		
		async.parallel(jobs, function(err, releases) {
			if (err) return logger.error('CouchPotato error: '+err);

			var results = [];
			for (var i in releases) {
				if (!releases[i]) continue;
				results.push(releases[i]);
			}

			if (!results.length) return logger.info('No recent snatches found from CouchPotato-results');
			logger.info('Found '+results.length+' recent snatch(es) to check against PTP');
			
			ptp.login(function(err) {
				if (err) return logger.error('PTP auth error: '+err);

				for (var i in results) {
					checkSnatch(results[i]);
				}
			});
		});
	});
}

function findReleases(movie, callback) {
	var id = movie['library_id'];
	var title = movie['library']['info']['original_title'];
	var year = movie['library']['info']['year'];
	logger.debug('Finding releases for movie #'+id+' - "'+title+'" ('+year+')');

	cp.movieReleases(id, function(err, releases) {
		if (err) {
			logger.error('CouchPotato error: '+err);
			return callback(null);
		}
		if (!releases.length) {
			logger.warn('No snatches found for a movie marked as downloaded, weird - ignoring it');
			mostRecent[id] = 0;
			return callback(null);
		}

		for (var i in releases) {
			if ((typeof releases[i]['info']['provider'] === 'undefined') || (releases[i]['info']['provider'] != 'PassThePopcorn')) continue;
			if ((typeof releases[i]['status_id'] === 'undefined') || (releases[i]['status_id'] != 4)) continue;

			if ((typeof mostRecent[id] === 'undefined') || (mostRecent[id] < releases[i]['info']['date']))
				mostRecent[id] = releases[i]['info']['date'];

			if (releases[i]['info']['date'] >= (time-config.ptp.antitrump.maxage)) {
				return callback(null, {
					'imdb': movie['library']['info']['imdb'],
					'ptp': releases[i]['info']['id'],
					'title': title,
					'date': releases[i]['info']['date']
				});
			}
		}
		
		callback(null, null);
	});
}

function checkSnatch(snatch) {
	logger.info('Recent snatch: '+snatch['title']+' (IMDB: '+snatch['imdb']+' - PTP: '+snatch['ptp']+' - '+help.timeDiff(snatch['date'])+' old)');

	var inc = store.increasable(snatch['imdb'], config.ptp.antitrump.maxtrumps);
	if (!inc) return logger.warn('Trump-count for '+snatch['title']+' has reached max: '+config.ptp.antitrump.maxtrumps);

	ptp.torrentExists(snatch['ptp'], snatch['imdb'], function(err, exists) {
		if (err) return logger.error('PTP search error: '+err);
		if (exists) return logger.info('"'+snatch['title']+'" still exists on PTP, no problem');

		logger.info('"'+snatch['title']+'" no longer exists on PTP - trying to invalidate on CouchPotato...');
		if (config.ptp.antitrump.testmode) return logger.info('This is where I tell CouchPotato to re-add the movie, if I weren\'t in test-mode!');

		cp.reAddMovie(snatch['imdb'], function(err) {
			if (err) return logger.error('CouchPotato re-add error: '+err);

			store.increase(snatch['imdb'], function(err) {
				if (err) return logger.error('Cache-error: '+err);
				logger.info('Movie "'+snatch['title']+'" re-added successfully to CouchPotato, should be snatching a valid torrent right about now!');
			});
		});
	});
}
