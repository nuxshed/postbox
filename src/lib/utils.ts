/** extract letterboxd film slug from uri (handles both full and boxd.it short URLs) */
export function filmslug(uri: string): string {
	const full = uri.match(/\/film\/([^/?#]+)/);
	if (full) return full[1];
	const short = uri.match(/boxd\.it\/([^/?#]+)/);
	if (short) return short[1];
	return encodeURIComponent(uri);
}

const COUNTRY_DISPLAY: Record<string, string> = {
	'United States of America': 'USA',
	'United Kingdom': 'UK',
	'Russian Federation': 'Russia',
	'Taiwan, Province of China': 'Taiwan',
	'Iran, Islamic Republic of': 'Iran',
	"Korea, Democratic People's Republic of": 'North Korea',
	'Korea, Republic of': 'South Korea',
	'Viet Nam': 'Vietnam',
	'Syrian Arab Republic': 'Syria',
	'Bolivia, Plurinational State of': 'Bolivia',
	'Venezuela, Bolivarian Republic of': 'Venezuela',
	'Palestinian Territory': 'Palestine'
};

/** normalize a raw TMDB country name to the display name used in stats/filters */
export function displaycountry(name: string): string {
	return COUNTRY_DISPLAY[name] ?? name;
}

/** build tmdb image url from poster path */
export function tmdbposter(path: string | null | undefined, size = 'w300'): string | null {
	if (!path) return null;
	return `https://image.tmdb.org/t/p/${size}${path}`;
}

/** star string for a rating (0.5–5) */
export function starlabel(rating: number): string {
	const full = Math.floor(rating);
	const half = rating % 1 >= 0.5 ? 1 : 0;
	return full.toFixed(0) + (half ? '.5' : '') + ' ★';
}
