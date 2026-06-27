import type { dataset } from '$lib/pipeline/types';
import { displaycountry, TMDB_LANG } from '$lib/utils';

export type worldstats = {
	countrydist: { name: string; count: number; avg: number; liked: number }[];
	langdist: { code: string; name: string; count: number; avg: number; liked: number }[];
};

export function computeworld(data: dataset): worldstats {
	const { films } = data;

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
			if (f.rating !== null) e.ratings.push(f.rating);
			if (f.liked) e.liked += 1;
		}

		const rawCode = f.tmdb.language ? f.tmdb.language.toLowerCase() : null;
		const lang = rawCode ? (TMDB_LANG[rawCode] ?? null) : null;
		if (lang) {
			if (!langmap.has(lang)) langmap.set(lang, { code: rawCode!, count: 0, ratings: [], liked: 0 });
			const e = langmap.get(lang)!;
			e.count += 1;
			if (f.rating !== null) e.ratings.push(f.rating);
			if (f.liked) e.liked += 1;
		}
	}

	const countrydist = [...countrymap.entries()]
		.map(([name, { count, ratings, liked }]) => ({
			name,
			count,
			liked,
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
			avg:
				ratings.length > 0
					? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
					: 0
		}))
		.sort((a, b) => b.count - a.count);

	return { countrydist, langdist };
}
