var path = require('path');
var vars = {};

if (process.platform.match(/^win/)) {
	vars = {
		'platform': 'win',
		'user': process.env.USERNAME,
		'home': path.join(process.env.LOCALAPPDATA, 'middleman'),
		'data': path.join(process.env.LOCALAPPDATA, 'middleman/data'),
		'logs': path.join(process.env.LOCALAPPDATA, 'middleman/logs'),
		'temp': path.join(process.env.LOCALAPPDATA, 'middleman/temp')
	};
}
else if (process.platform.match(/^linux/)) {
	vars = {
		'platform': 'linux',
		'user': process.env.USER,
		'home': path.join(process.env.HOME, '.middleman'),
		'data': path.join(process.env.HOME, '.middleman/data'),
		'logs': path.join(process.env.HOME, '.middleman/logs'),
		'temp': path.join(process.env.HOME, '.middleman/temp')
	};
}
else if (process.platform.match(/^darwin|^freebsd/)) {
	vars = {
		'platform': 'freebsd',
		'user': process.env.USER,
		'home': path.join(process.env.HOME, '.middleman'),
		'data': path.join(process.env.HOME, '.middleman/data'),
		'logs': path.join(process.env.HOME, '.middleman/logs'),
		'temp': path.join(process.env.HOME, '.middleman/temp')
	};
}
else {
	console.error('[!] I don\'t want to run on your platform.');
	process.exit(1);
}

module.exports = vars;
