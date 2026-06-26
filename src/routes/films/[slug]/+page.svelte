<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { loadstored } from '$lib/pipeline/store';
	import { filmslug, tmdbposter } from '$lib/utils';
	import type { enrichedfilm, diaryentry } from '$lib/pipeline/types';
	import { onMount } from 'svelte';
	import IconStarFilled from '~icons/tabler/star-filled';
	import IconStarHalfFilled from '~icons/tabler/star-half-filled';
	import IconArrowLeft from '~icons/tabler/arrow-left';
	import IconClock from '~icons/tabler/clock';
	import IconRefresh from '~icons/tabler/refresh';

	const slug = $derived($page.params.slug);

	let film = $state<enrichedfilm | null>(null);
	let entries = $state<diaryentry[]>([]);
	let loaded = $state(false);

	onMount(() => {
		const data = loadstored();
		if (!data) { loaded = true; return; }

		const found = data.films.find((f) => filmslug(f.uri) === slug);
		film = found ?? null;
		entries = data.diary
			.filter((e) => film && e.name === film.name && e.year === film.year)
			.sort((a, b) => b.watcheddate.localeCompare(a.watcheddate));
		loaded = true;
	});

	function fmtdate(d: string): string {
		const dt = new Date(d + 'T00:00:00');
		return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function renderrating(r: number) {
		return r.toFixed(1);
	}
</script>

{#if !loaded}
	<div class="min-h-[60vh] flex items-center justify-center">
		<span class="font-mono text-[12px]" style="color: var(--text-dim);">Loading…</span>
	</div>
{:else if !film}
	<div class="py-20 flex flex-col items-start gap-4">
		<div class="font-mono text-[12px]" style="color: var(--text-dim);">Film not found.</div>
		<a
			href="{base}/films"
			class="flex items-center gap-1 font-mono text-[11px] hover:opacity-70 transition-opacity"
			style="color: var(--accent);"
		>
			<IconArrowLeft width="13" height="13" />
			Back to Films
		</a>
	</div>
{:else}
	<div class="flex flex-col gap-6 pt-6">
		<!-- back link -->
		<a
			href="{base}/films"
			class="flex items-center gap-[6px] font-mono text-[11px] w-fit hover:opacity-70 transition-opacity"
			style="color: var(--text-dim);"
		>
			<IconArrowLeft width="13" height="13" />
			Films
		</a>

		<!-- hero -->
		<div class="flex gap-8">
			<!-- poster -->
			<div
				class="shrink-0 rounded-[10px] overflow-hidden border border-[var(--border)]"
				style="width: 180px; aspect-ratio: 2/3; background: var(--bg-card);"
			>
				{#if tmdbposter(film.tmdb?.poster)}
					<img
						src={tmdbposter(film.tmdb?.poster)!}
						alt={film.name}
						class="w-full h-full object-cover"
					/>
				{:else}
					<div class="w-full h-full flex items-end p-4">
						<span class="font-display font-semibold text-[13px] leading-tight" style="color: var(--text-muted);">{film.name}</span>
					</div>
				{/if}
			</div>

			<!-- info -->
			<div class="flex flex-col gap-5 min-w-0 flex-1 py-1">
				<!-- title + year -->
				<div>
					<h2
						class="font-display font-bold text-[36px] leading-[0.95] tracking-[-0.03em]"
						style="color: var(--text);"
					>
						{film.name}
					</h2>
					<div class="flex items-center gap-3 mt-2 flex-wrap">
						<span class="font-mono text-[12px]" style="color: var(--text-muted);">{film.year}</span>
						{#if film.tmdb?.runtime}
							<span class="flex items-center gap-1 font-mono text-[12px]" style="color: var(--text-dim);">
								<IconClock width="12" height="12" />
								{film.tmdb.runtime}m
							</span>
						{/if}
						{#if film.tmdb?.language}
							<span class="font-mono text-[12px]" style="color: var(--text-dim);">{film.tmdb.language}</span>
						{/if}
					</div>
				</div>

				<!-- director -->
				{#if film.tmdb?.director}
					<div class="flex items-center gap-2">
						<span class="font-mono text-[10.5px] tracking-[0.08em] uppercase" style="color: var(--text-dim);">Directed by</span>
						<a
							href="{base}/films?director={encodeURIComponent(film.tmdb.director)}"
							class="text-[14px] font-medium hover:opacity-70 transition-opacity"
							style="color: var(--text);"
						>
							{film.tmdb.director}
						</a>
					</div>
				{/if}

				<!-- genres -->
				{#if film.tmdb?.genres.length}
					<div class="flex items-center gap-2 flex-wrap">
						{#each film.tmdb.genres as g (g)}
							<a
								href="{base}/films?genre={encodeURIComponent(g)}"
								class="rounded-[5px] px-2 py-0.5 font-mono text-[10.5px] border border-[var(--border)] hover:border-[var(--border-2)] hover:opacity-80 transition-all"
								style="background: var(--bg); color: var(--text-muted);"
							>
								{g}
							</a>
						{/each}
					</div>
				{/if}

				<!-- countries -->
				{#if film.tmdb?.countries.length}
					<div class="flex items-center gap-2 flex-wrap">
						{#each film.tmdb.countries as c (c)}
							<a
								href="{base}/films?country={encodeURIComponent(c)}"
								class="font-mono text-[11px] hover:opacity-70 transition-opacity"
								style="color: var(--text-dim);"
							>
								{c}
							</a>
						{/each}
					</div>
				{/if}

				<!-- divider -->
				<div class="h-px" style="background: var(--border);"></div>

				<!-- your stats -->
				<div class="flex gap-8 flex-wrap">
					{#if film.rating !== null}
						<div>
							<div class="font-mono text-[10px] tracking-[0.12em] uppercase mb-2" style="color: var(--text-dim);">Your rating</div>
							<div class="flex items-center gap-1.5">
								<span class="font-num font-bold text-[32px] leading-none tracking-[-0.02em]" style="color: var(--accent-amber);">{film.rating.toFixed(1)}</span>
								<div class="flex items-center gap-[2px] mt-0.5">
									{#each [1,2,3,4,5] as s (s)}
										{@const full = film.rating >= s}
										{@const half = !full && film.rating >= s - 0.5}
										{#if full}
											<IconStarFilled width="14" height="14" class="text-[var(--accent-amber)]" />
										{:else if half}
											<IconStarHalfFilled width="14" height="14" class="text-[var(--accent-amber)]" />
										{:else}
											<IconStarFilled width="14" height="14" style="color: var(--star-empty);" />
										{/if}
									{/each}
								</div>
							</div>
						</div>
					{/if}

					<div>
						<div class="font-mono text-[10px] tracking-[0.12em] uppercase mb-2" style="color: var(--text-dim);">
							{film.watchcount > 1 ? 'Times watched' : 'Watched'}
						</div>
						<div class="flex items-baseline gap-1">
							<span class="font-num font-bold text-[32px] leading-none tracking-[-0.02em]" style="color: var(--text);">{film.watchcount}</span>
							{#if film.watchcount > 1}
								<IconRefresh width="14" height="14" class="mb-0.5" style="color: var(--text-muted);" />
							{/if}
						</div>
					</div>

					<div>
						<div class="font-mono text-[10px] tracking-[0.12em] uppercase mb-2" style="color: var(--text-dim);">First watched</div>
						<div class="text-[14px] font-medium" style="color: var(--text);">{fmtdate(film.firstwatched)}</div>
					</div>

					{#if film.watchcount > 1}
						<div>
							<div class="font-mono text-[10px] tracking-[0.12em] uppercase mb-2" style="color: var(--text-dim);">Last watched</div>
							<div class="text-[14px] font-medium" style="color: var(--text);">{fmtdate(film.lastwatched)}</div>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- cast -->
		{#if film.tmdb?.cast.length}
			<div class="rounded-[14px] border border-[var(--border)] p-5 px-[22px]" style="background: var(--bg-card);">
				<h3 class="font-display font-semibold text-[15px] tracking-[-0.01em] mb-4" style="color: var(--text);">Cast</h3>
				<div class="flex flex-wrap gap-2">
					{#each film.tmdb.cast.slice(0, 20) as name (name)}
						<a
							href="{base}/films?actor={encodeURIComponent(name)}"
							class="rounded-[6px] px-[10px] py-[6px] text-[12.5px] font-medium border border-[var(--border)] hover:border-[var(--border-2)] hover:opacity-80 transition-all"
							style="background: var(--bg); color: var(--text-muted);"
						>
							{name}
						</a>
					{/each}
				</div>
			</div>
		{/if}

		<!-- diary entries -->
		{#if entries.length > 0}
			<div class="rounded-[14px] border border-[var(--border)] p-5 px-[22px]" style="background: var(--bg-card);">
				<h3 class="font-display font-semibold text-[15px] tracking-[-0.01em] mb-4" style="color: var(--text);">Watch history</h3>
				<div class="flex flex-col">
					{#each entries as e, i (e.watcheddate + '|' + i)}
						<div
							class="grid items-center gap-4 py-3 border-t border-[var(--border)]"
							style="grid-template-columns: 140px 1fr auto;"
						>
							<span class="font-mono text-[12px]" style="color: var(--text-muted);">{fmtdate(e.watcheddate)}</span>
							<div class="flex items-center gap-2 flex-wrap">
								{#if e.rewatch}
									<span class="flex items-center gap-1 font-mono text-[10px] tracking-[0.06em] uppercase px-1.5 py-0.5 rounded-[4px]" style="background: color-mix(in oklab, var(--accent-blue) 12%, transparent); color: var(--accent-blue);">
										<IconRefresh width="10" height="10" /> rewatch
									</span>
								{/if}
								{#if e.tags}
									{#each e.tags.split(',').map(t => t.trim()).filter(Boolean) as t (t)}
										<a
											href="{base}/films?tag={encodeURIComponent(t)}"
											class="font-mono text-[10.5px] hover:opacity-70 transition-opacity"
											style="color: var(--text-dim);"
										>
											#{t}
										</a>
									{/each}
								{/if}
							</div>
							{#if e.rating !== null}
								<div class="flex items-center gap-0.5">
									<span class="font-mono text-[12px] font-bold" style="color: var(--accent-amber);">{renderrating(e.rating)}</span>
									<IconStarFilled width="10" height="10" class="text-[var(--accent-amber)]" />
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}
