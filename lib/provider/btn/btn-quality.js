/*
 * Quality mapping from SickBeard to BTN's announce channel
 * - Keys are quality-identifiers in SickBeard
 * - 'display' is purely cosmetic and is used in the logs by PTPCPH
 * - 'sickname' is used to match qualities with SickBeard, don't change this
 * - 'source' is a regex of accepted sources from the IRC channel
 * - 'resolution' is a regex of accepted resolutions from the IRC channel
 * - 'container' is a regex of accepted containers from the IRC channel
 * - 'codec' is a regex of accepted codecs from the IRC channel
 *
 * If either 'source', 'resolution', 'container' or 'codec' is missing,
 * Middleman will assume wildcard .*
 *
 * ! Qualities has to be in descending order, starting at the highest quality.
 * - This is how PTPCPH decides if a release trumps another or not.
 *
 * ! Everything should be lower case, except names.
 *
 *	Available sources:
 *		hdtv, pdtv, dsr, dvdrip, tvrip, vhsrip, bluray, bdrip, brrip, dvd5,
 *		dvd9, hddvd, web-dl, webrip, bd5, bd9, bd25, bd50, mixed, unknown
 *
 *	Available codecs:
 *		xvid, x264, mpeg2, divx, dvdr, vc-1, h.264, wmv, bd, x264-hi10p
 *
 *	Available containers:
 *		avi, mkv, vob, mpeg, mp4, iso, wmv, ts, m4v, m2ts
 *
 *	Available resolutions:
 *		sd, 720p, 1080p, 1080i, portable device
 */

exports.mapping = {
	'rawhdtv': {
		'display': 'Raw HDTV',
		'sickname': 'rawhd tv',
		'source': 'hdtv',
		'resolution': '1080i'
	},
	'fullhdbluray': {
		'display': '1080p Blu-ray',
		'sickname': '1080p bluray',
		'source': 'bluray',
		'resolution': '1080p'
	},
	'fullwebdl': {
		'display': '1080p WEB-DL',
		'sickname': '1080p web-dl',
		'source': 'web-dl|webrip',
		'resolution': '1080p'
	},
	'fullhdtv': {
		'display': '1080p HDTV',
		'sickname': '1080p hd tv',
		'source': 'hdtv',
		'resolution': '1080p'
	},
	'hdbluray': {
		'display': '720p Blu-ray',
		'sickname': '720p bluray',
		'source': 'bluray',
		'resolution': '720p'
	},
	'hdwebdl': {
		'display': '720p WEB-DL',
		'sickname': '720p web-dl',
		'source': 'web-dl|webrip',
		'resolution': '720p'
	},
	'hdtv': {
		'display': 'HDTV',
		'sickname': 'hd tv',
		'source': 'hdtv',
		'resolution': '720p'
	},
	'sddvd': {
		'display': 'SDDVD',
		'sickname': 'sd dvd',
		'source': 'dvdrip|bdrip',
		'resolution': 'sd'
	},
	'sdtv': {
		'display': 'SDTV',
		'sickname': 'sd tv',
		'source': 'hdtv|pdtv|web-dl|webrip|bluray|tvrip',
		'resolution': 'sd'
	}
};
