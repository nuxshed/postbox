export type rawwatched = {
	date: string;
	name: string;
	year: number;
	uri: string;
};

export type rawrating = {
	date: string;
	name: string;
	year: number;
	uri: string;
	rating: number;
};

export type rawdiary = {
	date: string;
	name: string;
	year: number;
	uri: string;
	rating: number | null;
	rewatch: boolean;
	tags: string;
	watcheddate: string;
};

export type film = {
	name: string;
	year: number;
	uri: string;
	rating: number | null;
	liked: boolean;
	firstwatched: string;
	lastwatched: string;
	watchcount: number;
};

export type tmdbperson = {
	name: string;
	photo: string | null;
};

export type tmdbcrew = {
	name: string;
	job: string;
	photo: string | null;
};

export type tmdbdetails = {
	tmdbid: number;
	poster: string | null;
	backdrop: string | null;
	overview: string | null;
	runtime: number | null;
	genres: string[];
	director: string | null;
	directordata?: tmdbperson | null;
	cast: string[];
	castdata?: tmdbperson[];
	crew?: tmdbcrew[];
	countries: string[];
	language: string;
	popularity: number;
};

export type enrichedfilm = film & { tmdb: tmdbdetails | null };

export type diaryentry = {
	date: string;
	name: string;
	year: number;
	rating: number | null;
	rewatch: boolean;
	tags: string;
	watcheddate: string;
};

export type profile = {
	username: string;
	name: string;
	favoriteFilms?: string[];
};

export type dataset = {
	films: enrichedfilm[];
	diary: diaryentry[];
	profile: profile | null;
	enrichedat: number;
};
