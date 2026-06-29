import type { dataset, enrichedfilm } from '$lib/pipeline/types';

export type tagstat = { name: string; count: number; avg: number; liked: number };

export type tagstats = {
	tags: tagstat[];
	bycount: tagstat[];
	byrating: tagstat[];
	byliked: tagstat[];
	toptag: tagstat;
	totallogs: number;
	avgacross: number;
	taghighlights: {
		tag: string;
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

export function computetags(
	data: dataset,
	minthreshold = 20,
	metric?: 'rating' | 'liked' | 'count'
): tagstats {
	const { diary, films } = data;

	// build name+year → film rating from ratings.csv (already merged into film.rating)
	const filmrating = new Map<string, number | null>();
	for (const f of films) {
		filmrating.set(`${f.name}|${f.year}`, f.rating);
	}

	const likedset = new Set<string>();
	for (const f of films) {
		if (f.liked) likedset.add(`${f.name}|${f.year}`);
	}

	const tagmap = new Map<string, { films: Set<string>; ratings: number[]; liked: number }>();
	for (const entry of diary) {
		if (!entry.tags) continue;
		const tags = entry.tags
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		const filmKey = `${entry.name}|${entry.year}`;
		const rating = filmrating.get(filmKey) ?? entry.rating;
		for (const tag of tags) {
			if (!tagmap.has(tag)) {
				tagmap.set(tag, { films: new Set(), ratings: [], liked: 0 });
			}
			const e = tagmap.get(tag)!;
			if (!e.films.has(filmKey)) {
				e.films.add(filmKey);
				if (rating !== null && rating !== undefined && rating > 0) {
					e.ratings.push(rating);
				}
				if (likedset.has(filmKey)) e.liked += 1;
			}
		}
	}

	const tags = [...tagmap.entries()]
		.map(([name, { films: taggedFilms, ratings, liked }]) => ({
			name,
			count: taggedFilms.size,
			liked,
			avg:
				ratings.length > 0
					? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
					: 0
		}))
		.sort((a, b) => b.count - a.count);

	const totallogs = tags.reduce((s, t) => s + t.count, 0);
	const avgacross =
		tags.length > 0
			? Math.round((tags.reduce((s, t) => s + t.avg, 0) / tags.length) * 100) / 100
			: 0;

	// Diary/favorite utilities for ranking films
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

	// Active metric & fallback hierarchy
	const eligibleRated = tags.filter((t) => t.avg > 0);
	const eligibleLiked = tags.filter((t) => t.liked > 0);
	let activeMetric = metric;
	if (!activeMetric) {
		if (eligibleRated.length > 0) {
			activeMetric = 'rating';
		} else if (eligibleLiked.length > 0) {
			activeMetric = 'liked';
		} else {
			activeMetric = 'count';
		}
	}

	let selectedTags: tagstat[] = [];
	if (activeMetric === 'rating') {
		selectedTags = eligibleRated
			.slice()
			.sort((a, b) => b.avg - a.avg || b.count - a.count)
			.slice(0, 7);
	} else if (activeMetric === 'liked') {
		selectedTags = eligibleLiked
			.slice()
			.sort((a, b) => b.liked - a.liked || b.count - a.count)
			.slice(0, 7);
	} else {
		selectedTags = tags.slice(0, 7);
	}

	const taghighlights = selectedTags.map((t) => {
		const tagKeySet = tagmap.get(t.name)!.films;
		const candidates = films.filter((f) => tagKeySet.has(`${f.name}|${f.year}`));

		candidates.sort((a, b) => {
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

		const top = candidates[0] ?? null;
		return {
			tag: t.name,
			count: t.count,
			avg: t.avg > 0 ? t.avg.toFixed(1) : '—',
			liked: t.liked,
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

	return {
		tags,
		bycount: tags.slice(),
		byrating: tags.slice().sort((a, b) => b.avg - a.avg),
		byliked: tags.slice().sort((a, b) => b.liked - a.liked),
		toptag: tags[0] ?? { name: '—', count: 0, avg: 0, liked: 0 },
		totallogs,
		avgacross,
		taghighlights
	};
}
