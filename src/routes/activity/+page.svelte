<script lang="ts">
	import { getContext } from 'svelte';
	import type { dataset } from '$lib/pipeline/types';
	import { computeactivity, weeksofyear } from '$lib/stats/activity';
	import { filmslug } from '$lib/utils';
	import { base } from '$app/paths';
	import BarList from '$lib/components/barlist.svelte';
	import ColumnChart from '$lib/components/columnchart.svelte';
	import Heatmap from '$lib/components/heatmap.svelte';
	import Card from '$lib/components/card.svelte';

	const dsctx = getContext<{ data: dataset | null }>('dataset');
	const stats = $derived(dsctx.data ? computeactivity(dsctx.data) : null);

	const filmslugmap = $derived.by(() => {
		const map = new Map<string, string>();
		if (!dsctx.data) return map;
		for (const f of dsctx.data.films) map.set(f.name, filmslug(f.uri));
		return map;
	});

	let year = $state(0);
	const curyear = $derived(
		stats ? year || stats.years[stats.years.length - 1] : new Date().getFullYear()
	);

	const weeks = $derived(stats ? weeksofyear(stats.daycounts, curyear) : []);
	const yeartotal = $derived(stats ? (stats.yeartotals[String(curyear)] ?? 0) : 0);
	const activeweeks = $derived(weeks.filter((w) => w.count > 0).length);
	const bestweek = $derived(
		weeks.reduce((m, w) => (w.count > m.count ? w : m), { count: 0, label: '', title: '' })
	);
	const perweekavg = $derived((yeartotal / 52).toFixed(1));
	const daysthisyear = $derived(
		stats ? Object.keys(stats.daycounts).filter((k) => k.slice(0, 4) === String(curyear)).length : 0
	);

	const yearrows = $derived(
		stats
			? stats.years.map((y) => ({
					label: "'" + String(y).slice(2),
					count: stats.yeartotals[String(y)] ?? 0,
					title: String(y) + ' · ' + (stats.yeartotals[String(y)] ?? 0) + ' films'
				}))
			: []
	);

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
			{#snippet actions()}
				<div class="flex items-center gap-[6px]">
					<span class="font-mono text-[10px]" style="color: var(--text-dim);">Year</span>
					<div
						class="flex items-center gap-[4px] p-[3px] rounded-[7px] border border-[var(--border)]"
						style="background: var(--bar-track);"
					>
						{#each stats.years as y (y)}
							{@const active = y === curyear}
							<button
								class="font-mono text-[10.5px] px-[9px] py-[4px] rounded-[5px] transition-all"
								style={active
									? 'color: var(--text); background: color-mix(in oklab, var(--accent-amber) 18%, transparent); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--accent-amber) 35%, transparent);'
									: 'color: var(--text-dim);'}
								onclick={() => (year = y)}
							>
								{y}
							</button>
						{/each}
					</div>
				</div>
			{/snippet}
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
			<ColumnChart
				data={weeks}
				accent="var(--accent-amber)"
				height={130}
				gap={2}
				valuekey="count"
			/>
		</Card>

		<!-- rewatch + per-year -->
		<div class="grid grid-cols-2 gap-[18px]">
			<Card title="Rewatch statistics">
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
							sub: r.director ?? undefined,
							href: filmslugmap.get(r.name) ? `${base}/films/${filmslugmap.get(r.name)}` : undefined
						}))}
						accent="var(--accent-green)"
						showrank={true}
						renderval={(v) => '×' + v}
					/>
				{/if}
			</Card>

			<Card title="Films per year">
				<div class="flex-1 flex flex-col justify-end">
					<ColumnChart data={yearrows} accent="var(--accent-blue)" height={200} showvalues={true} />
				</div>
			</Card>
		</div>
	</div>
{/if}
