<script lang="ts">
	import { getContext } from 'svelte';
	import type { dataset } from '$lib/pipeline/types';
	import { computeera } from '$lib/stats/era';
	import { filmslug } from '$lib/utils';
	import { base } from '$app/paths';
	import MetricToggle from '$lib/components/metrictoggle.svelte';
	import ColumnChart from '$lib/components/columnchart.svelte';
	import Card from '$lib/components/card.svelte';
	import IconStarFilled from '~icons/tabler/star-filled';

	const dsctx = getContext<{ data: dataset | null }>('dataset');
	const stats = $derived(dsctx.data ? computeera(dsctx.data) : null);

	const filmslugmap = $derived.by(() => {
		const map = new Map<string, string>();
		if (!dsctx.data) return map;
		for (const f of dsctx.data.films) map.set(f.name, filmslug(f.uri));
		return map;
	});

	let decademetric = $state('count');
	let seasonmetric = $state('count');
	let yearmetric = $state('count');

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
		<Card title="Era highlights" cap="highest-rated film from each decade">
			<div
				class="grid gap-[14px]"
				style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));"
			>
				{#each stats.erahighlights as era (era.label)}
					{#if era.count > 0 || era.top}
						<div
							class="flex flex-col p-4 rounded-[10px] border border-[var(--border)]"
							style="background: var(--bg-1);"
						>
							<div
								class="font-mono text-[10px] tracking-[0.12em] uppercase"
								style="color: var(--text-dim);"
							>
								{era.label}
							</div>
							<div class="mt-[6px]">
								<span
									class="font-num font-bold text-[26px] leading-none tracking-[-0.02em]"
									style="color: var(--text);"
								>
									{era.count.toLocaleString()}
								</span>
								<span class="text-[12px] ml-1" style="color: var(--text-dim);">films</span>
							</div>
							<div class="h-px my-[10px]" style="background: var(--border);"></div>
							{#if era.top}
								{@const fs = filmslugmap.get(era.top.name)}
								{#if fs}
									<a
										href="{base}/films/{fs}"
										class="text-[12.5px] font-medium leading-[1.3] truncate transition-[color]"
								onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
								onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
										style="color: var(--text);"
										title={era.top.name}
									>
										{era.top.name}
									</a>
								{:else}
									<div
										class="text-[12.5px] font-medium leading-[1.3] truncate"
										style="color: var(--text);"
										title={era.top.name}
									>
										{era.top.name}
									</div>
								{/if}
								{#if era.top.director}
									<a
										href="{base}/films?director={encodeURIComponent(era.top.director)}"
										class="text-[11px] mt-[3px] truncate transition-[color] block"
										style="color: var(--text-dim);"
										title={era.top.director}
										onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
										onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-dim)')}
									>
										{era.top.director}
									</a>
								{/if}
								<div
									class="font-mono text-[11px] mt-[6px] font-bold flex items-center gap-0.5"
									style="color: var(--accent-amber);"
								>
									{era.top.rating.toFixed(1)}
									<IconStarFilled width="11" height="11" />
								</div>
							{:else}
								<div class="text-[12px]" style="color: var(--text-dim);">—</div>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		</Card>
	</div>
{/if}
