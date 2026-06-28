<script lang="ts">
	import { getContext } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import type { dataset } from '$lib/pipeline/types';
	import { filmslug, tmdbposter, displaycountry, displaylanguage } from '$lib/utils';
	import IconStarFilled from '~icons/tabler/star-filled';
	import IconHeartFilled from '~icons/tabler/heart-filled';
	import IconSearch from '~icons/tabler/search';
	import IconX from '~icons/tabler/x';
	import IconChevronDown from '~icons/tabler/chevron-down';

	const dsctx = getContext<{ data: dataset | null }>('dataset');

	const q = $derived($page.url.searchParams.get('q') ?? '');
	const genre = $derived($page.url.searchParams.get('genre') ?? '');
	const director = $derived($page.url.searchParams.get('director') ?? '');
	const decade = $derived($page.url.searchParams.get('decade') ?? '');
	const actor = $derived($page.url.searchParams.get('actor') ?? '');
	const crew = $derived($page.url.searchParams.get('crew') ?? '');
	const country = $derived($page.url.searchParams.get('country') ?? '');
	const language = $derived($page.url.searchParams.get('language') ?? '');
	const tag = $derived($page.url.searchParams.get('tag') ?? '');
	const rating = $derived($page.url.searchParams.get('rating') ?? '');
	const runtimebucket = $derived($page.url.searchParams.get('runtimebucket') ?? '');
	const year = $derived($page.url.searchParams.get('year') ?? '');
	const sort = $derived($page.url.searchParams.get('sort') ?? 'watched');

	const RT_BUCKETS = [
		{ label: '< 80m', lo: 0, hi: 80 },
		{ label: '80–99m', lo: 80, hi: 100 },
		{ label: '100–119m', lo: 100, hi: 120 },
		{ label: '120–139m', lo: 120, hi: 140 },
		{ label: '140–159m', lo: 140, hi: 160 },
		{ label: '160–179m', lo: 160, hi: 180 },
		{ label: '180m+', lo: 180, hi: Infinity }
	];

	const allfilms = $derived(dsctx.data?.films ?? []);

	const genres = $derived(
		[...new Set(allfilms.flatMap((f) => f.tmdb?.genres ?? []))].sort()
	);
	const directors = $derived(
		[...new Set(allfilms.map((f) => f.tmdb?.director).filter((d): d is string => !!d))].sort()
	);
	const decades = $derived(
		[...new Set(allfilms.map((f) => Math.floor(f.year / 10) * 10))].sort((a, b) => a - b)
	);
	const countries = $derived(
		[...new Set(allfilms.flatMap((f) => (f.tmdb?.countries ?? []).map(displaycountry)))].sort()
	);
	const languages = $derived.by(() => {
		const codes = [...new Set(allfilms.map((f) => f.tmdb?.language).filter((l): l is string => !!l))];
		return codes
			.map((code) => ({ code, name: displaylanguage(code) }))
			.sort((a, b) => a.name.localeCompare(b.name));
	});
	const tags = $derived.by(() => {
		if (!dsctx.data) return [];
		const tagset = new Set<string>();
		for (const e of dsctx.data.diary) {
			if (!e.tags) continue;
			for (const t of e.tags.split(',')) {
				const tr = t.trim();
				if (tr) tagset.add(tr);
			}
		}
		return [...tagset].sort();
	});

	const films = $derived.by(() => {
		if (!dsctx.data) return [];
		let result = [...allfilms];

		if (q) result = result.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));
		if (genre) result = result.filter((f) => f.tmdb?.genres.includes(genre));
		if (director) result = result.filter((f) => f.tmdb?.director === director);
		if (decade) result = result.filter((f) => Math.floor(f.year / 10) * 10 === Number(decade));
		if (actor) result = result.filter((f) => f.tmdb?.cast.includes(actor));
		if (crew) result = result.filter((f) => f.tmdb?.crew?.some((c) => c.name === crew));
		if (country) result = result.filter((f) => f.tmdb?.countries.map(displaycountry).includes(country));
		if (language) result = result.filter((f) => f.tmdb?.language === language);
		if (tag && dsctx.data) {
			const tagged = new Set<string>();
			for (const e of dsctx.data.diary) {
				if (!e.tags) continue;
				for (const t of e.tags.split(',')) {
					if (t.trim() === tag) tagged.add(`${e.name}|${e.year}`);
				}
			}
			result = result.filter((f) => tagged.has(`${f.name}|${f.year}`));
		}
		if (rating) {
			const rv = Number(rating);
			result = result.filter((f) => f.rating !== null && Math.abs(f.rating - rv) < 0.01);
		}
		if (runtimebucket) {
			const bucket = RT_BUCKETS.find((b) => b.label === runtimebucket);
			if (bucket) {
				result = result.filter((f) => {
					const rt = f.tmdb?.runtime;
					return rt != null && rt >= bucket.lo && rt < bucket.hi;
				});
			}
		}
		if (year) {
			result = result.filter((f) => f.year === Number(year));
		}

		switch (sort) {
			case 'rating':
				result.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
				break;
			case 'year':
				result.sort((a, b) => b.year - a.year);
				break;
			case 'title':
				result.sort((a, b) => a.name.localeCompare(b.name));
				break;
			default:
				result.sort((a, b) => b.lastwatched.localeCompare(a.lastwatched));
		}

		return result;
	});

	const activefilters = $derived(
		[
			q ? { key: 'q', label: `"${q}"` } : null,
			genre ? { key: 'genre', label: genre } : null,
			director ? { key: 'director', label: director } : null,
			decade ? { key: 'decade', label: decade + 's' } : null,
			actor ? { key: 'actor', label: actor } : null,
			crew ? { key: 'crew', label: crew } : null,
			country ? { key: 'country', label: country } : null,
			language ? { key: 'language', label: displaylanguage(language) } : null,
			tag ? { key: 'tag', label: '#' + tag } : null,
			rating ? { key: 'rating', label: '★ ' + rating } : null,
			runtimebucket ? { key: 'runtimebucket', label: runtimebucket } : null,
			year ? { key: 'year', label: year } : null
		].filter((x): x is { key: string; label: string } => x !== null)
	);

	function setparam(key: string, value: string) {
		const params = new URLSearchParams($page.url.searchParams);
		if (value) params.set(key, value);
		else params.delete(key);
		const qs = params.toString();
		goto(`${base}/films${qs ? '?' + qs : ''}`, { replaceState: true, noScroll: true });
	}

	function clearall() {
		goto(`${base}/films`, { replaceState: true, noScroll: true });
	}

	let moreopen = $state(false);
	let hovered = $state<string | null>(null);

	const selectcls =
		'appearance-none rounded-[7px] border border-[var(--border)] px-3 py-[6px] font-mono text-[11px] cursor-pointer focus:outline-none focus:border-[var(--border-2)] transition-colors';
