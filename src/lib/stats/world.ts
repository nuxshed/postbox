import type { dataset } from '$lib/pipeline/types';
import { displaycountry } from '$lib/utils';

export type worldstats = {
	countrydist: { name: string; count: number; avg: number }[];
	langdist: { name: string; count: number; avg: number }[];
};

// TMDB original_language code → display name
// cn is TMDB's non-standard code for Cantonese (used for HK films)
const TMDB_LANG: Record<string, string> = {
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

export function computeworld(data: dataset): worldstats {
	const { films } = data;

	const countrymap = new Map<string, { count: number; ratings: number[] }>();
	const langmap = new Map<string, { count: number; ratings: number[] }>();

	for (const f of films) {
		if (!f.tmdb) continue;

		for (const c of f.tmdb.countries) {
			if (!c) continue;
			const name = displaycountry(c);
			if (!countrymap.has(name)) countrymap.set(name, { count: 0, ratings: [] });
			const e = countrymap.get(name)!;
			e.count += 1;
			if (f.rating !== null) e.ratings.push(f.rating);
		}

		const lang = f.tmdb.language ? (TMDB_LANG[f.tmdb.language.toLowerCase()] ?? null) : null;
		if (lang) {
			if (!langmap.has(lang)) langmap.set(lang, { count: 0, ratings: [] });
			const e = langmap.get(lang)!;
			e.count += 1;
			if (f.rating !== null) e.ratings.push(f.rating);
		}
	}

	function tolist(map: Map<string, { count: number; ratings: number[] }>) {
		return [...map.entries()]
			.map(([name, { count, ratings }]) => ({
				name,
				count,
				avg:
					ratings.length > 0
						? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
						: 0
			}))
			.sort((a, b) => b.count - a.count);
	}

	return { countrydist: tolist(countrymap), langdist: tolist(langmap) };
}
