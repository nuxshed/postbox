<script lang="ts">
	import { getContext } from 'svelte';
	import type { dataset, enrichedfilm } from '$lib/pipeline/types';
	import { computeactivity, weeksofyear } from '$lib/stats/activity';
	import { filmslug, tmdbposter } from '$lib/utils';
	import { base } from '$app/paths';
	import BarList from '$lib/components/barlist.svelte';
	import ColumnChart from '$lib/components/columnchart.svelte';
	import Heatmap from '$lib/components/heatmap.svelte';
	import Card from '$lib/components/card.svelte';
	import MetricToggle from '$lib/components/metrictoggle.svelte';
	import Infotip from '$lib/components/infotip.svelte';

	const dsctx = getContext<{ data: dataset | null }>('dataset');
	const yearctrls = getContext<{ year: number; setyear: (y: number) => void }>('activityyear');
	const stats = $derived(dsctx.data ? computeactivity(dsctx.data) : null);

	const filmslugmap = $derived.by(() => {
		const map = new Map<string, string>();
		if (!dsctx.data) return map;
		for (const f of dsctx.data.films) map.set(f.name, filmslug(f.uri));
		return map;
	});

	const curyear = $derived(yearctrls.year);

	const weeks = $derived(
		stats ? weeksofyear(stats.daycounts, stats.daylikes, stats.dayratingsum, stats.dayratingcount, curyear) : []
	);
	const yeartotal = $derived(stats ? (stats.yeartotals[String(curyear)] ?? 0) : 0);
	const activeweeks = $derived(weeks.filter((w) => w.count > 0).length);
	const bestweek = $derived(
		weeks.reduce((m, w) => (w.count > m.count ? w : m), { count: 0, label: '', liked: 0, avg: 0, datestr: '', title: '' })
	);
	const perweekavg = $derived((yeartotal / 52).toFixed(1));
	const daysthisyear = $derived(
		stats ? Object.keys(stats.daycounts).filter((k) => k.slice(0, 4) === String(curyear)).length : 0
	);

	const hasratings = $derived(dsctx.data?.films.some((f) => f.rating !== null) ?? false);
	const haslikes = $derived(dsctx.data?.films.some((f) => f.liked) ?? false);
	const activitytoggleopts = $derived.by(() => {
		const opts = [{ id: 'count', label: 'Watched' }];
		if (haslikes) opts.push({ id: 'liked', label: 'Liked' });
		if (hasratings) opts.push({ id: 'rating', label: 'Rating' });
		return opts;
	});

	let weekmetric = $state('count');
	let yearmetric = $state('count');
	let hoveredFilmUri = $state<string | null>(null);

	const top7films = $derived.by(() => {
		if (!dsctx.data) return [];
		const yearStr = String(curyear);
		const favSet = new Set(dsctx.data.profile?.favoriteFilms ?? []);

		const yearEntries = dsctx.data.diary.filter((e) => {
			const d = (e.watcheddate || e.date)?.slice(0, 10);
			return d && d.slice(0, 4) === yearStr;
		});

		if (yearEntries.length === 0) return [];

		const filmbykey = new Map(dsctx.data.films.map((f) => [`${f.name}|${f.year}`, f]));
		const uniqueFilmKeys = new Set<string>();
		for (const e of yearEntries) {
			uniqueFilmKeys.add(`${e.name}|${e.year}`);
		}
		
		const candidates: enrichedfilm[] = [];
		for (const key of uniqueFilmKeys) {
			const f = filmbykey.get(key);
			if (f) candidates.push(f);
		}

		const diarycounts = new Map<string, { count: number; hasfirst: boolean }>();
		const maxDateMap = new Map<string, string>();

		for (const e of dsctx.data.diary) {
			const k = `${e.name}|${e.year}`;
			if (!diarycounts.has(k)) diarycounts.set(k, { count: 0, hasfirst: false });
			const entry = diarycounts.get(k)!;
			entry.count++;
			if (!e.rewatch) entry.hasfirst = true;

			const dateVal = e.watcheddate || e.date;
			if (dateVal) {
				const prevMax = maxDateMap.get(k) ?? '';
				if (dateVal > prevMax) {
					maxDateMap.set(k, dateVal);
				}
			}
		}

		const getRewatchTimes = (k: string) => {
			const entry = diarycounts.get(k);
			if (!entry) return 1;
			return entry.hasfirst ? entry.count : entry.count + 1;
		};

		const getLatestWatchDate = (f: enrichedfilm) => {
			const k = `${f.name}|${f.year}`;
			return maxDateMap.get(k) || f.lastwatched || f.firstwatched || '';
		};

		candidates.sort((a, b) => {
			const rA = a.rating ?? 0;
			const rB = b.rating ?? 0;
			if (rB !== rA) return rB - rA;

			const favA = favSet.has(a.uri) ? 1 : 0;
			const favB = favSet.has(b.uri) ? 1 : 0;
			if (favB !== favA) return favB - favA;

			const rwA = getRewatchTimes(`${a.name}|${a.year}`);
			const rwB = getRewatchTimes(`${b.name}|${b.year}`);
			if (rwB !== rwA) return rwB - rwA;

			const dateA = getLatestWatchDate(a);
			const dateB = getLatestWatchDate(b);
			return dateB.localeCompare(dateA);
		});

		return candidates.slice(0, 7);
	});

	const weekrows = $derived(weeks.map((w) => {
		const val = weekmetric === 'liked' ? w.liked : weekmetric === 'rating' ? w.avg : w.count;
		const valstr = weekmetric === 'rating' ? val.toFixed(2) + '★' : val.toLocaleString('en-US');
		return { ...w, value: val, title: w.datestr ? `Week of ${w.datestr} · ${valstr}` : '' };
	}));

	const yearrows = $derived.by(() => {
		if (!stats) return [];
		return stats.years.map((y) => {
			const val = yearmetric === 'liked'
				? (stats.yearliked[String(y)] ?? 0)
				: yearmetric === 'rating'
					? (stats.yearratingavg[String(y)] ?? 0)
					: (stats.yeartotals[String(y)] ?? 0);
			const valstr = yearmetric === 'rating' ? val.toFixed(2) + '★' : val.toLocaleString('en-US');
			return { label: "'" + String(y).slice(2), value: val, title: `${y} · ${valstr}` };
		});
	});

	function fmtint(n: number) {
		return n.toLocaleString('en-US');
	}
