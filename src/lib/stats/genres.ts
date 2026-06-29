import type { dataset, enrichedfilm } from '$lib/pipeline/types';

export type genrestat = { name: string; count: number; avg: number; liked: number };

export type genrestats = {
	genrecount: genrestat[];
	topwatched: genrestat[];
	toprated: genrestat[];
	topliked: genrestat[];
	topgenre: genrestat;
	topratedgenre: genrestat;
	toplikedgenre: genrestat;
	nichescore: number;
	nichedesc: string;
	subtitledpct: number;
	totalgenres: number;
	genrehighlights: {
		genre: string;
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
	genreSelectionMethod: 'rating' | 'liked' | 'count';
};

export function computegenres(data: dataset, minthreshold = 20, metric?: 'rating' | 'liked' | 'count'): genrestats {
	const { films, diary } = data;

	const genremap = new Map<string, { count: number; ratings: number[]; liked: number }>();
	for (const f of films) {
		if (!f.tmdb) continue;
		for (const g of f.tmdb.genres) {
			if (!genremap.has(g)) genremap.set(g, { count: 0, ratings: [], liked: 0 });
			const e = genremap.get(g)!;
			e.count += 1;
			if (f.rating !== null && f.rating > 0) e.ratings.push(f.rating);
			if (f.liked) e.liked += 1;
		}
	}

	const genrecount = [...genremap.entries()]
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

	const topwatched = genrecount.slice(0, 10);
	const toprated = genrecount
		.filter((g) => g.count >= minthreshold)
		.sort((a, b) => b.avg - a.avg)
		.slice(0, 10);
	const topliked = genrecount.slice().sort((a, b) => b.liked - a.liked).slice(0, 10);

	const enriched = films.filter((f) => f.tmdb);
	const pops = enriched.map((f) => f.tmdb!.popularity);
	const avgpop = pops.length > 0 ? pops.reduce((a, b) => a + b, 0) / pops.length : 50;
	const nichescore = Math.round(Math.max(0, Math.min(100, 100 - avgpop / 2)));

	const noneng = enriched.filter((f) => f.tmdb!.language !== 'en').length;
	const subtitledpct = enriched.length > 0 ? Math.round((noneng / enriched.length) * 100) : 0;

	const nichedesc =
		nichescore >= 75
			? `Deep arthouse lean — ${subtitledpct}% subtitled, strong preference for festival and criterion cinema.`
			: nichescore >= 50
				? `Indie lean — ${subtitledpct}% subtitled, mix of arthouse and mainstream picks.`
				: nichescore >= 25
					? `Balanced taste — ${subtitledpct}% subtitled, comfortable across popular and niche cinema.`
					: `Mainstream lean — ${subtitledpct}% subtitled, strong preference for widely-seen popular films.`;

	const fallback: genrestat = { name: '—', count: 0, avg: 0, liked: 0 };

	// Diary and watchlist utilities for movie matching
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

	// Determine top 7 genres selection based on active metric or fallback hierarchy
	let selectedGenres: genrestat[] = [];
	let genreSelectionMethod: 'rating' | 'liked' | 'count' = 'rating';

	const eligibleRated = genrecount.filter((g) => g.count >= minthreshold && g.avg > 0);
	const eligibleLiked = genrecount.filter((g) => g.liked > 0);

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

	if (activeMetric === 'rating') {
		selectedGenres = eligibleRated
			.slice()
			.sort((a, b) => b.avg - a.avg || b.count - a.count)
			.slice(0, 7);
		genreSelectionMethod = 'rating';
	} else if (activeMetric === 'liked') {
		selectedGenres = eligibleLiked
			.slice()
			.sort((a, b) => b.liked - a.liked || b.count - a.count)
			.slice(0, 7);
		genreSelectionMethod = 'liked';
	} else {
		selectedGenres = genrecount.slice(0, 7);
		genreSelectionMethod = 'count';
	}

	const genrehighlights = selectedGenres.map((g) => {
		const genreName = g.name;
		const count = g.count;
		const avg = g.avg > 0 ? g.avg.toFixed(1) : '—';
		const liked = g.liked;

		const candidates = films.filter((f) => f.tmdb && f.tmdb.genres.includes(genreName));

		candidates.sort((a, b) => {
			// 1. Highest rated
			const rA = a.rating ?? 0;
			const rB = b.rating ?? 0;
			if (rB !== rA) return rB - rA;

			// 2. Check if in favourites
			const favA = favSet.has(a.uri) ? 1 : 0;
			const favB = favSet.has(b.uri) ? 1 : 0;
			if (favB !== favA) return favB - favA;

			// 3. Most rewatched
			const rwA = getRewatchTimes(`${a.name}|${a.year}`);
			const rwB = getRewatchTimes(`${b.name}|${b.year}`);
			if (rwB !== rwA) return rwB - rwA;

			// 4. Most recently watched
			const dateA = getLatestWatchDate(a);
			const dateB = getLatestWatchDate(b);
			return dateB.localeCompare(dateA);
		});

		const top = candidates[0] ?? null;
		return {
			genre: genreName,
			count,
			avg,
			liked,
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
		genrecount,
		topwatched,
		toprated,
		topliked,
		topgenre: genrecount[0] ?? fallback,
		topratedgenre: genrecount.slice().sort((a, b) => b.avg - a.avg)[0] ?? fallback,
		toplikedgenre: topliked[0] ?? fallback,
		nichescore,
		nichedesc,
		subtitledpct,
		totalgenres: genrecount.length,
		genrehighlights,
		genreSelectionMethod
	};
}
