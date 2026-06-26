import { unzipSync } from 'fflate';
import { parseall, parseprofile } from './parse';
import { enrichall } from './tmdb';
import { loadstored, savestored, clearstored } from './store';
import type { dataset } from './types';

export { clearstored };

/** find a file in an unzipped bundle by name, ignoring directory prefixes */
function findfile(files: Record<string, Uint8Array>, name: string): string | null {
	const dec = new TextDecoder();
	for (const [path, bytes] of Object.entries(files)) {
		if (path.endsWith('/' + name) || path === name) return dec.decode(bytes);
	}
	return null;
}

export async function loadfromzip(
	file: File,
	onprogress: (msg: string, done?: number, total?: number) => void
): Promise<dataset> {
	onprogress('reading zip...');
	const buf = await file.arrayBuffer();
	const files = unzipSync(new Uint8Array(buf));

	const watched = findfile(files, 'watched.csv') ?? '';
	const ratings = findfile(files, 'ratings.csv') ?? '';
	const diary = findfile(files, 'diary.csv') ?? '';
	const profilecsv = findfile(files, 'profile.csv');
	const profile = profilecsv ? parseprofile(profilecsv) : null;

	onprogress('parsing csv files...');
	const { films, diary: diaryentries } = parseall(watched, ratings, diary);
	onprogress(`parsed ${films.length} films, ${diaryentries.length} diary entries`);

	onprogress('enriching with tmdb...', 0, films.length);
	const enriched = await enrichall(films, (done, total) => {
		onprogress('enriching with tmdb...', done, total);
	});

	const data: dataset = { films: enriched, diary: diaryentries, profile, enrichedat: Date.now() };
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
	const [watchedcsv, ratingscsv, diarycsv, profilecsv] = await Promise.all([
		fetch('/sample/watched.csv').then((r) => r.text()),
		fetch('/sample/ratings.csv').then((r) => r.text()),
		fetch('/sample/diary.csv').then((r) => r.text()),
		fetch('/sample/profile.csv').then((r) => r.text())
	]);

	const { films, diary } = parseall(watchedcsv, ratingscsv, diarycsv);
	const profile = parseprofile(profilecsv);
	onprogress(`parsed ${films.length} films, ${diary.length} diary entries`);

	onprogress('enriching with tmdb...', 0, films.length);
	const enriched = await enrichall(films, (done, total) => {
		onprogress(`enriching...`, done, total);
	});

	const data: dataset = { films: enriched, diary, profile, enrichedat: Date.now() };
	savestored(data);
	onprogress('done', films.length, films.length);
	return data;
}
