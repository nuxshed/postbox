import type { dataset, enrichedfilm } from '$lib/pipeline/types';
import { filmslug } from '$lib/utils';

export type GraphNode = {
	id: string;
	label: string;
	size: number;
	rating: number | null;
	photo: string | null;
	meta: string;
	/** href for click navigation */
	href: string;
};

export type GraphLink = {
	source: string;
	target: string;
	weight: number;
};

export type GraphData = {
	nodes: GraphNode[];
	links: GraphLink[];
};

const MAX_MOVIE_NODES = 200;
const MAX_PERSON_NODES = 150;

/** Movies graph: nodes = films, edges = shared actors/directors */
export function computeMovieGraph(data: dataset): GraphData {
	const { films } = data;
	const enriched = films.filter((f) => f.tmdb);

	// build person → film set lookup
	const personFilms = new Map<string, Set<string>>();
	for (const f of enriched) {
		if (!f.tmdb) continue;
		const fid = f.uri;
		if (f.tmdb.director) {
			const key = `d:${f.tmdb.director}`;
			if (!personFilms.has(key)) personFilms.set(key, new Set());
			personFilms.get(key)!.add(fid);
		}
		for (const actor of f.tmdb.cast) {
			const key = `a:${actor}`;
			if (!personFilms.has(key)) personFilms.set(key, new Set());
			personFilms.get(key)!.add(fid);
		}
	}

	// count connections per film
	const filmConnections = new Map<string, number>();
	for (const f of enriched) filmConnections.set(f.uri, 0);

	const linkMap = new Map<string, number>();
	for (const [, fset] of personFilms) {
		if (fset.size < 2) continue;
		const arr = [...fset];
		for (let i = 0; i < arr.length; i++) {
			for (let j = i + 1; j < arr.length; j++) {
				const a = arr[i] < arr[j] ? arr[i] : arr[j];
				const b = arr[i] < arr[j] ? arr[j] : arr[i];
				const key = `${a}||${b}`;
				linkMap.set(key, (linkMap.get(key) ?? 0) + 1);
				filmConnections.set(a, (filmConnections.get(a) ?? 0) + 1);
				filmConnections.set(b, (filmConnections.get(b) ?? 0) + 1);
			}
		}
	}

	// pick top N most connected
	const sorted = enriched
		.slice()
		.sort((a, b) => (filmConnections.get(b.uri) ?? 0) - (filmConnections.get(a.uri) ?? 0))
		.slice(0, MAX_MOVIE_NODES);

	const nodeSet = new Set(sorted.map((f) => f.uri));
	const filmMap = new Map<string, enrichedfilm>();
	for (const f of sorted) filmMap.set(f.uri, f);

	const maxConn = Math.max(...sorted.map((f) => filmConnections.get(f.uri) ?? 0), 1);

	const nodes: GraphNode[] = sorted.map((f) => ({
		id: f.uri,
		label: f.name,
		size: 4 + ((filmConnections.get(f.uri) ?? 0) / maxConn) * 16,
		rating: f.rating,
		photo: f.tmdb?.poster ?? null,
		meta: `${f.year}${f.rating ? ' · ★ ' + f.rating.toFixed(1) : ''}`,
		href: `/films/${filmslug(f.uri)}`
	}));

	const links: GraphLink[] = [];
	for (const [key, weight] of linkMap) {
		const [a, b] = key.split('||');
		if (nodeSet.has(a) && nodeSet.has(b)) {
			links.push({ source: a, target: b, weight });
		}
	}

	return { nodes, links };
}

