import type { dataset } from '$lib/pipeline/types';

export type tagstat = { name: string; count: number; avg: number };

export type tagstats = {
	tags: tagstat[];
	bycount: tagstat[];
	byrating: tagstat[];
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

	const tagmap = new Map<string, { count: number; ratings: number[] }>();
	for (const entry of diary) {
		if (!entry.tags) continue;
		const tags = entry.tags
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		// prefer film rating from ratings.csv, fall back to diary entry rating
		const rating = filmrating.get(`${entry.name}|${entry.year}`) ?? entry.rating;
		for (const tag of tags) {
			if (!tagmap.has(tag)) tagmap.set(tag, { count: 0, ratings: [] });
			const e = tagmap.get(tag)!;
			e.count++;
			if (rating !== null && rating !== undefined && rating > 0) e.ratings.push(rating);
		}
	}

	const tags = [...tagmap.entries()]
		.map(([name, { count, ratings }]) => ({
			name,
			count,
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
		toptag: tags[0] ?? { name: '—', count: 0, avg: 0 },
		totallogs,
		avgacross
	};
}
