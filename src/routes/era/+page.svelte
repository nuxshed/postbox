<script lang="ts">
	import { getContext } from 'svelte';
	import type { dataset } from '$lib/pipeline/types';
	import { computeera } from '$lib/stats/era';
	import { filmslug, tmdbposter } from '$lib/utils';
	import { base } from '$app/paths';
	import MetricToggle from '$lib/components/metrictoggle.svelte';
	import ColumnChart from '$lib/components/columnchart.svelte';
	import Card from '$lib/components/card.svelte';
	import IconStarFilled from '~icons/tabler/star-filled';
	import Infotip from '$lib/components/infotip.svelte';

	const dsctx = getContext<{ data: dataset | null }>('dataset');
	const stats = $derived(dsctx.data ? computeera(dsctx.data) : null);

	let decademetric = $state('count');
	let seasonmetric = $state('count');
	let yearmetric = $state('count');
	let hoveredDecade = $state<string | null>(null);

	const hasratings = $derived(dsctx.data?.films.some((f) => f.rating !== null) ?? false);
	const haslikes = $derived(dsctx.data?.films.some((f) => f.liked) ?? false);
	const toggleopts = $derived.by(() => {
		const opts = [{ id: 'count', label: 'Watched' }];
		if (haslikes) {
			opts.push({ id: 'liked', label: 'Liked' });
		}
		if (hasratings && stats && (stats.decadedist.some((d) => d.avg > 0) || stats.seasonal.some((s) => s.avg > 0))) {
			opts.push({ id: 'rating', label: 'Rating' });
		}
		return opts;
	});

	$effect(() => {
		if (toggleopts.length > 0) {
			if (!toggleopts.some((o) => o.id === decademetric)) decademetric = toggleopts[0].id;
			if (!toggleopts.some((o) => o.id === seasonmetric)) seasonmetric = toggleopts[0].id;
			if (!toggleopts.some((o) => o.id === yearmetric)) yearmetric = toggleopts[0].id;
		}
	});

	const decaderows = $derived(
		stats
			? stats.decadedist.map((d) => ({
					label: d.label,
					value: decademetric === 'count' ? d.count : decademetric === 'liked' ? d.liked : d.avg,
					title:
						d.label +
						': ' +
						(decademetric === 'count'
							? d.count + ' films'
							: decademetric === 'liked'
								? d.liked + ' liked'
								: d.avg.toFixed(2) + '★'),
					decade: d.decade
				}))
			: []
	);

	const yearrows = $derived.by(() => {
		if (!stats) return [];
		return stats.releaseyears.map((y) => {
			const val = yearmetric === 'liked' ? y.liked : yearmetric === 'rating' ? y.avg : y.count;
			const valstr = yearmetric === 'rating' ? y.avg.toFixed(2) + '★' : val.toLocaleString('en-US');
			return { ...y, value: val, title: String(y.year) + ' · ' + valstr };
		});
	});

	const decadeaxislabels = $derived.by(() => {
		if (!stats) return [];
		return stats.releaseyears
			.map((y, i) => ({ year: y.year, i }))
			.filter(({ year }) => year % 10 === 0)
			.map(({ year, i }) => ({ label: "'" + String(year).slice(2) + 's', index: i }));
	});

	const seasonavgcount = $derived(
		stats ? Math.round(stats.seasonal.reduce((a, s) => a + s.count, 0) / 12) : 0
	);
	const seasonavgrating = $derived(
		stats ? (stats.seasonal.reduce((a, s) => a + s.avg, 0) / stats.seasonal.length).toFixed(2) : '0'
	);
</script>

