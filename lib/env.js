var path = require('path');
var vars = {};

if (process.platform.match(/^win/)) {
	var data = process.env._datadir || path.join(process.env.LOCALAPPDATA, 'middleman');
	
	vars = {
		platform: 'win',
		user: process.env.USERNAME,
		uid: 1000,
		home: path.normalize(data),
		data: path.join(data, 'data'),
		logs: path.join(data, 'logs'),
		temp: path.join(data, 'temp')
	};
}
else if (process.platform.match(/^linux/)) {
	var data = process.env._datadir || path.join(process.env.HOME, '.middleman');

	vars = {
		platform: 'linux',
		user: process.env.USER,
		uid: process.getuid(),
		home: path.normalize(data),
		data: path.join(data, 'data'),
		logs: path.join(data, 'logs'),
		temp: path.join(data, 'temp')
	};
}
else if (process.platform.match(/^darwin|^freebsd/)) {
	var data = process.env._datadir || path.join(process.env.HOME, '.middleman');

	vars = {
		platform: 'freebsd',
		user: process.env.USER,
		uid: process.getuid(),
		home: path.normalize(data),
		data: path.join(data, 'data'),
		logs: path.join(data, 'logs'),
		temp: path.join(data, 'temp')
	};
}
else {
	console.error('[!] I don\'t want to run on your platform.');
	process.exit(1);
}

module.exports = vars;
