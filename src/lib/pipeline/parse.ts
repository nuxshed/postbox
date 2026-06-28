import Papa from 'papaparse';
import { z } from 'zod';
import type { film, diaryentry, profile } from './types';

const watchedschema = z.object({
	Date: z.string().min(1),
	Name: z.string().min(1),
	Year: z.coerce.number().int(),
	'Letterboxd URI': z.string().url()
});

const ratingschema = z.object({
	Date: z.string().min(1),
	Name: z.string().min(1),
	Year: z.coerce.number().int(),
	'Letterboxd URI': z.string().url(),
	Rating: z.coerce.number()
});

const diaryschema = z.object({
	Date: z.string().min(1),
	Name: z.string().min(1),
	Year: z.coerce.number().int(),
	'Letterboxd URI': z.string().url(),
	Rating: z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().nullable()),
	Rewatch: z.preprocess((v) => v === 'Yes', z.boolean()),
	Tags: z.string().optional().default(''),
	'Watched Date': z.string().min(1)
});

function parsecsv(text: string): Record<string, string>[] {
	const result = Papa.parse<Record<string, string>>(text, {
		header: true,
		skipEmptyLines: true
	});
	return result.data;
}

function validate<T>(schema: z.ZodType<T>, rows: unknown[], label: string): T[] {
	const out: T[] = [];
	for (const row of rows) {
		const r = schema.safeParse(row);
		if (r.success) {
			out.push(r.data);
		} else {
			console.warn(`[${label}] skipping invalid row:`, row, r.error.flatten());
		}
	}
	return out;
}

export function parseprofile(csv: string): profile | null {
	const rows = parsecsv(csv);
	const row = rows[0];
	if (!row) return null;
	const favsStr = row['Favorite Films'] ?? '';
	const favoriteFilms = favsStr ? favsStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
	return {
		username: row['Username'] ?? '',
		name: row['Given Name'] || row['Username'] || '',
		favoriteFilms
	};
}

export function parseall(
	watchedcsv: string,
	ratingscsv: string,
	diarycsv: string,
	likescsv: string = ''
): { films: film[]; diary: diaryentry[] } {
	const watched = validate(watchedschema, parsecsv(watchedcsv), 'watched');
	const ratings = validate(ratingschema, parsecsv(ratingscsv), 'ratings');
	const diary = validate(diaryschema, parsecsv(diarycsv), 'diary');

	const likedset = new Set<string>();
	if (likescsv) {
		const likesrows = parsecsv(likescsv);
		for (const row of likesrows) {
			const name = row['Name'];
			const year = row['Year'];
			if (name && year) likedset.add(`${name}|${year}`);
		}
	}

	// build rating lookup: name+year → rating
	const ratingmap = new Map<string, number>();
	for (const r of ratings) {
		ratingmap.set(`${r.Name}|${r.Year}`, r.Rating);
	}

	// build diary rating fallback: name+year → first non-null rating
	const diaryratingmap = new Map<string, number>();
	for (const d of diary) {
		const k = `${d.Name}|${d.Year}`;
		if (d.Rating != null && !diaryratingmap.has(k)) {
			diaryratingmap.set(k, d.Rating);
		}
	}

	// build per-film watch date info from watched + diary
	const watchdates = new Map<string, string[]>();
	for (const w of watched) {
		const k = `${w.Name}|${w.Year}`;
		if (!watchdates.has(k)) watchdates.set(k, []);
		watchdates.get(k)!.push(w.Date);
	}
	for (const d of diary) {
		const k = `${d.Name}|${d.Year}`;
		if (!watchdates.has(k)) watchdates.set(k, []);
		watchdates.get(k)!.push(d['Watched Date'] ?? d.Date);
	}

	// unique films by name+year, using watched.csv as the primary source of film list
	const filmmap = new Map<string, film>();

	for (const w of watched) {
		const k = `${w.Name}|${w.Year}`;
		if (filmmap.has(k)) continue;
		const dates = watchdates.get(k) ?? [w.Date];
		const sorted = [...new Set(dates)].sort();
		filmmap.set(k, {
			name: w.Name,
			year: w.Year,
			uri: w['Letterboxd URI'],
			rating: ratingmap.get(k) ?? diaryratingmap.get(k) ?? null,
			liked: likedset.has(k),
			firstwatched: sorted[0],
			lastwatched: sorted[sorted.length - 1],
			watchcount: sorted.length
		});
	}

	// also add films that only appear in diary but not watched
	for (const d of diary) {
		const k = `${d.Name}|${d.Year}`;
		if (filmmap.has(k)) continue;
		const dates = watchdates.get(k) ?? [d['Watched Date'] ?? d.Date];
		const sorted = [...new Set(dates)].sort();
		filmmap.set(k, {
			name: d.Name,
			year: d.Year,
			uri: d['Letterboxd URI'],
			rating: ratingmap.get(k) ?? diaryratingmap.get(k) ?? null,
			liked: likedset.has(k),
			firstwatched: sorted[0],
			lastwatched: sorted[sorted.length - 1],
			watchcount: sorted.length
		});
	}

	const diaryentries: diaryentry[] = diary.map((d) => ({
		date: d.Date,
		name: d.Name,
		year: d.Year,
		rating: d.Rating,
		rewatch: d.Rewatch,
		tags: d.Tags,
		watcheddate: d['Watched Date']
	}));

	return { films: [...filmmap.values()], diary: diaryentries };
}