{#if !stats}
	<div class="py-[60px] font-mono text-[13px]" style="color: var(--text-dim);">
		No data — run the import pipeline first.
	</div>
{:else}
	<div class="flex flex-col gap-[18px]">
		<!-- decade breakdown -->
		<Card title="By decade">
			{#snippet actions()}
				<MetricToggle value={decademetric} onchange={(v) => (decademetric = v)} options={toggleopts} />
			{/snippet}
			<ColumnChart
				data={decaderows}
				accent="var(--accent-amber)"
				height={200}
				gap={10}
				valuekey="value"
				showvalues={true}
				format={(v) => (decademetric === 'rating' ? v.toFixed(1) : v.toLocaleString('en-US'))}
				gethref={(d) => d.decade ? `${base}/films?decade=${d.decade}` : undefined}
			/>
		</Card>

		<!-- release year + seasonal -->
		<div class="grid gap-[18px]" style="grid-template-columns: 3fr 2fr;">
			<Card title="Release year">
				{#snippet actions()}
					<MetricToggle value={yearmetric} onchange={(v) => (yearmetric = v)} options={toggleopts} />
				{/snippet}
				<div class="flex-1 flex flex-col justify-end">
					<ColumnChart
						data={yearrows}
						accent="var(--accent-amber)"
						height={160}
						gap={2}
						valuekey="value"
						format={(v) => yearmetric === 'rating' ? v.toFixed(2) + '★' : v.toLocaleString('en-US')}
						gethref={(d) => d.year ? `${base}/films?year=${d.year}` : undefined}
						axislabels={decadeaxislabels}
					/>
				</div>
			</Card>

			<Card title="Seasonal patterns">
				{#snippet actions()}
					<MetricToggle value={seasonmetric} onchange={(v) => (seasonmetric = v)} options={toggleopts} />
				{/snippet}
				<div class="flex-1 flex flex-col justify-end">
					<ColumnChart
						data={stats.seasonal.map((s) => ({
							label: s.month.slice(0, 3),
							value: seasonmetric === 'count' ? s.count : seasonmetric === 'liked' ? s.liked : s.avg,
							title:
								s.month +
								': ' +
								(seasonmetric === 'count'
									? s.count.toLocaleString() + ' films'
									: seasonmetric === 'liked'
										? s.liked + ' liked'
										: s.avg.toFixed(2) + '★')
						}))}
						accent="var(--accent-blue)"
						height={140}
						valuekey="value"
					/>
				</div>
				<div class="flex items-baseline gap-[8px] mt-3 pt-3 border-t border-[var(--border)]">
					<span
						class="font-num font-bold text-[20px] tracking-[-0.02em]"
						style="color: var(--accent-blue);"
					>
						{seasonmetric === 'count' ? seasonavgcount : seasonmetric === 'liked' ? stats.seasonal.reduce((a, s) => a + s.liked, 0) : seasonavgrating}
					</span>
					<span class="text-[12px]" style="color: var(--text-muted);">
						{seasonmetric === 'count' ? 'avg films per month' : seasonmetric === 'liked' ? 'total liked films logged' : 'avg rating across all months'}
					</span>
				</div>
			</Card>
		</div>

		<!-- era highlights -->
		<Card title="Era highlights" cap="your favourite film from each decade">
			{#snippet actions()}
				<Infotip text="<strong style='color: var(--text); font-weight: bold; display: block; margin-bottom: 4px;'>Selection priority</strong>Films are ranked by highest rating. Ties are broken by favourites, then rewatch count, and finally recency." />
			{/snippet}
			<div
				class="grid gap-[14px]"
				style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));"
			>
				{#each stats.erahighlights as era (era.label)}
					{#if era.count > 0 || era.top}
						<div
							class="flex flex-col p-3.5 rounded-[10px] border border-[var(--border)] gap-2.5 transition-colors duration-200"
							style="background: {hoveredDecade === era.label ? 'color-mix(in oklab, var(--text) 4%, var(--bg-1))' : 'var(--bg-1)'};"
						>
							<div class="flex items-baseline justify-between">
								<span
									class="font-mono text-[10px] tracking-[0.12em] uppercase"
									style="color: var(--text-dim);"
								>
									{era.label}
								</span>
								<span class="font-num text-[11px]" style="color: var(--text-muted);">
									{era.count.toLocaleString()} film{era.count === 1 ? '' : 's'}
								</span>
							</div>

							{#if era.top}
								{@const fs = filmslug(era.top.uri)}
								{@const poster = tmdbposter(era.top.poster)}
								<a
									href="{base}/films/{fs}"
									class="group flex flex-col gap-2"
									onmouseenter={() => (hoveredDecade = era.label)}
									onmouseleave={() => (hoveredDecade = null)}
								>
									<div
										class="relative overflow-hidden rounded-[8px] border border-[var(--border)] flex flex-col"
										style="aspect-ratio: 2/3; background: var(--bg-card);"
									>
										{#if poster}
											<img
												src={poster}
												alt={era.top.name}
												class="w-full h-full object-cover"
												loading="lazy"
											/>
										{:else}
											<div class="flex-1 flex items-end p-3">
												<span
													class="font-display font-semibold text-[12px] leading-tight"
													style="color: var(--text-muted);"
												>
													{era.top.name}
												</span>
											</div>
										{/if}
									</div>
									<div>
										<div
											class="text-[12px] font-medium leading-tight truncate group-hover:text-[var(--accent)] transition-colors"
											title={era.top.name}
										>
											{era.top.name}
										</div>
										{#if era.top.director}
											<div
												class="text-[11px] mt-0.5 truncate"
												style="color: var(--text-dim);"
												title={era.top.director}
											>
												by {era.top.director}
											</div>
										{/if}
									</div>
								</a>
							{:else}
								<div
									class="flex-1 flex items-center justify-center rounded-[8px] border border-dashed border-[var(--border)]"
									style="aspect-ratio: 2/3; background: var(--bg-card);"
								>
									<span class="font-mono text-[11px]" style="color: var(--text-dim);">—</span>
								</div>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		</Card>
	</div>
{/if}
