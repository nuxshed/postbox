import { unzipSync } from 'fflate';
import { parseall, parseprofile } from './parse';
import { enrichone } from './tmdb';
import {
	loadstored,
	savestored,
	clearstored,
	getBulkFilmCache,
	saveBulkFilmCache,
	migrateLegacyCache
} from './store';
import type { dataset, enrichedfilm, film, tmdbdetails, pipelineoptions, pipelinetelemetry } from './types';

export { clearstored };

/** find a file in an unzipped bundle by name, ignoring directory prefixes */
function findfile(files: Record<string, Uint8Array>, name: string): string | null {
	const dec = new TextDecoder();
	for (const [path, bytes] of Object.entries(files)) {
		if (path.endsWith('/' + name) || path === name) return dec.decode(bytes);
	}
	return null;
}

/** find likes/films.csv in the zip, which lives in a subdirectory */
function findlikes(files: Record<string, Uint8Array>): string | null {
	const dec = new TextDecoder();
	for (const [path, bytes] of Object.entries(files)) {
		if (path.endsWith('/likes/films.csv') || path === 'likes/films.csv') {
			return dec.decode(bytes);
		}
	}
	return null;
}

const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

export async function loadfromzip(
	file: File,
	onprogress: (msg: string, done?: number, total?: number) => void,
	ontelemetry?: (telemetry: pipelinetelemetry) => void,
	options?: pipelineoptions
): Promise<dataset> {
	const telemetry: pipelinetelemetry = {
		stage: 'idle',
		totalTime: 0,
		csvParseTime: 0,
		cacheLookupTime: 0,
		enrichmentTime: 0,
		totalFilms: 0,
		cacheHits: 0,
		cacheMisses: 0,
		toEnrichCount: 0,
		averageQueryLatency: 0,
		batchLogs: [],
		missDetails: [],
		processedFilms: []
	};

	const pipelineStart = performance.now();
	const updateTelemetry = (stage: pipelinetelemetry['stage']) => {
		telemetry.stage = stage;
		telemetry.totalTime = performance.now() - pipelineStart;
		ontelemetry?.({ ...telemetry });
	};

	updateTelemetry('parsing_csv');
	onprogress('reading zip...');
	await yieldToMain();
	const parseStart = performance.now();
	const buf = await file.arrayBuffer();
	const files = unzipSync(new Uint8Array(buf));

	const watched = findfile(files, 'watched.csv') ?? '';
	const ratings = findfile(files, 'ratings.csv') ?? '';
	const diary = findfile(files, 'diary.csv') ?? '';
	const likes = findlikes(files) ?? '';
	const profilecsv = findfile(files, 'profile.csv');
	const profile = profilecsv ? parseprofile(profilecsv) : null;

	onprogress('parsing csv files...');
	await yieldToMain();
	const { films, diary: diaryentries } = parseall(watched, ratings, diary, likes);
	onprogress(`parsed ${films.length} films, ${diaryentries.length} diary entries`);
	await yieldToMain();
	telemetry.csvParseTime = performance.now() - parseStart;
	telemetry.totalFilms = films.length;

	updateTelemetry('checking_cache');

	// Migrate old localStorage cache if it exists
	await migrateLegacyCache();

	// Fetch cached items from IndexedDB in bulk, unless bypassed
	const cacheStart = performance.now();
	const filmCache = options?.bypassIndexedDb ? {} : await getBulkFilmCache(films.map((f) => f.uri));
	telemetry.cacheLookupTime = performance.now() - cacheStart;

	const fromcache: enrichedfilm[] = [];
	const toenrich: film[] = [];

	for (const f of films) {
		if (f.uri in filmCache) {
			fromcache.push({ ...f, tmdb: filmCache[f.uri] });
		} else {
			toenrich.push(f);
		}
	}

	telemetry.cacheHits = fromcache.length;
	telemetry.cacheMisses = toenrich.length;
	telemetry.toEnrichCount = toenrich.length;
	telemetry.processedFilms = films.map((f) => {
		const isHit = f.uri in filmCache;
		const cached = filmCache[f.uri];
		return {
			name: f.name,
			year: f.year,
			uri: f.uri,
			isHit,
			status: isHit ? (cached ? (cached.media_type === 'tv' ? 'tv' : 'movie') : 'not_found') : 'pending',
			tmdbid: cached?.tmdbid
		};
	});
	updateTelemetry('checking_cache');

	// Fast-path: if nothing to enrich and matches the last stored dataset, skip save and finish instantly
	const existing = options?.bypassLocalStorage ? null : loadstored();
	if (
		toenrich.length === 0 &&
		existing &&
		existing.films.length === films.length &&
		existing.diary.length === diaryentries.length &&
		existing.profile?.username === profile?.username &&
		existing.profile?.favoriteFilms !== undefined
	) {
		onprogress('done', films.length, films.length);
		updateTelemetry('complete');
		return existing;
	}

	updateTelemetry('enriching');
	onprogress('enriching with tmdb...', fromcache.length, films.length);
	await yieldToMain();

	const batchsize = 5;
	const fresh: enrichedfilm[] = [];
	const enrichStart = performance.now();

	for (let i = 0; i < toenrich.length; i += batchsize) {
		const batch = toenrich.slice(i, i + batchsize);
		const batchIndex = Math.floor(i / batchsize) + 1;
		const batchTimerStart = performance.now();
		let enrichedBatch: enrichedfilm[] = [];
		let status: 'success' | 'error' = 'success';
		let errorMsg: string | undefined;

		try {
			enrichedBatch = await Promise.all(batch.map(enrichone));
		} catch (e) {
			status = 'error';
			errorMsg = String(e);
			enrichedBatch = batch.map((f) => ({ ...f, tmdb: null }));
		}

		const batchLatency = performance.now() - batchTimerStart;
		fresh.push(...enrichedBatch);

		// Record batch log
		telemetry.batchLogs.push({
			batchIndex,
			size: batch.length,
			latency: batchLatency,
			films: batch.map((f) => ({ name: f.name, year: f.year, uri: f.uri })),
			status,
			error: errorMsg
		});

		// Record miss details
		for (const ef of enrichedBatch) {
			let status: 'resolved_movie' | 'resolved_tv' | 'resolved_override' | 'not_found' | 'failed' = 'not_found';
			if (ef.tmdb) {
				if (ef.tmdb.tmdbid === 0) {
					status = 'resolved_override';
				} else if (ef.tmdb.media_type === 'tv') {
					status = 'resolved_tv';
				} else {
					status = 'resolved_movie';
				}
			}
			telemetry.missDetails.push({
				name: ef.name,
				year: ef.year,
				uri: ef.uri,
				status,
				tmdbid: ef.tmdb?.tmdbid
			});

			const pf = telemetry.processedFilms.find((p) => p.uri === ef.uri);
			if (pf) {
				pf.status = status;
				pf.tmdbid = ef.tmdb?.tmdbid;
			}
		}

		const totalBatchLatency = telemetry.batchLogs.reduce((acc, log) => acc + log.latency, 0);
		telemetry.averageQueryLatency = totalBatchLatency / telemetry.batchLogs.length;
		telemetry.enrichmentTime = performance.now() - enrichStart;

		// Progressively save cache in bulk
		const batchToCache: Record<string, tmdbdetails | null> = {};
		for (const ef of enrichedBatch) {
			batchToCache[ef.uri] = ef.tmdb;
		}
		await saveBulkFilmCache(batchToCache);

		onprogress('enriching with tmdb...', fromcache.length + fresh.length, films.length);
		updateTelemetry('enriching');
		await yieldToMain();
	}

	updateTelemetry('saving');
	const enriched = [...fromcache, ...fresh];
	const data: dataset = { films: enriched, diary: diaryentries, profile, enrichedat: Date.now() };
	
	onprogress('saving data...');
	await yieldToMain();
	savestored(data);
	onprogress('done', films.length, films.length);
	updateTelemetry('complete');
	return data;
}


