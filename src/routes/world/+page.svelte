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
	import HighlightsCard from '$lib/components/highlightscard.svelte';
	import Infotip from '$lib/components/infotip.svelte';
	import { persistedState } from '$lib/state.svelte';

	const dsctx = getContext<{ data: dataset | null }>('dataset');
	const rangectx = getContext<{ kind: string }>('range');
	const genreminthreshold = $derived(
		rangectx.kind === 'all' ? 5 : rangectx.kind === '6mo' ? 2 : 1
	);

	const mapMetric = persistedState('postbox_metric_world_map', 'count');
	const countryMetric = persistedState<'rating' | 'liked' | 'count'>('postbox_metric_world_country', 'count');
	const langMetric = persistedState<'rating' | 'liked' | 'count'>('postbox_metric_world_lang', 'count');

	let countryLimit = $state(10);
	let langLimit = $state(10);

	const hasratings = $derived(dsctx.data?.films.some((f) => f.rating !== null) ?? false);
	const haslikes = $derived(dsctx.data?.films.some((f) => f.liked) ?? false);

	const stats = $derived(
		dsctx.data
			? computeworld(dsctx.data, genreminthreshold, countryMetric.value, langMetric.value, rangectx.kind)
			: null
	);

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
			if (!toggleopts.some((o) => o.id === mapMetric.value)) {
				mapMetric.value = toggleopts[0].id;
			}
			if (!toggleopts.some((o) => o.id === countryMetric.value)) {
				const hasRating = toggleopts.some((o) => o.id === 'rating');
				countryMetric.value = hasRating ? 'rating' : (toggleopts[0].id as any);
			}
			if (!toggleopts.some((o) => o.id === langMetric.value)) {
				const hasRating = toggleopts.some((o) => o.id === 'rating');
				langMetric.value = hasRating ? 'rating' : (toggleopts[0].id as any);
			}
		}
	});

	const sortedCountries = $derived(
		stats
			? countryMetric.value === 'liked'
				? stats.countrydist.slice().sort((a, b) => b.liked - a.liked)
				: countryMetric.value === 'count'
					? stats.countrydist.slice().sort((a, b) => b.count - a.count)
					: stats.countrydist
							.filter((c) => {
								const minRated = rangectx.kind === 'all' ? 3 : 1;
								return c.ratingsCount >= minRated;
							})
							.slice()
							.sort((a, b) => b.avg - a.avg || b.count - a.count)
			: []
	);

	const countryrows = $derived(
		sortedCountries.slice(0, countryLimit)
			.map((d) => ({
				label: d.name,
				value: countryMetric.value === 'count' ? d.count : countryMetric.value === 'liked' ? d.liked : d.avg,
				href: `${base}/films?country=${encodeURIComponent(d.name)}`
			}))
	);

	const sortedLangs = $derived(
		stats
			? langMetric.value === 'liked'
				? stats.langdist.slice().sort((a, b) => b.liked - a.liked)
				: langMetric.value === 'count'
					? stats.langdist.slice().sort((a, b) => b.count - a.count)
					: stats.langdist
							.filter((l) => {
								const minRated = rangectx.kind === 'all' ? 3 : 1;
								return l.ratingsCount >= minRated;
							})
							.slice()
							.sort((a, b) => b.avg - a.avg || b.count - a.count)
			: []
	);

	const langrows = $derived(
		sortedLangs.slice(0, langLimit)
			.map((d) => ({
				label: d.name,
				value: langMetric.value === 'count' ? d.count : langMetric.value === 'liked' ? d.liked : d.avg,
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
				<MetricToggle value={mapMetric.value} onchange={(v) => (mapMetric.value = v)} options={toggleopts} />
			{/snippet}
			<WorldMap
				data={stats.countrydist}
				metric={mapMetric.value}
				rangeKind={rangectx.kind}
				oncountryclick={(name) => goto(`${base}/films?country=${encodeURIComponent(name)}`)}
			/>
		</Card>

		<!-- country and language highlights -->
		<div class="grid grid-cols-2 gap-[18px]">
			<HighlightsCard
				title="Country highlights"
				cap="your favourite film from your top countries"
				items={stats.countryhighlights.map((ch) => ({
					label: ch.country,
					href: `${base}/films?country=${encodeURIComponent(ch.country)}`,
					count: ch.count,
					avg: ch.avg,
					liked: ch.liked,
					top: ch.top
				}))}
				metric={countryMetric.value}
				metricOptions={toggleopts}
				onchange={(v: 'rating' | 'liked' | 'count') => {
					countryMetric.value = v;
					countryLimit = 10;
				}}
			/>
			<HighlightsCard
				title="Language highlights"
				cap="your favourite film from your top languages"
				items={stats.langhighlights.map((lh) => ({
					label: lh.language,
					href: `${base}/films?language=${encodeURIComponent(lh.code)}`,
					count: lh.count,
					avg: lh.avg,
					liked: lh.liked,
					top: lh.top
				}))}
				metric={langMetric.value}
				metricOptions={toggleopts}
				onchange={(v: 'rating' | 'liked' | 'count') => {
					langMetric.value = v;
					langLimit = 10;
				}}
				accent="var(--accent-blue)"
			/>
		</div>

		<!-- country + language breakdown -->
		<div class="grid grid-cols-2 gap-[18px] items-start">
			<Card title="By country">
				{#snippet actions()}
					<div class="flex items-center gap-2">
						{#if countryMetric.value === 'rating'}
							{@const minRated = rangectx.kind === 'all' ? 3 : 1}
							<Infotip text="Only countries with at least {minRated} rated {minRated === 1 ? 'film' : 'films'} are included." />
						{/if}
						<MetricToggle
							value={countryMetric.value}
							onchange={(v) => {
								countryMetric.value = v as any;
								countryLimit = 10;
							}}
							options={toggleopts}
						/>
					</div>
				{/snippet}
				<BarList
					rows={countryrows}
					accent="var(--accent)"
					showrank={true}
					format={countryMetric.value === 'rating' ? fmtrating : (v) => v.toLocaleString('en-US')}
					renderval={countryMetric.value === 'rating' ? fmtrating : undefined}
				/>
				<ListExpansion total={sortedCountries.length} bind:limit={countryLimit} />
			</Card>

			<Card title="By language">
				{#snippet actions()}
					<div class="flex items-center gap-2">
						{#if langMetric.value === 'rating'}
							{@const minRated = rangectx.kind === 'all' ? 3 : 1}
							<Infotip text="Only languages with at least {minRated} rated {minRated === 1 ? 'film' : 'films'} are included." />
						{/if}
						<MetricToggle
							value={langMetric.value}
							onchange={(v) => {
								langMetric.value = v as any;
								langLimit = 10;
							}}
							options={toggleopts}
						/>
					</div>
				{/snippet}
				<BarList
					rows={langrows}
					accent="var(--accent-blue)"
					showrank={true}
					format={langMetric.value === 'rating' ? fmtrating : (v) => v.toLocaleString('en-US')}
					renderval={langMetric.value === 'rating' ? fmtrating : undefined}
				/>
				<ListExpansion total={sortedLangs.length} bind:limit={langLimit} />
			</Card>
		</div>
	</div>
{/if}
