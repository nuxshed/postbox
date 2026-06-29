import type { dataset, enrichedfilm } from '$lib/pipeline/types';
import { displaycountry, TMDB_LANG } from '$lib/utils';

export type worldstats = {
	countrydist: { name: string; count: number; avg: number; liked: number; ratingsCount: number }[];
	langdist: { code: string; name: string; count: number; avg: number; liked: number; ratingsCount: number }[];
	countryhighlights: {
		country: string;
		count: number;
		avg: string;
		liked: number;
		top: {
			name: string;
			director: string | null;
			rating: number | null;
			poster: string | null;
			uri: string;
		} | null;
	}[];
	langhighlights: {
		code: string;
		language: string;
		count: number;
		avg: string;
		liked: number;
		top: {
			name: string;
			director: string | null;
			rating: number | null;
			poster: string | null;
			uri: string;
		} | null;
	}[];
};

export function computeworld(
	data: dataset,
	minthreshold = 20,
	countryMetric?: 'rating' | 'liked' | 'count',
	langMetric?: 'rating' | 'liked' | 'count',
	rangeKind?: string
): worldstats {
	const { films, diary } = data;

	const countrymap = new Map<string, { count: number; ratings: number[]; liked: number }>();
	const langmap = new Map<string, { code: string; count: number; ratings: number[]; liked: number }>();

	for (const f of films) {
		if (!f.tmdb) continue;

		for (const c of f.tmdb.countries) {
			if (!c) continue;
			const name = displaycountry(c);
			if (!countrymap.has(name)) countrymap.set(name, { count: 0, ratings: [], liked: 0 });
			const e = countrymap.get(name)!;
			e.count += 1;
			if (f.rating !== null && f.rating > 0) e.ratings.push(f.rating);
			if (f.liked) e.liked += 1;
		}

		const rawCode = f.tmdb.language ? f.tmdb.language.toLowerCase() : null;
		const lang = rawCode ? (TMDB_LANG[rawCode] ?? null) : null;
		if (lang) {
			if (!langmap.has(lang)) langmap.set(lang, { code: rawCode!, count: 0, ratings: [], liked: 0 });
			const e = langmap.get(lang)!;
			e.count += 1;
			if (f.rating !== null && f.rating > 0) e.ratings.push(f.rating);
			if (f.liked) e.liked += 1;
		}
	}

	const countrydist = [...countrymap.entries()]
		.map(([name, { count, ratings, liked }]) => ({
			name,
			count,
			liked,
			ratingsCount: ratings.length,
			avg:
				ratings.length > 0
					? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
					: 0
		}))
		.sort((a, b) => b.count - a.count);

	const langdist = [...langmap.entries()]
		.map(([name, { code, count, ratings, liked }]) => ({
			code,
			name,
			count,
			liked,
			ratingsCount: ratings.length,
			avg:
				ratings.length > 0
					? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
					: 0
		}))
		.sort((a, b) => b.count - a.count);

	// Diary/favorite utilities for ranking
	const diarycounts = new Map<string, { count: number; hasfirst: boolean }>();
	const maxDateMap = new Map<string, string>();

	for (const e of diary) {
		const k = `${e.name}|${e.year}`;
		if (!diarycounts.has(k)) diarycounts.set(k, { count: 0, hasfirst: false });
		const entry = diarycounts.get(k)!;
		entry.count++;
		if (!e.rewatch) entry.hasfirst = true;

		const dateVal = e.watcheddate || e.date;
		if (dateVal) {
			const prevMax = maxDateMap.get(k) ?? '';
			if (dateVal > prevMax) {
				maxDateMap.set(k, dateVal);
			}
		}
	}

	const getRewatchTimes = (k: string) => {
		const entry = diarycounts.get(k);
		if (!entry) return 1;
		return entry.hasfirst ? entry.count : entry.count + 1;
	};

	const getLatestWatchDate = (f: enrichedfilm) => {
		const k = `${f.name}|${f.year}`;
		return maxDateMap.get(k) || f.lastwatched || f.firstwatched || '';
	};

	const favSet = new Set(data.profile?.favoriteFilms ?? []);

	const rankFilms = (candidates: enrichedfilm[]) => {
		return candidates.slice().sort((a, b) => {
			const rA = a.rating ?? 0;
			const rB = b.rating ?? 0;
			if (rB !== rA) return rB - rA;

			const favA = favSet.has(a.uri) ? 1 : 0;
			const favB = favSet.has(b.uri) ? 1 : 0;
			if (favB !== favA) return favB - favA;

			const rwA = getRewatchTimes(`${a.name}|${a.year}`);
			const rwB = getRewatchTimes(`${b.name}|${b.year}`);
			if (rwB !== rwA) return rwB - rwA;

			const dateA = getLatestWatchDate(a);
			const dateB = getLatestWatchDate(b);
			return dateB.localeCompare(dateA);
		});
	};

	// 1. Calculate Country Highlights
	const eligibleCountryRated = countrydist.filter((c) => {
		const minRated = rangeKind === 'all' ? 3 : 1;
		return c.avg > 0 && c.ratingsCount >= minRated;
	});
	const eligibleCountryLiked = countrydist.filter((c) => c.liked > 0);
	let activeCountryMetric = countryMetric;
	if (!activeCountryMetric) {
		if (eligibleCountryRated.length > 0) {
			activeCountryMetric = 'rating';
		} else if (eligibleCountryLiked.length > 0) {
			activeCountryMetric = 'liked';
		} else {
			activeCountryMetric = 'count';
		}
	}

	let selectedCountries: typeof countrydist = [];
	if (activeCountryMetric === 'rating') {
		selectedCountries = eligibleCountryRated
			.slice()
			.sort((a, b) => b.avg - a.avg || b.count - a.count)
			.slice(0, 6);
	} else if (activeCountryMetric === 'liked') {
		selectedCountries = eligibleCountryLiked
			.slice()
			.sort((a, b) => b.liked - a.liked || b.count - a.count)
			.slice(0, 6);
	} else {
		selectedCountries = countrydist.slice(0, 6);
	}

	const countryhighlights = selectedCountries.map((c) => {
		const candidates = films.filter(
			(f) => f.tmdb && f.tmdb.countries.map(displaycountry).includes(c.name)
		);
		const sorted = rankFilms(candidates);
		const top = sorted[0] ?? null;
		return {
			country: c.name,
			count: c.count,
			avg: c.avg > 0 ? c.avg.toFixed(1) : '—',
			liked: c.liked,
			top: top
				? {
						name: top.name,
						director: top.tmdb?.director ?? null,
						rating: top.rating,
						poster: top.tmdb?.poster ?? null,
						uri: top.uri
					}
				: null
		};
	});

	// 2. Calculate Language Highlights
	const eligibleLangRated = langdist.filter((l) => {
		const minRated = rangeKind === 'all' ? 3 : 1;
		return l.avg > 0 && l.ratingsCount >= minRated;
	});
	const eligibleLangLiked = langdist.filter((l) => l.liked > 0);
	let activeLangMetric = langMetric;
	if (!activeLangMetric) {
		if (eligibleLangRated.length > 0) {
			activeLangMetric = 'rating';
		} else if (eligibleLangLiked.length > 0) {
			activeLangMetric = 'liked';
		} else {
			activeLangMetric = 'count';
		}
	}

	let selectedLangs: typeof langdist = [];
	if (activeLangMetric === 'rating') {
		selectedLangs = eligibleLangRated
			.slice()
			.sort((a, b) => b.avg - a.avg || b.count - a.count)
			.slice(0, 6);
	} else if (activeLangMetric === 'liked') {
		selectedLangs = eligibleLangLiked
			.slice()
			.sort((a, b) => b.liked - a.liked || b.count - a.count)
			.slice(0, 6);
	} else {
		selectedLangs = langdist.slice(0, 6);
	}

	const langhighlights = selectedLangs.map((l) => {
		const candidates = films.filter((f) => {
			if (!f.tmdb || !f.tmdb.language) return false;
			const code = f.tmdb.language.toLowerCase();
			const name = TMDB_LANG[code];
			return name === l.name;
		});
		const sorted = rankFilms(candidates);
		const top = sorted[0] ?? null;
		return {
			code: l.code,
			language: l.name,
			count: l.count,
			avg: l.avg > 0 ? l.avg.toFixed(1) : '—',
			liked: l.liked,
			top: top
				? {
						name: top.name,
						director: top.tmdb?.director ?? null,
						rating: top.rating,
						poster: top.tmdb?.poster ?? null,
						uri: top.uri
					}
				: null
		};
	});

	return { countrydist, langdist, countryhighlights, langhighlights };
}
