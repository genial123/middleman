var init = require('./init');
var help = require('./utils/helpers');

init.init(function(err) {
	if (err) {
		console.error('[!] %s', err);
		process.exit(1);
	}

	var config = require('./utils/config');
	var logger = require('./utils/logger').get('dispatch');
	var git = require('./utils/git');
	var cleanup = require('./utils/cleanup');

	var ptpirc;
	var ptpanti;
	var btnirc;

	/*
	 * Check version
	 */
	git.check(function(err) {
		if (err) logger.info(err);

		/*
		 * Module dispatch
		 */
		if (config.ptp.ircwatch.enabled) {
			logger.info('Starting module PTPIRC');
			ptpirc = require('./module/ptpirc');
		}

		if (config.ptp.antitrump.enabled) {
			logger.info('Starting module PTPANTITRUMP');
			ptpanti = require('./module/ptpanti');
		}

		if (config.btn.ircwatch.enabled) {
			logger.info('Starting module BTNIRC');
			btnirc = require('./module/btnirc');
		}

		/*
		 * Logs+data-cleanup
		 */
		setInterval(function() {
			logger.info('Cleaning up a little bit...');
			cleanup.clean();
		}, (1000*60*60*24));
	});
});

