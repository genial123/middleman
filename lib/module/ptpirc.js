var env = require('./../env');
var hooks = require('./../util/hooks');
var help = require('./../util/helpers');
var config = require('./../util/config');

var logger = require('./../util/logger')('ptpirc');
var searcher = require('./../util/searcher')(logger, 5);
var provider = require('./../provider/ptp')(logger, searcher);

var ptp = provider.http();
var irc = provider.irc();
var cp = provider.cp();
var q = provider.quality();

logger.info('Setting up cache...');
var fpstore = require('./../util/cache')('ptpirc-fp', {}, env.data);

irc.connect();
irc.addListener('match', function(release, test) {
	if (config.ptp.ircwatch.maxage && (((new Date().getFullYear())-config.ptp.ircwatch.maxage) > release.year))
		return logger.info('Announce '+release.title+' ('+release.year+') is too old, ignored');

	logger.debug('Found announce to check: '+release.title+' ('+release.year+')');
	var titles = release.title.split(/\sAKA\s/);
	if (titles.length > 1) {
		logger.debug('Found '+titles.length+' announce-titles to search for');
		titles.forEach(function(title) {
			logger.debug('Possible title: '+title);
		});
	}

	cp.matchTitles(titles, function(err, matches) {
		if (err) return logger.error('CouchPotato error: '+err);
		if (!matches.length) return logger.info('Didn\'t find any names from CouchPotato matching '+release.title);

		matches.forEach(function(match) {
			logger.info('Found name-match with CouchPotato: '+release.title+' ('+match.info.imdb+')');
			ptpMatchMovie(release, match, test);
		});
	});
});

irc.addListener('freeleech', function(release, minsize, maxsize, test) {
	ptp.login(function(err) {
		if (err) return logger.error('PTP auth error: '+err);

		ptp.getTorrent(release.ptpid, release.torrentid, release.title, function(err, torrent) {
			if (err) return logger.error('PTP torrent-get error: '+err);
			validateFreeleech(release, torrent, minsize, maxsize, test);
		});
	});
});

function ptpMatchMovie(release, match, test) {
	if (fpstore.has(match.info.imdb) && help.inArray(release.ptpid, fpstore.get(match.info.imdb)))
		return logger.info('IMDB-id: '+match.info.imdb+' and PTP-id: '+release.ptpid+' has previously been marked as a false positive, not going to continue');

	logger.debug('Trying to find CouchPotato quality-profile for id: '+match.profile_id);
	cp.profileQualities(match.profile_id, function(err, pqs) {
		if (err) logger.warn('Error finding quality-profile, going to continue without quality filter: '+err);

		var wanted = [];
		if (pqs.length) {
			for (var i in pqs)
				wanted.push(pqs[i].identifier);
		}

		var quality = q.quality(release.quality);
		if (!quality) return logger.error('Could not figure out what release-quality was: '+release.title+' ('+release.year+')');
		logger.debug('Determined quality to be: '+quality.display);

		if (wanted.length && !help.inArray(quality.key, wanted)) return logger.info('Ignoring it, we don\'t want that quality ('+quality.display+')');
		logger.info('We want that quality ('+quality.display+'), authenticating with PTP');

		ptp.login(function(err) {
			if (err) return logger.error('PTP auth error: '+err);

			ptp.getMovieInfo(release.ptpid, release.title, function(err, movie) {
				if (err) return logger.error('PTP movie-get error: '+err);
				validateMovie(release, match, movie, test);
			});
		});
	});
}

function validateMovie(release, match, movie, test) {
	var cpimdb = match.info.imdb;
	var ptpimdb = 'tt'+movie.ImdbId;
	logger.debug('CP: '+cpimdb+' vs PTP: '+ptpimdb);

	if (cpimdb != ptpimdb)
		return fpstore.push(match.imdb, release.ptpid, function(err) {
			if (err) return logger.error('Cache-error: '+err);
			logger.info('Woops, IMDB from CouchPotato and PTP do not match - marked as a false positive for later');
		});

	logger.info('Found a movie we want: '+release.title+' ('+release.year+') - '+cpimdb+' - gonna tell CouchPotato to search for it...');
	if (test) return logger.info('This is where I tell CP to re-scan the movie, if I weren\'t in test-mode! :)');

	cp.reScanMovie(match._id, release.torrentid, function(err) {
		if (err) return logger.error('CP movie-scan error: '+err);
		logger.info('Movie scan-request sent to CouchPotato successfully!');

		hooks.notify(logger, 'download');
	});
}

function validateFreeleech(release, torrent, minsize, maxsize, test) {
	logger.debug('Making sure torrent is freeleech...');
	if (torrent.FreeleechType.trim().toLowerCase() != 'freeleech') return logger.error('Woops - seems torrent wasn\'t freeleech after all... Weird');

	logger.debug(release.title+' ('+release.year+') size: '+help.getSize(torrent.Size)+' - we want a max of '+help.getSize(maxsize));
	if (torrent.Size > maxsize) return logger.debug(release.title+' too large');

	logger.debug('Checking torrent-size - we want a min of '+help.getSize(minsize));
	if (torrent.Size < minsize) return logger.debug(release.title+' too small');

	logger.debug(release.title+' is good to go - requesting torrent-download');
	if (test) {
		logger.info('This is where I download the torrent to the freeleech-folder, if I weren\'t in test-mode! :)');
		return irc.freeleechDone(torrent.Size);
	}

	ptp.downloadTorrent(torrent.Id, config.ptp.ircwatch.freeleechDir, function(err) {
		if (err) return logger.error('PTP torrent-download error: '+err);

		logger.info('Freeleech torrent added: '+release.title+' ('+release.year+') - size: '+help.getSize(torrent.Size));
		irc.freeleechDone(torrent.Size);

		hooks.notify(logger, 'freeleech');
	});
}
