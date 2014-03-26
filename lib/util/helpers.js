exports.objectSize = function(obj) {
	var s = 0;
	for (var i in obj)
		if (obj.hasOwnProperty(i)) s++;
	return s;
};

exports.endsWith = function(str, suffix) {
	if (str.indexOf(suffix, (str.length-suffix.length)) !== -1) return true;
	return false;
};

function sim(first, second, percent) {
	// http://kevin.vanzonneveld.net
	// +   original by: Rafa Kukawski (http://blog.kukawski.pl)
	// +   bugfixed by: Chris McMacken
	// +   added percent parameter by: Markus Padourek (taken from http://www.kevinhq.com/2012/06/php-similartext-function-in-javascript_16.html)
	// *     example 1: similar_text('Hello World!', 'Hello phpjs!');
	// *     returns 1: 7
	// *     example 2: similar_text('Hello World!', null);
	// *     returns 2: 0
	// *     example 3: similar_text('Hello World!', null, 1);
	// *     returns 3: 58.33
	if (first === null || second === null || typeof first === 'undefined' || typeof second === 'undefined') {
		return 0;
	}

	first += '';
	second += '';

	var pos1 = 0,
	pos2 = 0,
	max = 0,
	firstLength = first.length,
	secondLength = second.length,
	p, q, l, sum;

	max = 0;

	for (p = 0; p < firstLength; p++) {
		for (q = 0; q < secondLength; q++) {
			for (l = 0;
				(p + l < firstLength) && (q + l < secondLength) && (first.charAt(p + l) === second.charAt(q + l)); l++);
			if (l > max) {
				max = l;
				pos1 = p;
				pos2 = q;
			}
		}
	}

	sum = max;

	if (sum) {
		if (pos1 && pos2) {
			sum += sim(first.substr(0, pos2), second.substr(0, pos2));
		}

		if ((pos1 + max < firstLength) && (pos2 + max < secondLength)) {
			sum += sim(first.substr(pos1 + max, firstLength - pos1 - max), second.substr(pos2 + max, secondLength - pos2 - max));
		}
	}

	if (!percent) {
		return sum;
	} else {
		return (sum * 200) / (firstLength + secondLength);
	}
}

exports.sim = function(first, second, percent) {
	return sim(first, second, percent);
};

function timeToString(time) {
	if (time < 60)
		return time+' seconds';
	if (time < 3600)
		return (Math.round((time/60)*100)/100)+' minutes';
	if (time < 86400)
		return (Math.round((time/3600)*100)/100)+' hours';
	return (Math.round((time/86400)*100)/100)+' days';
}

exports.timeDiff = function(then) {
	var now = Math.round(new Date().getTime() / 1000);
	return timeToString(now-then);
};

exports.tts = function(time) {
	return timeToString(time);
};

exports.inArray = function(needle, haystack) {
	if (haystack.length > 0) {
		for (var i in haystack) {
			if (haystack[i] == needle) return true;
		}
	}
	return false;
};

exports.getSeconds = function(num, suffix) {
	switch (suffix.toLowerCase()) {
		case 'm':
			return (num*60);
		case 'h':
			return (num*60*60);
		case 'd':
			return (num*60*60*24);
	}
	return num;
};

exports.getBytes = function(size, suffix) {
	switch (suffix.toLowerCase()) {
		case 'k':
			return (size*1024);
		case 'm':
			return (size*1024*1024);
		case 'g':
			return (size*1024*1024*1024);
		case 't':
			return (size*1024*1024*1024*1024);
	}
	return 0;
};

exports.getSize = function(bytes) {
	if (bytes > (1024*1024*1024*1024))
		return (Math.round((bytes/(1024*1024*1024*1024))*100)/100)+'TB';
	if (bytes > (1024*1024*1024))
		return (Math.round((bytes/(1024*1024*1024))*100)/100)+'GB';
	if (bytes > (1024*1024))
		return (Math.round((bytes/(1024*1024))*100)/100)+'MB';
	if (bytes > 1024)
		return (Math.round((bytes/1024)*100)/100)+'KB';

	return bytes+'B';
};

exports.pad = function(n) {
	return (n<10) ? ('0'+n) : n;
};

exports.loggerLabel = function(logger) {
	return logger.transports[Object.keys(logger.transports)[0]].label.toLowerCase();
};

exports.exit = function(m) {
	console.error('[!] %s', m);
	process.exit(1);
};
