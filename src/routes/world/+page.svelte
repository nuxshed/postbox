<script lang="ts">
	import { getContext } from 'svelte';
	import type { dataset } from '$lib/pipeline/types';
	import { computeworld } from '$lib/stats/world';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import MetricToggle from '$lib/components/metrictoggle.svelte';
	import BarList from '$lib/components/barlist.svelte';
	import WorldMap from '$lib/components/worldmap.svelte';
	import Card from '$lib/components/card.svelte';
	import ListExpansion from '$lib/components/listexpansion.svelte';

	const dsctx = getContext<{ data: dataset | null }>('dataset');
	const stats = $derived(dsctx.data ? computeworld(dsctx.data) : null);

	let mapMetric = $state('count');
	let countryMetric = $state('count');
	let langMetric = $state('count');

	let countryLimit = $state(10);
	let langLimit = $state(10);

	const hasratings = $derived(dsctx.data?.films.some((f) => f.rating !== null) ?? false);
	const haslikes = $derived(dsctx.data?.films.some((f) => f.liked) ?? false);
	const toggleopts = $derived.by(() => {
		const opts = [{ id: 'count', label: 'Watched' }];
		if (haslikes) {
			opts.push({ id: 'liked', label: 'Liked' });
		}
		if (hasratings && stats && (stats.countrydist.some((c) => c.avg > 0) || stats.langdist.some((l) => l.avg > 0))) {
			opts.push({ id: 'rating', label: 'Rating' });
		}
		return opts;
	});

	$effect(() => {
		if (toggleopts.length > 0) {
			if (!toggleopts.some((o) => o.id === mapMetric)) {
				mapMetric = toggleopts[0].id;
			}
			if (!toggleopts.some((o) => o.id === countryMetric)) {
				countryMetric = toggleopts[0].id;
			}
			if (!toggleopts.some((o) => o.id === langMetric)) {
				langMetric = toggleopts[0].id;
			}
		}
	});

	const sortedCountries = $derived(
		stats
			? countryMetric === 'liked'
				? stats.countrydist.slice().sort((a, b) => b.liked - a.liked)
				: countryMetric === 'count'
					? stats.countrydist.slice().sort((a, b) => b.count - a.count)
					: stats.countrydist.slice().sort((a, b) => b.avg - a.avg)
			: []
	);

	const countryrows = $derived(
		sortedCountries.slice(0, countryLimit)
			.map((d) => ({
				label: d.name,
				value: countryMetric === 'count' ? d.count : countryMetric === 'liked' ? d.liked : d.avg,
				href: `${base}/films?country=${encodeURIComponent(d.name)}`
			}))
	);

	const sortedLangs = $derived(
		stats
			? langMetric === 'liked'
				? stats.langdist.slice().sort((a, b) => b.liked - a.liked)
				: langMetric === 'count'
					? stats.langdist.slice().sort((a, b) => b.count - a.count)
					: stats.langdist.slice().sort((a, b) => b.avg - a.avg)
			: []
	);

	const langrows = $derived(
		sortedLangs.slice(0, langLimit)
			.map((d) => ({
				label: d.name,
				value: langMetric === 'count' ? d.count : langMetric === 'liked' ? d.liked : d.avg,
				href: `${base}/films?language=${encodeURIComponent(d.code)}`
			}))
	);

	function fmtrating(v: number) {
		return v.toFixed(2);
	}
</script>

{#if !stats}
	<div class="py-[60px] font-mono text-[13px]" style="color: var(--text-dim);">
		No data — run the import pipeline first.
	</div>
{:else}
	<div class="flex flex-col gap-[18px]">
		<!-- world map -->
		<Card
			title="Cinema by geography"
			cap="{stats.countrydist.length} countries · {stats.langdist.length} languages"
		>
			{#snippet actions()}
				<MetricToggle value={mapMetric} onchange={(v) => (mapMetric = v)} options={toggleopts} />
			{/snippet}
			<WorldMap
				data={stats.countrydist}
				metric={mapMetric}
				oncountryclick={(name) => goto(`${base}/films?country=${encodeURIComponent(name)}`)}
			/>
		</Card>

		<!-- country + language breakdown -->
		<div class="grid grid-cols-2 gap-[18px] items-start">
			<Card title="By country">
				{#snippet actions()}
					<MetricToggle
						value={countryMetric}
						onchange={(v) => {
							countryMetric = v;
							countryLimit = 10;
						}}
						options={toggleopts}
					/>
				{/snippet}
				<BarList
					rows={countryrows}
					accent="var(--accent)"
					showrank={true}
					format={countryMetric === 'rating' ? fmtrating : (v) => v.toLocaleString('en-US')}
					renderval={countryMetric === 'rating' ? fmtrating : undefined}
				/>
				<ListExpansion total={sortedCountries.length} bind:limit={countryLimit} />
			</Card>

			<Card title="By language">
				{#snippet actions()}
					<MetricToggle
						value={langMetric}
						onchange={(v) => {
							langMetric = v;
							langLimit = 10;
						}}
						options={toggleopts}
					/>
				{/snippet}
				<BarList
					rows={langrows}
					accent="var(--accent-blue)"
					showrank={true}
					format={langMetric === 'rating' ? fmtrating : (v) => v.toLocaleString('en-US')}
					renderval={langMetric === 'rating' ? fmtrating : undefined}
				/>
				<ListExpansion total={sortedLangs.length} bind:limit={langLimit} />
			</Card>
		</div>
	</div>
{/if}
