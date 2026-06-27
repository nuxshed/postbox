/** extract letterboxd film slug from uri (handles both full and boxd.it short URLs) */
export function filmslug(uri: string): string {
	const full = uri.match(/\/film\/([^/?#]+)/);
	if (full) return full[1];
	const short = uri.match(/boxd\.it\/([^/?#]+)/);
	if (short) return short[1];
	return encodeURIComponent(uri);
}

const COUNTRY_DISPLAY: Record<string, string> = {
	'United States of America': 'USA',
	'United Kingdom': 'UK',
	'Russian Federation': 'Russia',
	'Taiwan, Province of China': 'Taiwan',
	'Iran, Islamic Republic of': 'Iran',
	"Korea, Democratic People's Republic of": 'North Korea',
	'Korea, Republic of': 'South Korea',
	'Viet Nam': 'Vietnam',
	'Syrian Arab Republic': 'Syria',
	'Bolivia, Plurinational State of': 'Bolivia',
	'Venezuela, Bolivarian Republic of': 'Venezuela',
	'Palestinian Territory': 'Palestine'
};

/** normalize a raw TMDB country name to the display name used in stats/filters */
export function displaycountry(name: string): string {
	return COUNTRY_DISPLAY[name] ?? name;
}

/** build tmdb image url from poster path */
export function tmdbposter(path: string | null | undefined, size = 'w300'): string | null {
	if (!path) return null;
	return `https://image.tmdb.org/t/p/${size}${path}`;
}

/** TMDB original_language code → display name */
export const TMDB_LANG: Record<string, string> = {
	af: 'Afrikaans',
	ar: 'Arabic',
	bg: 'Bulgarian',
	bn: 'Bengali',
	cn: 'Cantonese',
	cs: 'Czech',
	da: 'Danish',
	de: 'German',
	el: 'Greek',
	en: 'English',
	es: 'Spanish',
	fa: 'Persian',
	fi: 'Finnish',
	fr: 'French',
	he: 'Hebrew',
	hi: 'Hindi',
	hr: 'Croatian',
	hu: 'Hungarian',
	hy: 'Armenian',
	id: 'Indonesian',
	is: 'Icelandic',
	it: 'Italian',
	ja: 'Japanese',
	ka: 'Georgian',
	ko: 'Korean',
	lt: 'Lithuanian',
	lv: 'Latvian',
	ml: 'Malayalam',
	mn: 'Mongolian',
	mr: 'Marathi',
	ms: 'Malay',
	my: 'Burmese',
	nb: 'Norwegian',
	nl: 'Dutch',
	no: 'Norwegian',
	pa: 'Punjabi',
	pl: 'Polish',
	pt: 'Portuguese',
	ro: 'Romanian',
	ru: 'Russian',
	sk: 'Slovak',
	sl: 'Slovenian',
	sq: 'Albanian',
	sr: 'Serbian',
	sv: 'Swedish',
	ta: 'Tamil',
	te: 'Telugu',
	th: 'Thai',
	tr: 'Turkish',
	uk: 'Ukrainian',
	ur: 'Urdu',
	vi: 'Vietnamese',
	yi: 'Yiddish',
	yue: 'Cantonese',
	zh: 'Mandarin',
	xx: 'Silent'
};

/** normalize a raw TMDB language code to the display name used in stats/filters */
export function displaylanguage(code: string): string {
	return TMDB_LANG[code.toLowerCase()] ?? code;
}

/** star string for a rating (0.5–5) */
export function starlabel(rating: number): string {
	const full = Math.floor(rating);
	const half = rating % 1 >= 0.5 ? 1 : 0;
	return full.toFixed(0) + (half ? '.5' : '') + ' ★';
}

