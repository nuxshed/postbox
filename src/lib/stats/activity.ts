import type { dataset } from '$lib/pipeline/types';

export type weekdata = { label: string; count: number; liked: number; avg: number; datestr: string; title: string };

export type activitystats = {
	streakcurrent: number;
	streaklongest: number;
	streaklongestend: string;
	years: number[];
	yeartotals: Record<string, number>;
	yearliked: Record<string, number>;
	yearratingavg: Record<string, number>;
	daycounts: Record<string, number>;
	daylikes: Record<string, number>;
	dayratingsum: Record<string, number>;
	dayratingcount: Record<string, number>;
	rewatchcount: number;
	rewatchpct: number;
	mostrewatched: { name: string; times: number; director: string | null }[];
};

function fmtdate(d: string): string {
	const dt = new Date(d + 'T00:00:00');
	return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function computeactivity(data: dataset): activitystats {
	const { films, diary } = data;

	const filmbykey = new Map(films.map((f) => [`${f.name}|${f.year}`, f]));

	// day → count/liked/rating maps
	const daycounts: Record<string, number> = {};
	const daylikes: Record<string, number> = {};
	const dayratingsum: Record<string, number> = {};
	const dayratingcount: Record<string, number> = {};
	const yeartotals: Record<string, number> = {};
	const yearliked: Record<string, number> = {};
	const yearratingsum: Record<string, number> = {};
	const yearratingcount: Record<string, number> = {};
	for (const e of diary) {
		const d = (e.watcheddate || e.date)?.slice(0, 10);
		if (!d) continue;
		const yr = d.slice(0, 4);
		daycounts[d] = (daycounts[d] ?? 0) + 1;
		yeartotals[yr] = (yeartotals[yr] ?? 0) + 1;
		if (filmbykey.get(`${e.name}|${e.year}`)?.liked) {
			daylikes[d] = (daylikes[d] ?? 0) + 1;
			yearliked[yr] = (yearliked[yr] ?? 0) + 1;
		}
		if (e.rating !== null) {
			dayratingsum[d] = (dayratingsum[d] ?? 0) + e.rating;
			dayratingcount[d] = (dayratingcount[d] ?? 0) + 1;
			yearratingsum[yr] = (yearratingsum[yr] ?? 0) + e.rating;
			yearratingcount[yr] = (yearratingcount[yr] ?? 0) + 1;
		}
	}

	// streak computation
	const dateset = new Set(Object.keys(daycounts));
	const today = new Date().toISOString().slice(0, 10);

	let streakcurrent = 0;
	let cur = new Date(today);
	while (dateset.has(cur.toISOString().slice(0, 10))) {
		streakcurrent++;
		cur.setDate(cur.getDate() - 1);
	}

	const sorted = Object.keys(daycounts).sort();
	let streaklongest = 0;
	let streaklongestend = '';
	let run = 0;
	let runend = '';
	for (let i = 0; i < sorted.length; i++) {
		if (i === 0) {
			run = 1;
			runend = sorted[i];
		} else {
			const prev = new Date(sorted[i - 1] + 'T00:00:00');
			const curr = new Date(sorted[i] + 'T00:00:00');
			const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
			if (diff === 1) {
				run++;
				runend = sorted[i];
			} else {
				run = 1;
				runend = sorted[i];
			}
		}
		if (run > streaklongest) {
			streaklongest = run;
			streaklongestend = runend;
		}
	}

	const years = [...new Set(Object.keys(yeartotals).map(Number))].sort();
	const yearratingavg: Record<string, number> = {};
	for (const yr of years) {
		const s = yearratingsum[yr] ?? 0, c = yearratingcount[yr] ?? 0;
		yearratingavg[String(yr)] = c > 0 ? Math.round((s / c) * 100) / 100 : 0;
	}

	// rewatch stats
	const rewatchcount = diary.filter((e) => e.rewatch).length;
	const rewatchpct = diary.length > 0 ? Math.round((rewatchcount / diary.length) * 100) : 0;

	// count diary entries per film; if all entries are rewatches, add 1 for the implied prior watch
	const diarycounts = new Map<string, { count: number; hasfirst: boolean }>();
	for (const e of diary) {
		const k = `${e.name}|${e.year}`;
		if (!diarycounts.has(k)) diarycounts.set(k, { count: 0, hasfirst: false });
		const entry = diarycounts.get(k)!;
		entry.count++;
		if (!e.rewatch) entry.hasfirst = true;
	}

	const mostrewatched = [...diarycounts.entries()]
		.map(([k, { count, hasfirst }]) => ({ k, times: hasfirst ? count : count + 1 }))
		.filter(({ times }) => times > 1)
		.sort((a, b) => {
			if (b.times !== a.times) return b.times - a.times;
			const ra = filmbykey.get(a.k)?.rating ?? 0;
			const rb = filmbykey.get(b.k)?.rating ?? 0;
			return rb - ra;
		})
		.slice(0, 5)
		.map(({ k, times }) => {
			const f = filmbykey.get(k);
			return { name: f?.name ?? k.split('|')[0], times, director: f?.tmdb?.director ?? null };
		});

	return {
		streakcurrent,
		streaklongest,
		streaklongestend: streaklongestend ? fmtdate(streaklongestend) : '—',
		years,
		yeartotals,
		yearliked,
		yearratingavg,
		daycounts,
		daylikes,
		dayratingsum,
		dayratingcount,
		rewatchcount,
		rewatchpct,
		mostrewatched
	};
}

/** weeks array for a given year */
export function weeksofyear(
	daycounts: Record<string, number>,
	daylikes: Record<string, number>,
	dayratingsum: Record<string, number>,
	dayratingcount: Record<string, number>,
	year: number
): weekdata[] {
	const weeks: weekdata[] = [];
	const jan1 = new Date(year + '-01-01T00:00:00');
	const dow = (jan1.getDay() + 6) % 7;
	const start = new Date(jan1);
	start.setDate(start.getDate() - dow);

	for (let w = 0; w < 53; w++) {
		const wstart = new Date(start);
		wstart.setDate(wstart.getDate() + w * 7);
		if (wstart.getFullYear() > year) break;

		let count = 0, liked = 0, ratingsum = 0, ratingcount = 0;
		for (let d = 0; d < 7; d++) {
			const day = new Date(wstart);
			day.setDate(day.getDate() + d);
			if (day.getFullYear() !== year) continue;
			const key = day.toISOString().slice(0, 10);
			count += daycounts[key] ?? 0;
			liked += daylikes[key] ?? 0;
			ratingsum += dayratingsum[key] ?? 0;
			ratingcount += dayratingcount[key] ?? 0;
		}

		const avg = ratingcount > 0 ? Math.round((ratingsum / ratingcount) * 100) / 100 : 0;
		const wk = w + 1;
		const label = wk % 4 === 1 ? 'W' + wk : '';
		const datestr = wstart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		const title = 'Week of ' + datestr + ' · ' + count + ' film' + (count !== 1 ? 's' : '');
		weeks.push({ label, count, liked, avg, datestr, title });
	}

	return weeks;
}
