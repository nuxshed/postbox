import { z } from 'zod';
import type { film, enrichedfilm, tmdbdetails, tmdbperson, tmdbcrew } from './types';

const APIKEY = import.meta.env.VITE_TMDB_KEY as string;

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';
const PORTRAIT = 'https://image.tmdb.org/t/p/w185';

const CREW_JOBS: Record<string, string> = {
	'Director of Photography': 'Cinematography',
	'Original Music Composer': 'Composer',
	Screenplay: 'Writer',
	Story: 'Writer',
	Producer: 'Producer'
};

const searchschema = z.object({
	results: z.array(
		z.object({
			id: z.number()
		})
	)
});

const detailschema = z.object({
	id: z.number(),
	poster_path: z.string().nullable().optional(),
	backdrop_path: z.string().nullable().optional(),
	overview: z.string().nullable().optional(),
	runtime: z.number().nullable().optional(),
	genres: z
		.array(z.object({ name: z.string() }))
		.optional()
		.default([]),
	production_countries: z
		.array(z.object({ name: z.string() }))
		.optional()
		.default([]),
	original_language: z.string(),
	popularity: z.number(),
	credits: z
		.object({
			crew: z
				.array(
					z.object({
						job: z.string(),
						name: z.string(),
						profile_path: z.string().nullable().optional()
					})
				)
				.optional()
				.default([]),
			cast: z
				.array(
					z.object({
						name: z.string(),
						profile_path: z.string().nullable().optional()
					})
				)
				.optional()
				.default([])
		})
		.optional()
});

const tvdetailschema = z.object({
	id: z.number(),
	poster_path: z.string().nullable().optional(),
	backdrop_path: z.string().nullable().optional(),
	overview: z.string().nullable().optional(),
	episode_run_time: z.array(z.number()).optional().default([]),
	genres: z
		.array(z.object({ name: z.string() }))
		.optional()
		.default([]),
	production_countries: z
		.array(z.object({ name: z.string() }))
		.optional()
		.default([]),
	original_language: z.string(),
	popularity: z.number(),
	created_by: z
		.array(
			z.object({
				name: z.string(),
				profile_path: z.string().nullable().optional()
			})
		)
		.optional()
		.default([]),
	credits: z
		.object({
			crew: z
				.array(
					z.object({
						job: z.string(),
						name: z.string(),
						profile_path: z.string().nullable().optional()
					})
				)
				.optional()
				.default([]),
			cast: z
				.array(
					z.object({
						name: z.string(),
						profile_path: z.string().nullable().optional()
					})
				)
				.optional()
				.default([])
		})
		.optional()
});

async function fetchjson(url: string): Promise<unknown> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
	return res.json();
}

