import type { dataset } from '$lib/pipeline/types';
import { filmslug } from '$lib/utils';

export type overstats = {
	totalfilms: number;
	totalentries: number;
	rewatchcount: number;
	avgrating: number;
	hourstotal: number;
	daystotal: number;
	filmsthisyear: number;
	avgruntime: number;
	thisyear: number;
	ratingdist: { star: number; count: number; liked: number }[];
	runtimebuckets: { label: string; count: number; liked: number; avg: number }[];
	directors: { name: string; watched: number; avg: number; liked: number; ratedfilms: number }[];
	genres: { name: string; count: number; avg: number; liked: number }[];
	totalliked: number;
	avgratliked: number;
	avgruntimeliked: number;
	avgruntimefivestar: number;
	fivestartotal: number;
	hasratings: boolean;
	haslikes: boolean;
	insights: { k: string; v: string; sub: string; href?: string; subhref?: string }[];
};

const STARS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

const RT_BUCKETS = [
	{ label: '< 80m', lo: 0, hi: 80 },
	{ label: '80–99m', lo: 80, hi: 100 },
	{ label: '100–119m', lo: 100, hi: 120 },
	{ label: '120–139m', lo: 120, hi: 140 },
	{ label: '140–159m', lo: 140, hi: 160 },
	{ label: '160–179m', lo: 160, hi: 180 },
	{ label: '180m+', lo: 180, hi: Infinity }
];

