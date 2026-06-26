<script lang="ts">
	import { getContext } from 'svelte';
	import type { dataset } from '$lib/pipeline/types';
	import { computeera } from '$lib/stats/era';
	import MetricToggle from '$lib/components/metrictoggle.svelte';
	import ColumnChart from '$lib/components/columnchart.svelte';
	import Card from '$lib/components/card.svelte';
	import IconStarFilled from '~icons/tabler/star-filled';

	const dsctx = getContext<{ data: dataset | null }>('dataset');
	const stats = $derived(dsctx.data ? computeera(dsctx.data) : null);

	let decademetric = $state('count');
	let seasonmetric = $state('count');

	const decaderows = $derived(
		stats
			? stats.decadedist.map((d) => ({
					label: d.label,
					value: decademetric === 'count' ? d.count : d.avg,
					title:
						d.label +
						': ' +
						(decademetric === 'count' ? d.count + ' films' : d.avg.toFixed(2) + '★')
				}))
			: []
	);

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
				<MetricToggle value={decademetric} onchange={(v) => (decademetric = v)} />
			{/snippet}
			<ColumnChart
				data={decaderows}
				accent="var(--accent-amber)"
				height={200}
				gap={10}
				valuekey="value"
				showvalues={true}
				format={(v) => (decademetric === 'rating' ? v.toFixed(1) : v.toLocaleString('en-US'))}
			/>
		</Card>

		<!-- release year + seasonal -->
		<div class="grid gap-[18px]" style="grid-template-columns: 3fr 2fr;">
			<Card title="Release year">
				<div class="flex-1 flex flex-col justify-end">
					<ColumnChart
						data={stats.releaseyears}
						accent="var(--accent-amber)"
						height={160}
						gap={2}
						valuekey="count"
					/>
				</div>
			</Card>

			<Card title="Seasonal patterns">
				{#snippet actions()}
					<MetricToggle value={seasonmetric} onchange={(v) => (seasonmetric = v)} />
				{/snippet}
				<div class="flex-1 flex flex-col justify-end">
					<ColumnChart
						data={stats.seasonal.map((s) => ({
							label: s.month.slice(0, 3),
							value: seasonmetric === 'count' ? s.count : s.avg,
							title:
								s.month +
								': ' +
								(seasonmetric === 'count'
									? s.count.toLocaleString() + ' films'
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
						{seasonmetric === 'count' ? seasonavgcount : seasonavgrating}
					</span>
					<span class="text-[12px]" style="color: var(--text-muted);">
						{seasonmetric === 'count' ? 'avg films per month' : 'avg rating across all months'}
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
								<div
									class="text-[12.5px] font-medium leading-[1.3] truncate"
									style="color: var(--text);"
									title={era.top.name}
								>
									{era.top.name}
								</div>
								{#if era.top.director}
									<div
										class="text-[11px] mt-[3px] truncate"
										style="color: var(--text-dim);"
										title={era.top.director}
									>
										{era.top.director}
									</div>
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