export async function loadpipeline(
	onprogress: (msg: string, done?: number, total?: number) => void,
	ontelemetry?: (telemetry: pipelinetelemetry) => void,
	options?: pipelineoptions
): Promise<dataset> {
	const telemetry: pipelinetelemetry = {
		stage: 'idle',
		totalTime: 0,
		csvParseTime: 0,
		cacheLookupTime: 0,
		enrichmentTime: 0,
		totalFilms: 0,
		cacheHits: 0,
		cacheMisses: 0,
		toEnrichCount: 0,
		averageQueryLatency: 0,
		batchLogs: [],
		missDetails: [],
		processedFilms: []
	};

	const pipelineStart = performance.now();
	const updateTelemetry = (stage: pipelinetelemetry['stage']) => {
		telemetry.stage = stage;
		telemetry.totalTime = performance.now() - pipelineStart;
		ontelemetry?.({ ...telemetry });
	};

	updateTelemetry('parsing_csv');
	const cached = options?.bypassLocalStorage ? null : loadstored();
	if (cached) {
		onprogress('loaded from cache');
		telemetry.totalFilms = cached.films.length;
		telemetry.cacheHits = cached.films.length;
		updateTelemetry('complete');
		return cached;
	}

	onprogress('parsing csv files...');
	await yieldToMain();
	const parseStart = performance.now();
	const [watchedcsv, ratingscsv, diarycsv, profilecsv, likescsv] = await Promise.all([
		fetch('/sample/watched.csv').then((r) => r.text()),
		fetch('/sample/ratings.csv').then((r) => r.text()),
		fetch('/sample/diary.csv').then((r) => r.text()),
		fetch('/sample/profile.csv').then((r) => r.text()),
		fetch('/sample/likes/films.csv').then((r) => r.text()).catch(() => '')
	]);

	const { films, diary } = parseall(watchedcsv, ratingscsv, diarycsv, likescsv);
	const profile = parseprofile(profilecsv);
	onprogress(`parsed ${films.length} films, ${diary.length} diary entries`);
	await yieldToMain();
	telemetry.csvParseTime = performance.now() - parseStart;
	telemetry.totalFilms = films.length;

	updateTelemetry('checking_cache');

	// Migrate old localStorage cache if it exists
	await migrateLegacyCache();

	// Fetch cached items from IndexedDB in bulk, unless bypassed
	const cacheStart = performance.now();
	const filmCache = options?.bypassIndexedDb ? {} : await getBulkFilmCache(films.map((f) => f.uri));
	telemetry.cacheLookupTime = performance.now() - cacheStart;

	const fromcache: enrichedfilm[] = [];
	const toenrich: film[] = [];

	for (const f of films) {
		if (f.uri in filmCache) {
			fromcache.push({ ...f, tmdb: filmCache[f.uri] });
		} else {
			toenrich.push(f);
		}
	}

	telemetry.cacheHits = fromcache.length;
	telemetry.cacheMisses = toenrich.length;
	telemetry.toEnrichCount = toenrich.length;
	telemetry.processedFilms = films.map((f) => {
		const isHit = f.uri in filmCache;
		const cached = filmCache[f.uri];
		return {
			name: f.name,
			year: f.year,
			uri: f.uri,
			isHit,
			status: isHit ? (cached ? (cached.media_type === 'tv' ? 'tv' : 'movie') : 'not_found') : 'pending',
			tmdbid: cached?.tmdbid
		};
	});
	updateTelemetry('checking_cache');

	// Fast-path for pipeline run if already in cache and matching existing stored dataset
	const existing = options?.bypassLocalStorage ? null : loadstored();
	if (
		toenrich.length === 0 &&
		existing &&
		existing.films.length === films.length &&
		existing.diary.length === diary.length &&
		existing.profile?.username === profile?.username &&
		existing.profile?.favoriteFilms !== undefined
	) {
		onprogress('done', films.length, films.length);
		updateTelemetry('complete');
		return existing;
	}

	updateTelemetry('enriching');
	onprogress('enriching with tmdb...', fromcache.length, films.length);
	await yieldToMain();

	const batchsize = 5;
	const fresh: enrichedfilm[] = [];
	const enrichStart = performance.now();

	for (let i = 0; i < toenrich.length; i += batchsize) {
		const batch = toenrich.slice(i, i + batchsize);
		const batchIndex = Math.floor(i / batchsize) + 1;
		const batchTimerStart = performance.now();
		let enrichedBatch: enrichedfilm[] = [];
		let status: 'success' | 'error' = 'success';
		let errorMsg: string | undefined;

		try {
			enrichedBatch = await Promise.all(batch.map(enrichone));
		} catch (e) {
			status = 'error';
			errorMsg = String(e);
			enrichedBatch = batch.map((f) => ({ ...f, tmdb: null }));
		}

		const batchLatency = performance.now() - batchTimerStart;
		fresh.push(...enrichedBatch);

		// Record batch log
		telemetry.batchLogs.push({
			batchIndex,
			size: batch.length,
			latency: batchLatency,
			films: batch.map((f) => ({ name: f.name, year: f.year, uri: f.uri })),
			status,
			error: errorMsg
		});

		// Record miss details
		for (const ef of enrichedBatch) {
			let status: 'resolved_movie' | 'resolved_tv' | 'resolved_override' | 'not_found' | 'failed' = 'not_found';
			if (ef.tmdb) {
				if (ef.tmdb.tmdbid === 0) {
					status = 'resolved_override';
				} else if (ef.tmdb.media_type === 'tv') {
					status = 'resolved_tv';
				} else {
					status = 'resolved_movie';
				}
			}
			telemetry.missDetails.push({
				name: ef.name,
				year: ef.year,
				uri: ef.uri,
				status,
				tmdbid: ef.tmdb?.tmdbid
			});

			const pf = telemetry.processedFilms.find((p) => p.uri === ef.uri);
			if (pf) {
				pf.status = status;
				pf.tmdbid = ef.tmdb?.tmdbid;
			}
		}

		const totalBatchLatency = telemetry.batchLogs.reduce((acc, log) => acc + log.latency, 0);
		telemetry.averageQueryLatency = totalBatchLatency / telemetry.batchLogs.length;
		telemetry.enrichmentTime = performance.now() - enrichStart;

		// Progressively save cache in bulk
		const batchToCache: Record<string, tmdbdetails | null> = {};
		for (const ef of enrichedBatch) {
			batchToCache[ef.uri] = ef.tmdb;
		}
		await saveBulkFilmCache(batchToCache);

		onprogress('enriching with tmdb...', fromcache.length + fresh.length, films.length);
		updateTelemetry('enriching');
		await yieldToMain();
	}

	updateTelemetry('saving');
	const enriched = [...fromcache, ...fresh];
	const data: dataset = { films: enriched, diary, profile, enrichedat: Date.now() };
	
	onprogress('saving data...');
	await yieldToMain();
	savestored(data);
	onprogress('done', films.length, films.length);
	updateTelemetry('complete');
	return data;
}

