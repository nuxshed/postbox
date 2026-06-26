import type { dataset } from '$lib/pipeline/types';

export type rangesel =
	| { kind: 'all' }
	| { kind: '6mo' }
	| { kind: '1mo' }
	| { kind: 'custom'; from: string; to: string };

/** filter dataset to diary entries in range; all time returns data as-is */
export function filterbyrange(data: dataset, range: rangesel): dataset {
	if (range.kind === 'all') return data;

	const now = Date.now();
	let from: number;
	let to: number = now;

	if (range.kind === '6mo') {
		from = now - 183 * 86400000;
	} else if (range.kind === '1mo') {
		from = now - 30 * 86400000;
	} else {
		from = new Date(range.from).getTime();
		to = new Date(range.to).getTime() + 86400000 - 1; // inclusive end
	}

	const diary = data.diary.filter((e) => {
		const t = new Date(e.watcheddate || e.date).getTime();
		return t >= from && t <= to;
	});

	const countmap = new Map<string, number>();
	for (const e of diary) countmap.set(`${e.name}|${e.year}`, (countmap.get(`${e.name}|${e.year}`) ?? 0) + 1);

	const films = data.films
		.filter((f) => countmap.has(`${f.name}|${f.year}`))
		.map((f) => ({ ...f, watchcount: countmap.get(`${f.name}|${f.year}`)! }));

	return { ...data, films, diary };
}
