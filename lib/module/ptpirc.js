var ns = 'PTPIRC';

var ptpirc = require('./../provider/ptp/ptp-irc');
var ptphttp = require('./../provider/ptp/ptp-http');
var cphttp = require('./../provider/cp/cp-http');

var logger = require('./../utils/logger').get(ns);
var help = require('./../utils/helpers');
var config = require('./../utils/config');

var irc = new ptpirc(ns);
var ptp = new ptphttp(ns);
var cp = new cphttp(ns);

irc.connect();
irc.addListener('match', function(release, test) {
	if (config.ptp.ircwatch.maxage && (((new Date().getFullYear())-config.ptp.ircwatch.maxage) > release['year']))
		return logger.info('Announce '+release['title']+' ('+release['year']+') is too old, ignored');

	logger.debug('Found announce to check: '+release['title']+' ('+release['year']+')');
	cp.findRelease(release['title'], function(err, cpmovies) {
		if (err) return logger.error('CouchPotato error: '+err);
		if (!cpmovies.length) return logger.info('Didn\'t find any names from CouchPotato matching '+release['title']);

		for (var i in cpmovies) {
			logger.info('Found name-match with CouchPotato: '+release['title']+' ('+cpmovies[i]['imdb']+')');
			ptpMatchMovie(release, cpmovies[i], test);
		}
	});
});

irc.addListener('freeleech', function(release, minsize, maxsize, test) {
	ptp.login(function(err) {
		if (err) return logger.error('PTP auth error: '+err);

		ptp.getTorrent(release['ptpid'], release['torrentid'], release['title'], function(err, torrent) {
			if (err) return logger.error('PTP torrent-get error: '+err);

			validateFreeleech(release, torrent, minsize, maxsize, test);
		});
	});
});

function ptpMatchMovie(release, cpmovie, test) {
	ptp.login(function(err) {
		if (err) return logger.error('PTP auth error: '+err);

		ptp.getMovieInfo(release['ptpid'], release['title'], function(err, ptpmovie) {
			if (err) return logger.error('PTP movie-get error: '+err);
			validateMovie(release, cpmovie, ptpmovie, test);
		});
	});
}

function validateMovie(release, cpmovie, ptpmovie, test) {
	var cpimdb = cpmovie['imdb'];
	var ptpimdb = 'tt'+ptpmovie['ImdbId'];
	logger.debug('CP: '+cpimdb+' vs PTP: '+ptpimdb);

	if (cpimdb != ptpimdb) return logger.info('Woops - IMDB-id from CouchPotato and PTP do not match, not the movie we want.');

	logger.info('Found a movie we want: '+release['title']+' ('+release['year']+') - '+cpimdb+' - gonna tell CouchPotato to search for it...');
	if (test) return logger.info('This is where I tell CP to re-scan the movie, if I weren\'t in test-mode! :)');

	cp.reScanMovie(cpmovie['library_id'], function(err) {
		if (err) return logger.error('CP movie-scan error: '+err);
		logger.info('Movie scan-request sent to CouchPotato successfully!');
	});
}

function validateFreeleech(release, torrent, minsize, maxsize, test) {
	logger.debug('Making sure torrent is freeleech...');
	if (torrent['FreeleechType'] != 'Freeleech') return logger.error('Woops - seems torrent wasn\'t freeleech after all... Weird');

	logger.debug(release['title']+' ('+release['year']+') size: '+help.getSize(torrent['Size'])+' - we want a max of '+help.getSize(maxsize));
	if (torrent['Size'] > maxsize) return logger.debug(release['title']+' too large');

	logger.debug('Checking torrent-size - we want a min of '+help.getSize(minsize));
	if (torrent['Size'] < minsize) return logger.debug(release['title']+' too small');

	logger.debug(release['title']+' is good to go - requesting torrent-download');
	if (test) {
		logger.info('This is where I download the torrent to the freeleech-folder, if I weren\'t in test-mode! :)');
		return irc.freeleechDone(torrent['Size']);
	}

	ptp.downloadTorrent(torrent['Id'], config.ptp.ircwatch.freeleechDir, function(err) {
		if (err) return logger.error('PTP torrent-download error: '+err);

		logger.info('Freeleech torrent added: '+release['title']+' ('+release['year']+') - size: '+help.getSize(torrent['Size']));
		irc.freeleechDone(torrent['Size']);
	});
}
