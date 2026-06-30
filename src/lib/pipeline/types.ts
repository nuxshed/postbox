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
	media_type?: 'movie' | 'tv';
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

export type batchlog = {
	batchIndex: number;
	size: number;
	latency: number;
	films: { name: string; year: number; uri: string }[];
	status: 'success' | 'error';
	error?: string;
};

export type missdetail = {
	name: string;
	year: number;
	uri: string;
	status: 'resolved_movie' | 'resolved_tv' | 'resolved_override' | 'not_found' | 'failed';
	tmdbid?: number;
	error?: string;
};

export type pipelineoptions = {
	bypassLocalStorage?: boolean;
	bypassIndexedDb?: boolean;
};

export type processedfilm = {
	name: string;
	year: number;
	uri: string;
	isHit: boolean;
	status: string;
	tmdbid?: number;
};

export type pipelinetelemetry = {
	stage: 'idle' | 'parsing_csv' | 'checking_cache' | 'enriching' | 'saving' | 'complete' | 'error';
	totalTime: number;
	csvParseTime: number;
	cacheLookupTime: number;
	enrichmentTime: number;
	totalFilms: number;
	cacheHits: number;
	cacheMisses: number;
	toEnrichCount: number;
	averageQueryLatency: number;
	batchLogs: batchlog[];
	missDetails: missdetail[];
	processedFilms: processedfilm[];
};

