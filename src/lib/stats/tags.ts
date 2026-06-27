import type { dataset } from '$lib/pipeline/types';

export type tagstat = { name: string; count: number; avg: number; liked: number };

export type tagstats = {
	tags: tagstat[];
	bycount: tagstat[];
	byrating: tagstat[];
	byliked: tagstat[];
	toptag: tagstat;
	totallogs: number;
	avgacross: number;
};

export function computetags(data: dataset): tagstats {
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

	return {
		tags,
		bycount: tags.slice(),
		byrating: tags.slice().sort((a, b) => b.avg - a.avg),
		byliked: tags.slice().sort((a, b) => b.liked - a.liked),
		toptag: tags[0] ?? { name: '—', count: 0, avg: 0, liked: 0 },
		totallogs,
		avgacross
	};
}
