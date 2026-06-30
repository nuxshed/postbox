import { browser } from '$app/environment';

export function persistedState<T>(key: string, initialValue: T) {
	let value = $state<T>(initialValue);

	if (browser) {
		const stored = localStorage.getItem(key);
		if (stored !== null) {
			try {
				value = JSON.parse(stored) as T;
			} catch {
				// use initialValue if corrupted
			}
		}
	}

	return {
		get value() {
			return value;
		},
		set value(newValue: T) {
			value = newValue;
			if (browser) {
				localStorage.setItem(key, JSON.stringify(newValue));
			}
		}
	};
}