/** Actors graph: nodes = actors, edges = appeared in same movie */
export function computeActorGraph(data: dataset): GraphData {
	const { films } = data;

	// actor stats
	const actorFilms = new Map<string, { count: number; photo: string | null; movies: string[] }>();
	for (const f of films) {
		if (!f.tmdb) continue;
		for (let i = 0; i < f.tmdb.cast.length; i++) {
			const name = f.tmdb.cast[i];
			if (!actorFilms.has(name)) actorFilms.set(name, { count: 0, photo: null, movies: [] });
			const e = actorFilms.get(name)!;
			e.count++;
			e.movies.push(f.name);
			if (!e.photo && f.tmdb.castdata?.[i]?.photo) e.photo = f.tmdb.castdata[i].photo;
		}
	}

	// top actors
	const topActors = [...actorFilms.entries()]
		.sort((a, b) => b[1].count - a[1].count)
		.slice(0, MAX_PERSON_NODES);

	const actorSet = new Set(topActors.map(([name]) => name));
	const maxCount = Math.max(...topActors.map(([, v]) => v.count), 1);

	const nodes: GraphNode[] = topActors.map(([name, v]) => ({
		id: name,
		label: name,
		size: 5 + (v.count / maxCount) * 18,
		rating: null,
		photo: v.photo,
		meta: `${v.count} film${v.count === 1 ? '' : 's'}`,
		href: `/films?actor=${encodeURIComponent(name)}`
	}));

	// links: actors who appeared in the same film
	const linkMap = new Map<string, number>();
	for (const f of films) {
		if (!f.tmdb) continue;
		const actors = f.tmdb.cast.filter((a) => actorSet.has(a));
		for (let i = 0; i < actors.length; i++) {
			for (let j = i + 1; j < actors.length; j++) {
				const a = actors[i] < actors[j] ? actors[i] : actors[j];
				const b = actors[i] < actors[j] ? actors[j] : actors[i];
				const key = `${a}||${b}`;
				linkMap.set(key, (linkMap.get(key) ?? 0) + 1);
			}
		}
	}

	const links: GraphLink[] = [];
	for (const [key, weight] of linkMap) {
		const [a, b] = key.split('||');
		links.push({ source: a, target: b, weight });
	}

	return { nodes, links };
}

/** Directors graph: nodes = directors, edges = shared actors */
export function computeDirectorGraph(data: dataset): GraphData {
	const { films } = data;

	// director stats
	const dirStats = new Map<string, { count: number; photo: string | null; actors: Set<string> }>();
	for (const f of films) {
		if (!f.tmdb?.director) continue;
		const dir = f.tmdb.director;
		if (!dirStats.has(dir)) dirStats.set(dir, { count: 0, photo: null, actors: new Set() });
		const e = dirStats.get(dir)!;
		e.count++;
		for (const a of f.tmdb.cast) e.actors.add(a);
		if (!e.photo && f.tmdb.directordata?.photo) e.photo = f.tmdb.directordata.photo;
	}

	const topDirs = [...dirStats.entries()]
		.sort((a, b) => b[1].count - a[1].count)
		.slice(0, MAX_PERSON_NODES);

	const maxCount = Math.max(...topDirs.map(([, v]) => v.count), 1);

	const nodes: GraphNode[] = topDirs.map(([name, v]) => ({
		id: name,
		label: name,
		size: 5 + (v.count / maxCount) * 18,
		rating: null,
		photo: v.photo,
		meta: `${v.count} film${v.count === 1 ? '' : 's'}`,
		href: `/films?director=${encodeURIComponent(name)}`
	}));

	// links: directors who share actors
	const dirNames = topDirs.map(([name]) => name);
	const linkMap = new Map<string, number>();
	for (let i = 0; i < dirNames.length; i++) {
		const aSet = dirStats.get(dirNames[i])!.actors;
		for (let j = i + 1; j < dirNames.length; j++) {
			const bSet = dirStats.get(dirNames[j])!.actors;
			let shared = 0;
			for (const a of aSet) {
				if (bSet.has(a)) shared++;
			}
			if (shared > 0) {
				const a = dirNames[i] < dirNames[j] ? dirNames[i] : dirNames[j];
				const b = dirNames[i] < dirNames[j] ? dirNames[j] : dirNames[i];
				linkMap.set(`${a}||${b}`, shared);
			}
		}
	}

	const links: GraphLink[] = [];
	for (const [key, weight] of linkMap) {
		const [a, b] = key.split('||');
		links.push({ source: a, target: b, weight });
	}

	return { nodes, links };
}