/** compute all overview stats from the pipeline dataset */
export function computeoverview(data: dataset): overstats {
	const { films, diary } = data;
	const thisyear = new Date().getFullYear();

	// rating distribution
	const ratingmap = new Map<number, { count: number; liked: number }>(STARS.map((s) => [s, { count: 0, liked: 0 }]));
	let ratingsum = 0,
		ratingcount = 0;
	for (const f of films) {
		if (f.rating === null) continue;
		const bucket = Math.round(f.rating * 2) / 2;
		const key = STARS.find((s) => Math.abs(s - bucket) < 0.01) ?? bucket;
		const e = ratingmap.get(key) ?? { count: 0, liked: 0 };
		e.count++;
		if (f.liked) e.liked++;
		ratingmap.set(key, e);
		ratingsum += f.rating;
		ratingcount++;
	}
	const ratingdist = STARS.map((star) => ({ star, ...(ratingmap.get(star) ?? { count: 0, liked: 0 }) }));
	const avgrating = ratingcount > 0 ? ratingsum / ratingcount : 0;

	// runtime distribution
	const runtimes = films.map((f) => f.tmdb?.runtime).filter((r): r is number => r != null && r > 0);
	const runtimebuckets = RT_BUCKETS.map((b) => {
		const inbucket = films.filter((f) => f.tmdb?.runtime != null && f.tmdb.runtime >= b.lo && f.tmdb.runtime < b.hi);
		const ratings = inbucket.map((f) => f.rating).filter((r): r is number => r != null);
		return {
			label: b.label,
			count: inbucket.length,
			liked: inbucket.filter((f) => f.liked).length,
			avg: ratings.length > 0 ? Math.round((ratings.reduce((a, r) => a + r, 0) / ratings.length) * 100) / 100 : 0
		};
	});
	const avgruntime =
		runtimes.length > 0 ? Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length) : 0;

	// totals
	const totalentries = diary.length;
	const rewatchcount = diary.filter((d) => d.rewatch).length;
	const hourstotal = Math.round((avgruntime * totalentries) / 60);
	const daystotal = Math.round(hourstotal / 24);

	const filmsthisyear = diary.filter((d) => {
		const y = new Date(d.watcheddate || d.date).getFullYear();
		return y === thisyear;
	}).length;

	// directors
	const dirmap = new Map<string, { watched: number; ratings: number[]; liked: number }>();
	for (const f of films) {
		const dir = f.tmdb?.director;
		if (!dir) continue;
		if (!dirmap.has(dir)) dirmap.set(dir, { watched: 0, ratings: [], liked: 0 });
		const e = dirmap.get(dir)!;
		e.watched += 1;
		if (f.rating !== null) e.ratings.push(f.rating);
		if (f.liked) e.liked += 1;
	}
	const directors = [...dirmap.entries()]
		.map(([name, { watched, ratings, liked }]) => ({
			name,
			watched,
			liked,
			ratedfilms: ratings.length,
			avg: ratings.length
				? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
				: 0
		}))
		.sort((a, b) => b.watched - a.watched);

	// genres
	const genremap = new Map<string, { count: number; ratings: number[]; liked: number }>();
	for (const f of films) {
		for (const g of f.tmdb?.genres ?? []) {
			if (!genremap.has(g)) genremap.set(g, { count: 0, ratings: [], liked: 0 });
			const e = genremap.get(g)!;
			e.count += 1;
			if (f.rating !== null) e.ratings.push(f.rating);
			if (f.liked) e.liked += 1;
		}
	}
	const genres = [...genremap.entries()]
		.map(([name, { count, ratings, liked }]) => ({
			name,
			count,
			liked,
			avg: ratings.length
				? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
				: 0
		}))
		.sort((a, b) => b.count - a.count);

	// insights
	const decademap = new Map<string, number>();
	for (const f of films) {
		const decade = Math.floor(f.year / 10) * 10 + 's';
		decademap.set(decade, (decademap.get(decade) ?? 0) + 1);
	}
	const topdecade = [...decademap.entries()].sort((a, b) => b[1] - a[1])[0];

	const withruntime = films.filter((f) => f.tmdb?.runtime);
	const longestfilm = withruntime.sort((a, b) => b.tmdb!.runtime! - a.tmdb!.runtime!)[0];

	const noneng = films.filter((f) => f.tmdb?.language && f.tmdb.language !== 'en').length;
	const subtitledpct = films.length > 0 ? Math.round((noneng / films.length) * 100) : 0;

	const pre1970 = films.filter((f) => f.year < 1970).length;
	const pre1970pct = films.length > 0 ? Math.round((pre1970 / films.length) * 100) : 0;

	const liked = films.filter((f) => f.rating !== null && f.rating >= 4).length;
	const likedpct = films.length > 0 ? Math.round((liked / films.length) * 100) : 0;

	const rewatchpct = totalentries > 0 ? Math.round((rewatchcount / totalentries) * 100) : 0;

	const topdir = directors[0];

	const insights: overstats['insights'] = [
		topdir
			? { k: 'Most-watched director', v: topdir.name, sub: topdir.watched + ' film' + (topdir.watched === 1 ? '' : 's'), href: `/films?director=${encodeURIComponent(topdir.name)}` }
			: { k: 'Most-watched director', v: '—', sub: 'no data yet' },
		topdecade
			? { k: 'Signature decade', v: topdecade[0], sub: topdecade[1] + ' films', href: `/films?decade=${parseInt(topdecade[0])}` }
			: { k: 'Signature decade', v: '—', sub: 'no data yet' },
		{ k: 'Avg. runtime', v: avgruntime + ' min', sub: 'across all logged films' },
		longestfilm?.tmdb?.runtime
			? {
					k: 'Longest sit',
					v:
						Math.floor(longestfilm.tmdb.runtime / 60) +
						'h ' +
						(longestfilm.tmdb.runtime % 60) +
						'm',
					sub: longestfilm.name,
					subhref: `/films/${filmslug(longestfilm.uri)}`
				}
			: { k: 'Longest sit', v: '—', sub: 'no runtime data' },
		{ k: 'Subtitled', v: subtitledpct + '%', sub: 'of everything you watch' },
		{ k: 'Liked rate', v: likedpct + '%', sub: 'films you rated 4 stars or higher' },
		{ k: 'Pre-1970 cinema', v: pre1970pct + '%', sub: 'a real taste for the classics' },
		{ k: 'Rewatch rate', v: rewatchpct + '%', sub: 'you return to your favorites' }
	];

	const hasratings = films.some((f) => f.rating !== null);
	const haslikes = films.some((f) => f.liked);
	const totalliked = films.filter((f) => f.liked).length;

	const likedratings = films.filter((f) => f.liked && f.rating !== null).map((f) => f.rating as number);
	const avgratliked = likedratings.length > 0 ? Math.round((likedratings.reduce((a, b) => a + b, 0) / likedratings.length) * 100) / 100 : 0;

	const fivestarfilms = films.filter((f) => f.rating === 5 && f.tmdb?.runtime);
	const fivestartotal = fivestarfilms.length;
	const avgruntimefivestar = fivestartotal > 0 ? Math.round(fivestarfilms.reduce((a, f) => a + f.tmdb!.runtime!, 0) / fivestartotal) : 0;

	const likedruntimes = films.filter((f) => f.liked && f.tmdb?.runtime).map((f) => f.tmdb!.runtime as number);
	const avgruntimeliked = likedruntimes.length > 0 ? Math.round(likedruntimes.reduce((a, b) => a + b, 0) / likedruntimes.length) : 0;

	return {
		totalfilms: films.length,
		totalentries,
		rewatchcount,
		avgrating: Math.round(avgrating * 100) / 100,
		hourstotal,
		daystotal,
		filmsthisyear,
		avgruntime,
		thisyear,
		ratingdist,
		runtimebuckets,
		directors,
		genres,
		totalliked,
		avgratliked,
		avgruntimeliked,
		avgruntimefivestar,
		fivestartotal,
		hasratings,
		haslikes,
		insights
	};
}

export function fmtnum(n: number): string {
	return n.toLocaleString('en-US');
}
