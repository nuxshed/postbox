import type { dataset, enrichedfilm } from '$lib/pipeline/types';

export type erastats = {
	decadedist: { decade: number; label: string; count: number; avg: number; liked: number }[];
	releaseyears: { year: number; count: number; liked: number; avg: number; label: string; title: string }[];
	seasonal: { month: string; count: number; avg: number; liked: number }[];
	erahighlights: {
		label: string;
		count: number;
		avg: string;
		top: { name: string; director: string | null; rating: number } | null;
	}[];
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KEY_DECADES = [1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

export function computeera(data: dataset): erastats {
	const { films, diary } = data;

	// decade distribution
	const decademap = new Map<number, { count: number; ratings: number[]; liked: number }>();
	for (const f of films) {
		const decade = Math.floor(f.year / 10) * 10;
		if (!decademap.has(decade)) decademap.set(decade, { count: 0, ratings: [], liked: 0 });
		const e = decademap.get(decade)!;
		e.count += 1;
		if (f.rating !== null) e.ratings.push(f.rating);
		if (f.liked) e.liked += 1;
	}
	const decadedist = [...decademap.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([decade, { count, ratings, liked }]) => ({
			decade,
			label: "'" + String(decade).slice(2) + 's',
			count,
			liked,
			avg:
				ratings.length > 0
					? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
					: 0
		}))
		.filter((d) => d.count > 0);

	// release year distribution
	const yearmap = new Map<number, { count: number; liked: number; ratings: number[] }>();
	for (const f of films) {
		if (!yearmap.has(f.year)) yearmap.set(f.year, { count: 0, liked: 0, ratings: [] });
		const e = yearmap.get(f.year)!;
		e.count++;
		if (f.liked) e.liked++;
		if (f.rating !== null) e.ratings.push(f.rating);
	}
	const releaseyears = [...yearmap.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([year, { count, liked, ratings }]) => ({
			year,
			count,
			liked,
			avg: ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : 0,
			label: '',
			title: ''
		}));

	// seasonal patterns (by diary watch month)
	const likedset = new Set(films.filter((f) => f.liked).map((f) => `${f.name}|${f.year}`));
	const seasonal = MONTHS.map((month, i) => {
		const entries = diary.filter((e) => {
			const d = new Date((e.watcheddate || e.date) + 'T00:00:00');
			return d.getMonth() === i;
		});
		const ratings = entries.filter((e) => e.rating !== null).map((e) => e.rating!);
		const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
		const liked = [...new Set(entries.map((e) => `${e.name}|${e.year}`))].filter((k) => likedset.has(k)).length;
		return { month, count: entries.length, avg: Math.round(avg * 100) / 100, liked };
	});

	// era highlights: top-rated film per key decade
	const erahighlights = KEY_DECADES.map((decade) => {
		const label = decade + 's';
		const dd = decademap.get(decade);
		const count = dd?.count ?? 0;
		const avg =
			dd && dd.ratings.length > 0
				? (dd.ratings.reduce((a, b) => a + b, 0) / dd.ratings.length).toFixed(1)
				: '—';
		const candidates = films
			.filter((f) => Math.floor(f.year / 10) * 10 === decade && f.rating !== null)
			.sort((a, b) => b.rating! - a.rating!);
		const top = candidates[0] ?? null;
		return {
			label,
			count,
			avg,
			top: top
				? { name: top.name, director: top.tmdb?.director ?? null, rating: top.rating! }
				: null
		};
	});

	return { decadedist, releaseyears, seasonal, erahighlights };
}
