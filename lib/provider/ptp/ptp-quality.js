/*
 * Quality mapping from CouchPotato to PTP's announce channel
 * - Keys are quality-identifiers in CouchPotato
 * - 'display' is purely cosmetic and is used in the logs by Middleman
 * - 'source' is a regex of accepted sources from the IRC channel
 * - 'resolution' is a regex of accepted resolutions from the IRC channel
 * - 'container' is a regex of accepted containers from the IRC channel
 * - 'codec' is a regex of accepted codecs from the IRC channel
 *
 * If either 'source', 'resolution', 'container' or 'codec' is missing,
 * Middleman will assume wildcard .*
 *
 * ! Qualities has to be ordered descending, starting at the highest quality.
 * - F.ex BR-Rip needs to come after 720p/1080p otherwise Middleman
 *   would flag some 720p/1080p-announces as BR-Rips.
 *
 * ! Everything should be lower case, except names.
 *
 *	Available sources:
 *		blu-ray, dvd, cam, dvd-screener, hd-dvd, hdtv, r5, ts, tv
 *		vhs, web, other
 *
 *	Available codecs:
 *		xvid, divx, h.264, x264, dvd5, dvd9, bd25, bd50, other
 *
 *	Available containers:
 *		avi, mpg, mkv, mp4, vob ifo, iso, m2ts, other
 *
 *	Available resolutions:
 *		ntsc, pal, 480p, 576p, 720p, 1080p, 1080i, other
 */

module.exports = {
	'bd50': {
		'display': 'Blu-ray Disc',
		'source': 'blu-ray',
		'resolution': '1080p',
		'container': 'm2ts',
		'codec': 'bd25|bd50'
	},
	'1080p': {
		'display': '1080p',
		'source': 'blu-ray|hd-dvd|hdtv|web',
		'resolution': '1080p',
		'container': 'mkv|mp4',
		'codec': 'x264|h\.264'
	},
	'720p': {
		'display': '720p',
		'source': 'blu-ray|hd-dvd|hdtv|web',
		'resolution': '720p',
		'container': 'mkv|mp4',
		'codec': 'x264|h\.264'
	},
	'brrip': {
		'display': 'BR-Rip',
		'source': 'blu-ray',
		'resolution': '.*',
		'container': 'avi|mpg|mkv|mp4',
		'codec': 'xvid|divx|x264|h\.264'
	},
	'dvdr': {
		'display': 'DVD-R',
		'source': 'dvd',
		'resolution': 'ntsc|pal',
		'container': 'vbo ifo|iso',
		'codec': 'dvd5|dvd9'
	},
	'dvdrip': {
		'display': 'DVD-Rip',
		'source': 'dvd',
		'resolution': '.*',
		'container': 'avi|mpg|mkv|mp4',
		'codec': 'xvid|divx|x264|h\.264'
	},
	'scr': {
		'display': 'Screener',
		'source': 'dvd-screener',
		'resolution': '.*',
		'container': '.*',
		'codec': '.*'
	},
	'r5': {
		'display': 'R5',
		'source': 'r5',
		'resolution': '.*',
		'container': '.*',
		'codec': '.*'
	},
	'tc': {
		'display': 'TeleCine',
		'source': 'not-available',
		'resolution': 'not-available',
		'container': 'not-available',
		'codec': 'not-available'
	},
	'ts': {
		'display': 'TeleSync',
		'source': 'ts',
		'resolution': '.*',
		'container': '.*',
		'codec': '.*'
	},
	'cam': {
		'display': 'Cam',
		'source': 'cam',
		'resolution': '.*',
		'container': '.*',
		'codec': '.*'
	}
};