</script>

{#if !dsctx.data}
	<div class="py-[60px] font-mono text-[13px]" style="color: var(--text-dim);">
		No data — run the import pipeline first.
	</div>
{:else}
	<div class="flex flex-col gap-4">
		<!-- search + primary filters -->
		<div class="flex items-center gap-2 flex-wrap">
			<!-- search -->
			<div class="relative">
				<IconSearch
					class="absolute left-[10px] top-1/2 -translate-y-1/2 w-[14px] h-[14px] shrink-0"
					style="color: var(--text-dim);"
				/>
				<input
					type="text"
					value={q}
					oninput={(e) => setparam('q', (e.target as HTMLInputElement).value)}
					placeholder="Search films…"
					class="pl-8 pr-3 py-[6px] rounded-[7px] border border-[var(--border)] font-mono text-[11px] outline-none transition-colors w-[200px]"
					style="background: var(--bg-card); color: var(--text); placeholder-color: var(--text-dim);"
				/>
			</div>

			<!-- genre -->
			<div class="relative">
				<select
					value={genre}
					onchange={(e) => setparam('genre', (e.target as HTMLSelectElement).value)}
					class={selectcls}
					style="background: {genre ? 'color-mix(in oklab, var(--accent) 12%, var(--bg-card))' : 'var(--bg-card)'}; color: {genre ? 'var(--text)' : 'var(--text-muted)'};"
				>
					<option value="">Genre</option>
					{#each genres as g (g)}
						<option value={g}>{g}</option>
					{/each}
				</select>
			</div>

			<!-- director -->
			<div class="relative">
				<select
					value={director}
					onchange={(e) => setparam('director', (e.target as HTMLSelectElement).value)}
					class={selectcls}
					style="background: {director ? 'color-mix(in oklab, var(--accent) 12%, var(--bg-card))' : 'var(--bg-card)'}; color: {director ? 'var(--text)' : 'var(--text-muted)'};"
				>
					<option value="">Director</option>
					{#each directors as d (d)}
						<option value={d}>{d}</option>
					{/each}
				</select>
			</div>

			<!-- decade -->
			<div class="relative">
				<select
					value={decade}
					onchange={(e) => setparam('decade', (e.target as HTMLSelectElement).value)}
					class={selectcls}
					style="background: {decade ? 'color-mix(in oklab, var(--accent) 12%, var(--bg-card))' : 'var(--bg-card)'}; color: {decade ? 'var(--text)' : 'var(--text-muted)'};"
				>
					<option value="">Decade</option>
					{#each decades as d (d)}
						<option value={String(d)}>{d}s</option>
					{/each}
				</select>
			</div>

			<!-- more filters toggle -->
			<button
				onclick={() => (moreopen = !moreopen)}
				class="flex items-center gap-1 rounded-[7px] border border-[var(--border)] px-3 py-[6px] font-mono text-[11px] transition-colors"
				style="background: {moreopen ? 'color-mix(in oklab, var(--accent) 12%, var(--bg-card))' : 'var(--bg-card)'}; color: {moreopen ? 'var(--text)' : 'var(--text-muted)'};"
			>
				More
				<IconChevronDown
					class="w-3 h-3 transition-transform {moreopen ? 'rotate-180' : ''}"
				/>
			</button>

			<!-- sort (right side) -->
			<div class="ml-auto">
				<select
					value={sort}
					onchange={(e) => setparam('sort', (e.target as HTMLSelectElement).value)}
					class={selectcls}
					style="background: var(--bg-card); color: var(--text-muted);"
				>
					<option value="watched">Recently watched</option>
					<option value="rating">Highest rated</option>
					<option value="year">Newest release</option>
					<option value="title">A–Z</option>
				</select>
			</div>
		</div>

		<!-- expanded filters -->
		{#if moreopen}
			<div
				class="flex items-center gap-2 flex-wrap p-3 rounded-[10px] border border-[var(--border)]"
				style="background: var(--bg-card);"
			>
				<span class="font-mono text-[10px] tracking-[0.1em] uppercase mr-1" style="color: var(--text-dim);">More filters</span>

				<select
					value={actor}
					onchange={(e) => setparam('actor', (e.target as HTMLSelectElement).value)}
					class={selectcls}
					style="background: {actor ? 'color-mix(in oklab, var(--accent) 12%, var(--bg))' : 'var(--bg)'}; color: {actor ? 'var(--text)' : 'var(--text-muted)'};"
				>
					<option value="">Actor</option>
					{#each [...new Set(allfilms.flatMap((f) => f.tmdb?.cast ?? []))].sort() as a (a)}
						<option value={a}>{a}</option>
					{/each}
				</select>

				<select
					value={crew}
					onchange={(e) => setparam('crew', (e.target as HTMLSelectElement).value)}
					class={selectcls}
					style="background: {crew ? 'color-mix(in oklab, var(--accent) 12%, var(--bg))' : 'var(--bg)'}; color: {crew ? 'var(--text)' : 'var(--text-muted)'};"
				>
					<option value="">Crew</option>
					{#each [...new Set(allfilms.flatMap((f) => f.tmdb?.crew?.map((c) => c.name) ?? []))].sort() as cr (cr)}
						<option value={cr}>{cr}</option>
					{/each}
				</select>

				<select
					value={country}
					onchange={(e) => setparam('country', (e.target as HTMLSelectElement).value)}
					class={selectcls}
					style="background: {country ? 'color-mix(in oklab, var(--accent) 12%, var(--bg))' : 'var(--bg)'}; color: {country ? 'var(--text)' : 'var(--text-muted)'};"
				>
					<option value="">Country</option>
					{#each countries as c (c)}
						<option value={c}>{c}</option>
					{/each}
				</select>

				<select
					value={language}
					onchange={(e) => setparam('language', (e.target as HTMLSelectElement).value)}
					class={selectcls}
					style="background: {language ? 'color-mix(in oklab, var(--accent) 12%, var(--bg))' : 'var(--bg)'}; color: {language ? 'var(--text)' : 'var(--text-muted)'};"
				>
					<option value="">Language</option>
					{#each languages as l (l.code)}
						<option value={l.code}>{l.name}</option>
					{/each}
				</select>

				<select
					value={tag}
					onchange={(e) => setparam('tag', (e.target as HTMLSelectElement).value)}
					class={selectcls}
					style="background: {tag ? 'color-mix(in oklab, var(--accent) 12%, var(--bg))' : 'var(--bg)'}; color: {tag ? 'var(--text)' : 'var(--text-muted)'};"
				>
					<option value="">Tag</option>
					{#each tags as t (t)}
						<option value={t}>#{t}</option>
					{/each}
				</select>
			</div>
		{/if}

		<!-- count + active filter chips -->
		<div class="flex items-center gap-2 flex-wrap min-h-[24px]">
			<span class="font-mono text-[11px]" style="color: var(--text-dim);">
				{films.length.toLocaleString('en-US')} films
			</span>
			{#each activefilters as f (f.key)}
				<button
					onclick={() => setparam(f.key, '')}
					class="flex items-center gap-1 rounded-[5px] px-2 py-0.5 font-mono text-[10.5px] transition-opacity hover:opacity-70"
					style="background: color-mix(in oklab, var(--accent) 15%, transparent); color: var(--accent); border: 1px solid color-mix(in oklab, var(--accent) 30%, transparent);"
				>
					{f.label}
					<IconX class="w-[10px] h-[10px]" />
				</button>
			{/each}
			{#if activefilters.length > 1}
				<button
					onclick={clearall}
					class="font-mono text-[10.5px] transition-opacity hover:opacity-70"
					style="color: var(--text-dim);"
				>
					clear all
				</button>
			{/if}
		</div>

		<!-- film grid -->
		{#if films.length === 0}
			<div class="py-16 text-center">
				<div class="font-mono text-[13px]" style="color: var(--text-dim);">
					No films match the current filters.
				</div>
				<button
					onclick={clearall}
					class="mt-3 font-mono text-[11px] transition-opacity hover:opacity-70"
					style="color: var(--accent);"
				>
					Clear filters
				</button>
			</div>
		{:else}
			<div
				class="grid gap-3"
				style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));"
			>
				{#each films as film (film.uri)}
					{@const poster = tmdbposter(film.tmdb?.poster)}
					{@const slug = filmslug(film.uri)}
					<a
						href="{base}/films/{slug}"
						class="group flex flex-col gap-2"
						onmouseenter={() => (hovered = film.uri)}
						onmouseleave={() => (hovered = null)}
					>
						<div
							class="relative overflow-hidden rounded-[8px] border border-[var(--border)] flex flex-col"
							style="aspect-ratio: 2/3; background: var(--bg-card);"
						>
							{#if poster}
								<img
									src={poster}
									alt={film.name}
									class="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
									loading="lazy"
								/>
							{:else}
								<div class="flex-1 flex items-end p-3">
									<span
										class="font-display font-semibold text-[12px] leading-tight"
										style="color: var(--text-muted);"
									>
										{film.name}
									</span>
								</div>
							{/if}
							{#if film.liked}
								<div
									class="absolute bottom-[6px] left-[6px] flex items-center justify-center w-[22px] h-[22px] rounded-[4px]"
									style="background: rgba(0,0,0,0.72); backdrop-filter: blur(4px);"
								>
									<IconHeartFilled width="10" height="10" style="color: #e05c72;" />
								</div>
							{/if}
							{#if film.rating !== null}
								<div
									class="absolute bottom-[6px] right-[6px] flex items-center gap-0.5 rounded-[4px] px-1.5 py-0.5"
									style="background: rgba(0,0,0,0.72); backdrop-filter: blur(4px);"
								>
									<span
										class="font-mono text-[10.5px] font-bold leading-none"
										style="color: var(--accent-amber);"
									>
										{film.rating.toFixed(1)}
									</span>
									<IconStarFilled
										width="9"
										height="9"
										class="text-[var(--accent-amber)] shrink-0"
									/>
								</div>
							{/if}
						</div>
						<div>
							<div
								class="text-[12px] font-medium leading-tight truncate transition-[color]"
								style="color: {hovered === film.uri ? 'var(--accent)' : 'var(--text)'};"
								title={film.name}
							>
								{film.name}
							</div>
							<div class="font-mono text-[10.5px] mt-0.5" style="color: var(--text-dim);">
								{film.year}
							</div>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
{/if}
