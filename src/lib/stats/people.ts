import type { dataset } from '$lib/pipeline/types';

export type personstat = {
	name: string;
	photo: string | null;
	watched: number;
	avg: number;
	liked: number;
	filmcount?: number;
	ratedfilms?: number;
	role?: string;
};

export type peoplestats = {
	directors: personstat[];
	actors: personstat[];
	crew: personstat[];
};

export function computepeople(data: dataset): peoplestats {
	const { films } = data;

	// directors
	const dirmap = new Map<
		string,
		{
			watched: number;
			ratings: number[];
			filmcount: number;
			ratedfilms: number;
			liked: number;
			photo: string | null;
		}
	>();
	for (const f of films) {
		if (!f.tmdb?.director) continue;
		const name = f.tmdb.director;
		if (!dirmap.has(name))
			dirmap.set(name, { watched: 0, ratings: [], filmcount: 0, ratedfilms: 0, liked: 0, photo: null });
		const e = dirmap.get(name)!;
		e.watched += 1;
		e.filmcount++;
		if (f.rating !== null && f.rating > 0) {
			e.ratings.push(f.rating);
			e.ratedfilms++;
		}
		if (f.liked) e.liked += 1;
		if (!e.photo && f.tmdb.directordata?.photo) e.photo = f.tmdb.directordata.photo;
	}
	const directors = [...dirmap.entries()]
		.map(([name, { watched, ratings, filmcount, ratedfilms, liked, photo }]) => ({
			name,
			photo,
			watched,
			filmcount,
			ratedfilms,
			liked,
			avg:
				ratings.length > 0
					? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
					: 0
		}))
		.sort((a, b) => b.watched - a.watched);

	// actors
	const actormap = new Map<
		string,
		{ watched: number; ratings: number[]; ratedfilms: number; liked: number; photo: string | null }
	>();
	for (const f of films) {
		if (!f.tmdb) continue;
		for (let i = 0; i < f.tmdb.cast.length; i++) {
			const name = f.tmdb.cast[i];
			if (!actormap.has(name))
				actormap.set(name, { watched: 0, ratings: [], ratedfilms: 0, liked: 0, photo: null });
			const e = actormap.get(name)!;
			e.watched += 1;
			if (f.rating !== null && f.rating > 0) {
				e.ratings.push(f.rating);
				e.ratedfilms++;
			}
			if (f.liked) e.liked += 1;
			if (!e.photo && f.tmdb.castdata?.[i]?.photo) e.photo = f.tmdb.castdata[i].photo;
		}
	}
	const actors = [...actormap.entries()]
		.map(([name, { watched, ratings, ratedfilms, liked, photo }]) => ({
			name,
			photo,
			watched,
			ratedfilms,
			liked,
			avg:
				ratings.length > 0
					? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
					: 0
		}))
		.sort((a, b) => b.watched - a.watched);

	// crew (cinematographers, composers, etc.)
	const crewmap = new Map<
		string,
		{ watched: number; ratings: number[]; ratedfilms: number; liked: number; role: string; photo: string | null }
	>();
	for (const f of films) {
		if (!f.tmdb?.crew) continue;
		for (const c of f.tmdb.crew) {
			const key = `${c.name}::${c.job}`;
			if (!crewmap.has(key))
				crewmap.set(key, { watched: 0, ratings: [], ratedfilms: 0, liked: 0, role: c.job, photo: null });
			const e = crewmap.get(key)!;
			e.watched += 1;
			if (f.rating !== null && f.rating > 0) {
				e.ratings.push(f.rating);
				e.ratedfilms++;
			}
			if (f.liked) e.liked += 1;
			if (!e.photo && c.photo) e.photo = c.photo;
		}
	}
	const crew = [...crewmap.entries()]
		.map(([key, { watched, ratings, ratedfilms, liked, role, photo }]) => ({
			name: key.split('::')[0],
			photo,
			watched,
			ratedfilms,
			liked,
			role,
			avg:
				ratings.length > 0
					? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
					: 0
		}))
		.sort((a, b) => b.watched - a.watched);

	return { directors, actors, crew };
}
