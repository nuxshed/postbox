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

	const dsctx = getContext<{ data: dataset | null }>('dataset');
	const stats = $derived(dsctx.data ? computeworld(dsctx.data) : null);

	let mapMetric = $state('count');
	let countryMetric = $state('count');
	let langMetric = $state('count');

	let showAllCountries = $state(false);
	let showAllLanguages = $state(false);

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
		(showAllCountries ? sortedCountries : sortedCountries.slice(0, 10))
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
		(showAllLanguages ? sortedLangs : sortedLangs.slice(0, 10))
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
		<div class="grid grid-cols-2 gap-[18px]">
			<Card title="By country">
				{#snippet actions()}
					<MetricToggle
						value={countryMetric}
						onchange={(v) => {
							countryMetric = v;
							showAllCountries = false;
						}}
						options={toggleopts}
					/>
				{/snippet}
				<BarList
					rows={countryrows}
					accent="var(--accent)"
					showrank={true}
					format={countryMetric === 'count' ? (v) => v.toLocaleString('en-US') : fmtrating}
					renderval={countryMetric === 'rating' ? fmtrating : undefined}
				/>
				{#if sortedCountries.length > 10}
					<div class="mt-3 pt-3 border-t border-[var(--border)] flex justify-center">
						<button
							class="font-mono text-[11px] tracking-[0.06em] uppercase transition-colors"
							style="color: var(--text-dim);"
							onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
							onmouseleave={(e) =>
								((e.currentTarget as HTMLElement).style.color = 'var(--text-dim)')}
							onclick={() => (showAllCountries = !showAllCountries)}
							>{showAllCountries ? '↑ show less' : '↓ show all ' + sortedCountries.length}</button
						>
					</div>
				{/if}
			</Card>

			<Card title="By language">
				{#snippet actions()}
					<MetricToggle
						value={langMetric}
						onchange={(v) => {
							langMetric = v;
							showAllLanguages = false;
						}}
						options={toggleopts}
					/>
				{/snippet}
				<BarList
					rows={langrows}
					accent="var(--accent-blue)"
					showrank={true}
					format={langMetric === 'count' ? (v) => v.toLocaleString('en-US') : fmtrating}
					renderval={langMetric === 'rating' ? fmtrating : undefined}
				/>
				{#if sortedLangs.length > 10}
					<div class="mt-3 pt-3 border-t border-[var(--border)] flex justify-center">
						<button
							class="font-mono text-[11px] tracking-[0.06em] uppercase transition-colors"
							style="color: var(--text-dim);"
							onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
							onmouseleave={(e) =>
								((e.currentTarget as HTMLElement).style.color = 'var(--text-dim)')}
							onclick={() => (showAllLanguages = !showAllLanguages)}
							>{showAllLanguages ? '↑ show less' : '↓ show all ' + sortedLangs.length}</button
						>
					</div>
				{/if}
			</Card>
		</div>
	</div>
{/if}