export async function enrichone(f: film): Promise<enrichedfilm> {
	try {
		const searchurl = `${BASE}/search/movie?api_key=${APIKEY}&query=${encodeURIComponent(f.name)}&year=${f.year}`;
		const searchraw = await fetchjson(searchurl);
		const search = searchschema.safeParse(searchraw);
		
		let isTV = false;
		let id: number | null = null;

		if (search.success && search.data.results.length > 0) {
			id = search.data.results[0].id;
		} else {
			// Try TV search
			const tvsearchurl = `${BASE}/search/tv?api_key=${APIKEY}&query=${encodeURIComponent(f.name)}&first_air_date_year=${f.year}`;
			const tvsearchraw = await fetchjson(tvsearchurl);
			const tvsearch = searchschema.safeParse(tvsearchraw);
			if (tvsearch.success && tvsearch.data.results.length > 0) {
				id = tvsearch.data.results[0].id;
				isTV = true;
			}
		}

		if (id === null) {
			return { ...f, tmdb: null };
		}

		if (!isTV) {
			const detailurl = `${BASE}/movie/${id}?api_key=${APIKEY}&append_to_response=credits`;
			const detailraw = await fetchjson(detailurl);
			const detail = detailschema.safeParse(detailraw);
			if (!detail.success) {
				console.warn(`[tmdb] invalid detail for ${f.name}:`, detail.error.flatten());
				return { ...f, tmdb: null };
			}

			const d = detail.data;
			const dirraw = d.credits?.crew?.find((c) => c.job === 'Director') ?? null;
			const directordata: tmdbperson | null = dirraw
				? { name: dirraw.name, photo: dirraw.profile_path ? PORTRAIT + dirraw.profile_path : null }
				: null;
			const castdata: tmdbperson[] = (d.credits?.cast ?? []).slice(0, 5).map((c) => ({
				name: c.name,
				photo: c.profile_path ? PORTRAIT + c.profile_path : null
			}));
			const crew: tmdbcrew[] = (d.credits?.crew ?? [])
				.filter((c) => c.job in CREW_JOBS)
				.map((c) => ({
					name: c.name,
					job: CREW_JOBS[c.job],
					photo: c.profile_path ? PORTRAIT + c.profile_path : null
				}));
			const tmdb: tmdbdetails = {
				tmdbid: d.id,
				poster: d.poster_path ? IMG + d.poster_path : null,
				backdrop: d.backdrop_path ? IMG + d.backdrop_path : null,
				overview: d.overview ?? null,
				runtime: d.runtime ?? null,
				genres: (d.genres ?? []).map((g) => g.name),
				director: dirraw?.name ?? null,
				directordata,
				cast: castdata.map((c) => c.name),
				castdata,
				crew,
				countries: (d.production_countries ?? []).map((c) => c.name),
				language: d.original_language,
				popularity: d.popularity,
				media_type: 'movie'
			};

			return { ...f, tmdb };
		} else {
			const detailurl = `${BASE}/tv/${id}?api_key=${APIKEY}&append_to_response=credits`;
			const detailraw = await fetchjson(detailurl);
			const detail = tvdetailschema.safeParse(detailraw);
			if (!detail.success) {
				console.warn(`[tmdb] invalid TV detail for ${f.name}:`, detail.error.flatten());
				return { ...f, tmdb: null };
			}

			const d = detail.data;
			const dirraw = d.credits?.crew?.find((c) => c.job === 'Director') ?? null;
			let directordata: tmdbperson | null = null;
			let directorName: string | null = null;

			if (dirraw) {
				directorName = dirraw.name;
				directordata = { name: dirraw.name, photo: dirraw.profile_path ? PORTRAIT + dirraw.profile_path : null };
			} else if (d.created_by && d.created_by.length > 0) {
				const creator = d.created_by[0];
				directorName = creator.name;
				directordata = { name: creator.name, photo: creator.profile_path ? PORTRAIT + creator.profile_path : null };
			}

			const castdata: tmdbperson[] = (d.credits?.cast ?? []).slice(0, 5).map((c) => ({
				name: c.name,
				photo: c.profile_path ? PORTRAIT + c.profile_path : null
			}));
			const crew: tmdbcrew[] = (d.credits?.crew ?? [])
				.filter((c) => c.job in CREW_JOBS)
				.map((c) => ({
					name: c.name,
					job: CREW_JOBS[c.job],
					photo: c.profile_path ? PORTRAIT + c.profile_path : null
				}));
			
			const tmdb: tmdbdetails = {
				tmdbid: d.id,
				poster: d.poster_path ? IMG + d.poster_path : null,
				backdrop: d.backdrop_path ? IMG + d.backdrop_path : null,
				overview: d.overview ?? null,
				runtime: d.episode_run_time?.[0] ?? null,
				genres: (d.genres ?? []).map((g) => g.name),
				director: directorName,
				directordata,
				cast: castdata.map((c) => c.name),
				castdata,
				crew,
				countries: (d.production_countries ?? []).map((c) => c.name),
				language: d.original_language,
				popularity: d.popularity,
				media_type: 'tv'
			};

			return { ...f, tmdb };
		}
	} catch (e) {
		console.warn(`[tmdb] failed for ${f.name}:`, e);
		return { ...f, tmdb: null };
	}
}

/** enrich all films in batches, calling onprogress(done, total) after each batch */
export async function enrichall(
	films: film[],
	onprogress: (done: number, total: number) => void,
	batchsize = 5
): Promise<enrichedfilm[]> {
	const results: enrichedfilm[] = [];
	for (let i = 0; i < films.length; i += batchsize) {
		const batch = films.slice(i, i + batchsize);
		const enriched = await Promise.all(batch.map(enrichone));
		results.push(...enriched);
		onprogress(results.length, films.length);
	}
	return results;
}
