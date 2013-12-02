var ns = 'PTPANTI';

var ptphttp = require('./../provider/ptp/ptp-http');
var cphttp = require('./../provider/cp/cp-http');
var cache = require('./../utils/cache');

var env = require('./../env');
var logger = require('./../utils/logger').get(ns);
var help = require('./../utils/helpers');
var config = require('./../utils/config');

var ptp = new ptphttp(ns);
var cp = new cphttp(ns);

logger.info('Setting up cache...');
var store = new cache(ns, {}, env.data);

logger.info('Spawning new antitrump-runs every '+config.ptp.antitrump.interval+' minutes');
var timer = setInterval(function() {
	antiTrump();
}, (config.ptp.antitrump.interval*60*1000));
antiTrump();

function antiTrump() {
	logger.info('Starting a new antitrump-run, snatch timelimit: '+config.ptp.antitrump.maxage+' ('+help.tts(config.ptp.antitrump.maxage)+')');

	cp.findRecentSnatches(function(err, snatches) {
		if (err) return logger.error('CouchPotato error: '+err);
		if (!snatches.length) return logger.info('No recent snatches found from CouchPotato-results');

		logger.info('Found '+snatches.length+' recent snatch(es) queued for checking');
		ptp.login(function(err) {
			if (err) return logger.error('PTP auth error: '+err);

			for (var i in snatches) {
				checkSnatch(snatches[i]);
			}
		});
	});
}

function checkSnatch(snatch) {
	logger.info('Found recent snatch: '+snatch['title']+' (IMDB: '+snatch['imdb']+' - PTP: '+snatch['ptp']+' - '+help.timeDiff(snatch['date'])+' old)');

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
