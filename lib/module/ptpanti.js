var env = require('./../env');
var hooks = require('./../util/hooks');
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

		var results = [];

		for (var i in movies) {
			var movie = movies[i];
			if (!movie.releases.length) continue;

			for (var y in movie.releases) {
				var release = movie.releases[y];
				if (release.status != 'done') continue;
				if (release.info.provider.trim().toLowerCase() != 'passthepopcorn') continue;
				if (release.info.date < (time-config.ptp.antitrump.maxage)) continue;

				results.push({
					imdb: movie.info.imdb,
					ptp: release.info.id,
					title: movie.info.original_title,
					date: release.info.date
				});
			}
		}

		if (!results.length) return logger.info('No recent snatches found from CouchPotato-results');
		logger.info('Found '+results.length+' recent snatch(es) to check against PTP');

		ptp.login(function(err) {
			if (err) return logger.error('PTP auth error: ' + err);
			
			results.forEach(function(result) {
				checkSnatch(result);
			});
		});
	});
}

function checkSnatch(snatch) {
	logger.info('Recent snatch: '+snatch.title+' (IMDB: '+snatch.imdb+' - PTP: '+snatch.ptp+' - '+help.timeDiff(snatch.date)+' old)');

	var inc = store.increasable(snatch.imdb, config.ptp.antitrump.maxtrumps);
	if (!inc) return logger.warn('Trump-count for '+snatch.title+' has reached max: '+config.ptp.antitrump.maxtrumps);

	ptp.torrentExists(snatch.ptp, snatch.imdb, function(err, exists) {
		if (err) return logger.error('PTP search error: '+err);
		if (exists) return logger.info('"'+snatch.title+'" still exists on PTP, no problem');

		logger.info('"'+snatch.title+'" no longer exists on PTP - trying to invalidate on CouchPotato...');
		if (config.ptp.antitrump.testmode) return logger.info('This is where I tell CouchPotato to re-add the movie, if I weren\'t in test-mode!');

		cp.reAddMovie(snatch.imdb, function(err) {
			if (err) return logger.error('CouchPotato re-add error: '+err);

			store.increase(snatch.imdb, function(err) {
				if (err) return logger.error('Cache-error: '+err);
				logger.info('Movie "'+snatch.title+'" re-added successfully to CouchPotato, should be snatching a valid torrent right about now!');

				hooks.notify(logger, 'download');
			});
		});
	});
}
