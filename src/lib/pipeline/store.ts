import type { dataset } from './types';

const KEY = 'postbox_dataset';

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

export function clearstored(): void {
	localStorage.removeItem(KEY);
}