</script>

{#if !stats}
	<div class="py-[60px] font-mono text-[13px]" style="color: var(--text-dim);">
		No data — run the import pipeline first.
	</div>
{:else}
	<div class="flex flex-col gap-[18px]">
		<!-- streak + headline row -->
		<div class="grid gap-[18px]" style="grid-template-columns: 1fr 1fr 2fr;">
			<!-- current streak -->
			<div
				class="rounded-[14px] border border-[var(--border)] p-5 px-[22px] flex flex-col gap-1"
				style="background: var(--bg-card);"
			>
				<div
					class="font-mono text-[10px] tracking-[0.14em] uppercase"
					style="color: var(--accent-green);"
				>
					Current streak
				</div>
				<div
					class="font-num font-bold text-[52px] leading-[0.9] tracking-[-0.03em] mt-[6px]"
					style="color: var(--accent-green);"
				>
					{stats.streakcurrent}<span class="text-[22px] opacity-60 ml-1">days</span>
				</div>
				<div class="text-[12px] mt-1" style="color: var(--text-muted);">
					consecutive days with a logged film
				</div>
			</div>

			<!-- longest streak -->
			<div
				class="rounded-[14px] border border-[var(--border)] p-5 px-[22px] flex flex-col gap-1"
				style="background: var(--bg-card);"
			>
				<div
					class="font-mono text-[10px] tracking-[0.14em] uppercase"
					style="color: var(--accent-amber);"
				>
					Longest streak
				</div>
				<div
					class="font-num font-bold text-[52px] leading-[0.9] tracking-[-0.03em] mt-[6px]"
					style="color: var(--accent-amber);"
				>
					{stats.streaklongest}<span class="text-[22px] opacity-60 ml-1">days</span>
				</div>
				<div class="text-[12px] mt-1" style="color: var(--text-muted);">
					ended {stats.streaklongestend}
				</div>
			</div>

			<!-- mini stats grid -->
			<div
				class="rounded-[14px] border border-[var(--border)] p-5 px-[22px] grid grid-cols-2 gap-x-[32px] gap-y-[18px] content-center"
				style="background: var(--bg-card);"
			>
				{#each [{ v: fmtint(yeartotal), l: 'entries in ' + curyear }, { v: String(daysthisyear), l: 'days at the movies' }, { v: perweekavg, l: 'films / week avg' }, { v: String(bestweek.count), l: 'busiest week', color: 'var(--accent-amber)' }] as ms, i (ms.l)}
					<div>
						<div
							class="font-num font-bold text-[32px] leading-[0.9] tracking-[-0.02em]"
							style="color: {ms.color ?? 'var(--text)'};"
						>
							{ms.v}
						</div>
						<div class="text-[12px] mt-[5px]" style="color: var(--text-muted);">{ms.l}</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- heatmap card -->
		<Card cap="{fmtint(yeartotal)} films logged across {activeweeks} weeks of {curyear}">
			<div class="mt-1">
				<Heatmap
					daycounts={stats.daycounts}
					year={curyear}
					accent="var(--accent-amber)"
					diary={dsctx.data ? dsctx.data.diary : []}
				/>
			</div>
		</Card>

		<!-- films per week -->
		<Card title="Films per week · {curyear}" cap="peak {bestweek.count} in one week">
			{#snippet actions()}
				<MetricToggle value={weekmetric} onchange={(v) => (weekmetric = v)} options={activitytoggleopts} />
			{/snippet}
			<ColumnChart
				data={weekrows}
				accent="var(--accent-amber)"
				height={130}
				gap={2}
				valuekey="value"
				format={(v) => weekmetric === 'rating' ? v.toFixed(2) : v.toLocaleString('en-US')}
			/>
		</Card>

		<!-- top 7 films of the year -->
		<Card title="Top films · {curyear}">
			{#snippet actions()}
				<Infotip text="<strong style='color: var(--text); font-weight: bold; display: block; margin-bottom: 4px;'>Selection priority</strong>Films are ranked by highest rating. Ties are broken by favourites, then rewatch count, and finally recency." />
			{/snippet}

			{#if top7films.length === 0}
				<div class="py-8 font-mono text-[13px] text-center" style="color: var(--text-dim);">
					No films watched in {curyear}
				</div>
			{:else}
				<div
					class="grid gap-[14px]"
					style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));"
				>
					{#each top7films as item (item.uri)}
						<div
							class="flex flex-col p-3.5 rounded-[10px] border border-[var(--border)] gap-2.5 transition-colors duration-200"
							style="background: {hoveredFilmUri === item.uri ? 'color-mix(in oklab, var(--text) 4%, var(--bg-1))' : 'var(--bg-1)'};"
						>
							<a
								href="{base}/films/{filmslug(item.uri)}"
								class="group flex flex-col gap-2"
								onmouseenter={() => (hoveredFilmUri = item.uri)}
								onmouseleave={() => (hoveredFilmUri = null)}
							>
								<div
									class="relative overflow-hidden rounded-[8px] border border-[var(--border)] flex flex-col"
									style="aspect-ratio: 2/3; background: var(--bg-card);"
								>
									{#if tmdbposter(item.tmdb?.poster)}
										<img
											src={tmdbposter(item.tmdb?.poster)}
											alt={item.name}
											class="w-full h-full object-cover"
											loading="lazy"
										/>
									{:else}
										<div class="flex-1 flex items-end p-3">
											<span
												class="font-display font-semibold text-[12px] leading-tight"
												style="color: var(--text-muted);"
											>
												{item.name}
											</span>
										</div>
									{/if}
								</div>
								<div>
									<div
										class="text-[12px] font-medium leading-tight truncate group-hover:text-[var(--accent)] transition-colors"
										title={item.name}
									>
										{item.name}
									</div>
									{#if item.tmdb?.director}
										<div
											class="text-[11px] mt-0.5 truncate"
											style="color: var(--text-dim);"
											title={item.tmdb.director}
										>
											by {item.tmdb.director}
										</div>
									{/if}
								</div>
							</a>
						</div>
					{/each}
				</div>
			{/if}
		</Card>

		<!-- rewatch + per-year -->
		<div class="grid grid-cols-2 gap-[18px]">
			<Card title="Rewatch statistics">
				{#snippet actions()}
					<Infotip text="<strong style='color: var(--text); font-weight: bold; display: block; margin-bottom: 4px;'>Selection priority</strong>Films are ranked by watch count. Ties are broken by rating, then likes, favourites, and finally recency." />
				{/snippet}
				<div class="flex gap-[32px] mb-5">
					<div>
						<div
							class="font-num font-bold text-[42px] leading-[0.9] tracking-[-0.02em]"
							style="color: var(--accent-green);"
						>
							{stats.rewatchpct}%
						</div>
						<div class="text-[12px] mt-[5px]" style="color: var(--text-muted);">
							of all viewings are rewatches
						</div>
					</div>
					<div>
						<div
							class="font-num font-bold text-[42px] leading-[0.9] tracking-[-0.02em]"
							style="color: var(--text);"
						>
							{fmtint(stats.rewatchcount)}
						</div>
						<div class="text-[12px] mt-[5px]" style="color: var(--text-muted);">
							total rewatches logged
						</div>
					</div>
				</div>
				{#if stats.mostrewatched.length > 0}
					<div
						class="font-mono text-[10px] tracking-[0.12em] uppercase mb-3"
						style="color: var(--text-dim);"
					>
						Most returned to
					</div>
					<BarList
						rows={stats.mostrewatched.map((r) => ({
							label: r.name,
							value: r.times,
							href: filmslugmap.get(r.name) ? `${base}/films/${filmslugmap.get(r.name)}` : undefined
						}))}
						accent="var(--accent-green)"
						showrank={true}
						renderval={(v) => '×' + v}
					/>
				{/if}
			</Card>

			<Card title="Films per year">
				{#snippet actions()}
					<MetricToggle value={yearmetric} onchange={(v) => (yearmetric = v)} options={activitytoggleopts} />
				{/snippet}
				<div class="flex-1 flex flex-col justify-end">
					<ColumnChart
						data={yearrows}
						accent="var(--accent-blue)"
						height={200}
						valuekey="value"
						showvalues={true}
						format={(v) => yearmetric === 'rating' ? v.toFixed(2) : v.toLocaleString('en-US')}
					/>
				</div>
			</Card>
		</div>
	</div>
{/if}
