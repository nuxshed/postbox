import type { dataset } from '$lib/pipeline/types';

export type genrestat = { name: string; count: number; avg: number };

export type genrestats = {
	genrecount: genrestat[];
	topwatched: genrestat[];
	toprated: genrestat[];
	topgenre: genrestat;
	topratedgenre: genrestat;
	nichescore: number;
	nichedesc: string;
	subtitledpct: number;
	totalgenres: number;
};

export function computegenres(data: dataset): genrestats {
	const { films } = data;

	const genremap = new Map<string, { count: number; ratings: number[] }>();
	for (const f of films) {
		if (!f.tmdb) continue;
		for (const g of f.tmdb.genres) {
			if (!genremap.has(g)) genremap.set(g, { count: 0, ratings: [] });
			const e = genremap.get(g)!;
			e.count += 1;
			if (f.rating !== null && f.rating > 0) e.ratings.push(f.rating);
		}
	}

	const genrecount = [...genremap.entries()]
		.map(([name, { count, ratings }]) => ({
			name,
			count,
			avg:
				ratings.length > 0
					? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
					: 0
		}))
		.sort((a, b) => b.count - a.count);

	const topwatched = genrecount.slice(0, 10);
	const toprated = genrecount
		.filter((g) => g.count >= 20)
		.sort((a, b) => b.avg - a.avg)
		.slice(0, 10);

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

	const fallback: genrestat = { name: '—', count: 0, avg: 0 };

	return {
		genrecount,
		topwatched,
		toprated,
		topgenre: genrecount[0] ?? fallback,
		topratedgenre: genrecount.slice().sort((a, b) => b.avg - a.avg)[0] ?? fallback,
		nichescore,
		nichedesc,
		subtitledpct,
		totalgenres: genrecount.length
	};
}
