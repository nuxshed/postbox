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
import type { dataset, enrichedfilm, film, tmdbdetails } from './types';

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
	onprogress: (msg: string, done?: number, total?: number) => void
): Promise<dataset> {
	onprogress('reading zip...');
	await yieldToMain();
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

	// Migrate old localStorage cache if it exists
	await migrateLegacyCache();

	// Fetch cached items from IndexedDB in bulk
	const filmCache = await getBulkFilmCache(films.map((f) => f.uri));
	const fromcache: enrichedfilm[] = [];
	const toenrich: film[] = [];

	for (const f of films) {
		if (f.uri in filmCache) {
			fromcache.push({ ...f, tmdb: filmCache[f.uri] });
		} else {
			toenrich.push(f);
		}
	}

	// Fast-path: if nothing to enrich and matches the last stored dataset, skip save and finish instantly
	const existing = loadstored();
	if (
		toenrich.length === 0 &&
		existing &&
		existing.films.length === films.length &&
		existing.diary.length === diaryentries.length &&
		existing.profile?.username === profile?.username &&
		existing.profile?.favoriteFilms !== undefined
	) {
		onprogress('done', films.length, films.length);
		return existing;
	}

	onprogress('enriching with tmdb...', fromcache.length, films.length);
	await yieldToMain();

	const batchsize = 5;
	const fresh: enrichedfilm[] = [];

	for (let i = 0; i < toenrich.length; i += batchsize) {
		const batch = toenrich.slice(i, i + batchsize);
		const enrichedBatch = await Promise.all(batch.map(enrichone));
		fresh.push(...enrichedBatch);

		// Progressively save cache in bulk
		const batchToCache: Record<string, tmdbdetails | null> = {};
		for (const ef of enrichedBatch) {
			batchToCache[ef.uri] = ef.tmdb;
		}
		await saveBulkFilmCache(batchToCache);

		onprogress('enriching with tmdb...', fromcache.length + fresh.length, films.length);
		await yieldToMain();
	}

	const enriched = [...fromcache, ...fresh];
	const data: dataset = { films: enriched, diary: diaryentries, profile, enrichedat: Date.now() };
	
	onprogress('saving data...');
	await yieldToMain();
	savestored(data);
	onprogress('done', films.length, films.length);
	return data;
}

export async function loadpipeline(
	onprogress: (msg: string, done?: number, total?: number) => void
): Promise<dataset> {
	const cached = loadstored();
	if (cached) {
		onprogress('loaded from cache');
		return cached;
	}

	onprogress('parsing csv files...');
	await yieldToMain();
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

	// Migrate old localStorage cache if it exists
	await migrateLegacyCache();

	// Fetch cached items from IndexedDB in bulk
	const filmCache = await getBulkFilmCache(films.map((f) => f.uri));
	const fromcache: enrichedfilm[] = [];
	const toenrich: film[] = [];

	for (const f of films) {
		if (f.uri in filmCache) {
			fromcache.push({ ...f, tmdb: filmCache[f.uri] });
		} else {
			toenrich.push(f);
		}
	}

	// Fast-path for pipeline run if already in cache and matching existing stored dataset
	const existing = loadstored();
	if (
		toenrich.length === 0 &&
		existing &&
		existing.films.length === films.length &&
		existing.diary.length === diary.length &&
		existing.profile?.username === profile?.username &&
		existing.profile?.favoriteFilms !== undefined
	) {
		onprogress('done', films.length, films.length);
		return existing;
	}

	onprogress('enriching with tmdb...', fromcache.length, films.length);
	await yieldToMain();

	const batchsize = 5;
	const fresh: enrichedfilm[] = [];

	for (let i = 0; i < toenrich.length; i += batchsize) {
		const batch = toenrich.slice(i, i + batchsize);
		const enrichedBatch = await Promise.all(batch.map(enrichone));
		fresh.push(...enrichedBatch);

		// Progressively save cache in bulk
		const batchToCache: Record<string, tmdbdetails | null> = {};
		for (const ef of enrichedBatch) {
			batchToCache[ef.uri] = ef.tmdb;
		}
		await saveBulkFilmCache(batchToCache);

		onprogress('enriching with tmdb...', fromcache.length + fresh.length, films.length);
		await yieldToMain();
	}

	const enriched = [...fromcache, ...fresh];
	const data: dataset = { films: enriched, diary, profile, enrichedat: Date.now() };
	
	onprogress('saving data...');
	await yieldToMain();
	savestored(data);
	onprogress('done', films.length, films.length);
	return data;
}

