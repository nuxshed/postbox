import type { dataset, tmdbdetails } from './types';

const KEY = 'postbox_dataset';
const DB_NAME = 'postbox_cache_db';
const STORE_NAME = 'films';

export function loadstored(): dataset | null {
	const raw = localStorage.getItem(KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as dataset;
	} catch {
		return null;
	}
}

export function savestored(data: dataset): void {
	localStorage.setItem(KEY, JSON.stringify(data));
}

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export async function getBulkFilmCache(uris: string[]): Promise<Record<string, tmdbdetails | null>> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const results: Record<string, tmdbdetails | null> = {};
		let pending = uris.length;
		if (pending === 0) {
			resolve(results);
			return;
		}
		for (const uri of uris) {
			const req = store.get(uri);
			req.onsuccess = () => {
				if (req.result !== undefined) {
					results[uri] = req.result;
				}
				pending--;
				if (pending === 0) resolve(results);
			};
			req.onerror = () => reject(req.error);
		}
	});
}

export async function saveBulkFilmCache(entries: Record<string, tmdbdetails | null>): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		for (const [uri, data] of Object.entries(entries)) {
			store.put(data, uri);
		}
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function clearFilmCache(): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const req = store.clear();
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}

export async function migrateLegacyCache(): Promise<void> {
	const raw = localStorage.getItem('postbox_film_cache');
	if (raw) {
		try {
			const parsed = JSON.parse(raw);
			await saveBulkFilmCache(parsed);
			localStorage.removeItem('postbox_film_cache');
		} catch (e) {
			console.error('Legacy migration failed:', e);
		}
	}
}

export function cleardataset(): void {
	localStorage.removeItem(KEY);
}

export function clearstored(): void {
	cleardataset();
	clearFilmCache().catch((e) => console.error('Failed to clear IndexedDB:', e));
}



