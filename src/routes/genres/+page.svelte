<script lang="ts">
	import { getContext } from 'svelte';
	import type { dataset } from '$lib/pipeline/types';
	import { computegenres } from '$lib/stats/genres';
	import { base } from '$app/paths';
	import { filmslug, tmdbposter } from '$lib/utils';
	import BarList from '$lib/components/barlist.svelte';
	import Card from '$lib/components/card.svelte';
	import Infotip from '$lib/components/infotip.svelte';
	import MetricToggle from '$lib/components/metrictoggle.svelte';
	import ListExpansion from '$lib/components/listexpansion.svelte';
	import HighlightsCard from '$lib/components/highlightscard.svelte';

	const dsctx = getContext<{ data: dataset | null }>('dataset');
	const rangectx = getContext<{ kind: string }>('range');
	const genreminthreshold = $derived(
		rangectx.kind === 'all' ? 5 : rangectx.kind === '6mo' ? 2 : 1
	);
	const hasratings = $derived(dsctx.data?.films.some((f) => f.rating !== null) ?? false);
	const haslikes = $derived(dsctx.data?.films.some((f) => f.liked) ?? false);
	const rawstats = $derived(dsctx.data ? computegenres(dsctx.data, genreminthreshold) : null);

	let highlightmetric = $state<'rating' | 'liked' | 'count'>('rating');
	let ratedmetric = $state('rating');
	let countLimit = $state(10);
	let ratedLimit = $state(10);

	const stats = $derived(
		dsctx.data
			? computegenres(dsctx.data, genreminthreshold, highlightmetric)
			: null
	);

	const highlightopts = $derived.by(() => {
		const opts = [{ id: 'count', label: 'Watched' }];
		if (haslikes) {
			opts.push({ id: 'liked', label: 'Liked' });
		}
		const hasRatedGenres = rawstats && rawstats.genrecount.some((g) => g.count >= genreminthreshold && g.avg > 0);
		if (hasratings && hasRatedGenres) {
			opts.push({ id: 'rating', label: 'Rating' });
		}
		return opts;
	});

	$effect(() => {
		if (dsctx.data && highlightopts.length > 0) {
			if (!highlightopts.some((o) => o.id === highlightmetric)) {
				const hasRating = highlightopts.some((o) => o.id === 'rating');
				const hasLiked = highlightopts.some((o) => o.id === 'liked');
				if (hasRating) {
					highlightmetric = 'rating';
				} else if (hasLiked) {
					highlightmetric = 'liked';
				} else {
					highlightmetric = 'count';
				}
			}
		}
	});

	$effect(() => {
		if (dsctx.data && ratedopts.length > 0) {
			const hasCurrent = ratedopts.some((o) => o.id === ratedmetric);
			if (!hasCurrent) {
				ratedmetric = ratedopts[0].id;
			}
		}
	});

	const ratedopts = $derived.by(() => {
		const opts = [];
		const hasRatedGenres = stats && stats.genrecount.some((g) => g.count >= genreminthreshold && g.avg > 0);
		if (hasratings && hasRatedGenres) {
			opts.push({ id: 'rating', label: 'Highest rated' });
		}
		if (haslikes || (!haslikes && !hasratings)) {
			opts.push({ id: 'liked', label: 'Most liked' });
		}
		return opts;
	});

	const allwatched = $derived(
		stats
			? stats.genrecount.map((g) => ({
					label: g.name,
					value: g.count,
					href: `${base}/films?genre=${encodeURIComponent(g.name)}`
				}))
			: []
	);
	const allrated = $derived(
		stats
			? stats.genrecount
					.filter((g) => g.count >= genreminthreshold)
					.sort((a, b) => b.avg - a.avg)
					.map((g) => ({
						label: g.name,
						value: g.avg,
						href: `${base}/films?genre=${encodeURIComponent(g.name)}`
					}))
			: []
	);
	const allliked = $derived(
		stats
			? stats.genrecount
					.slice()
					.sort((a, b) => b.liked - a.liked)
					.map((g) => ({
						label: g.name,
						value: g.liked,
						href: `${base}/films?genre=${encodeURIComponent(g.name)}`
					}))
			: []
	);
	const allactive = $derived(ratedmetric === 'liked' ? allliked : allrated);

	const herorated = $derived.by(() => {
		if (!stats) return null;
		return ratedmetric === 'liked' ? stats.toplikedgenre : stats.topratedgenre;
	});
</script>

{#if !stats}
	<div class="py-[60px] font-mono text-[13px]" style="color: var(--text-dim);">
		No data — run the import pipeline first.
	</div>
{:else}
	<div class="flex flex-col gap-[18px]">
		<!-- hero row -->
		<div class="grid grid-cols-3 gap-4">
			<section
				class="rounded-[14px] border border-[var(--border)] p-5 px-[22px] flex flex-col justify-center"
				style="background: var(--bg-card);"
			>
				<div
					class="font-mono text-[10.5px] tracking-[0.08em] uppercase mb-2"
					style="color: var(--text-dim);"
				>
					Genres explored
				</div>
				<div
					class="font-display font-bold text-[52px] leading-none tracking-[-0.03em]"
					style="color: var(--text);"
				>
					{stats.totalgenres}
				</div>
				<div class="text-[12.5px] mt-1" style="color: var(--text-muted);">distinct categories</div>
			</section>
			<section
				class="rounded-[14px] border border-[var(--border)] p-5 px-[22px] flex flex-col justify-center"
				style="background: var(--bg-card);"
			>
				<div
					class="font-mono text-[10.5px] tracking-[0.08em] uppercase mb-2"
					style="color: var(--text-dim);"
				>
					Most watched
				</div>
				<a
					href="{base}/films?genre={encodeURIComponent(stats.topgenre.name)}"
					class="font-display font-bold text-[34px] leading-[1.05] tracking-[-0.025em] mb-1 transition-[color] block"
					style="color: var(--accent-blue);"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)')}
				>
					{stats.topgenre.name}
				</a>
				<div class="text-[12.5px]" style="color: var(--text-muted);">
					{stats.topgenre.count.toLocaleString('en-US')} logged entries
				</div>
			</section>
			<section
				class="rounded-[14px] border border-[var(--border)] p-5 px-[22px] flex flex-col justify-center"
				style="background: var(--bg-card);"
			>
				<div class="flex items-center justify-between mb-2">
					<div
						class="font-mono text-[10.5px] tracking-[0.08em] uppercase"
						style="color: var(--text-dim);"
					>
						{ratedmetric === 'liked' ? 'Most liked' : 'Highest rated'}
					</div>
					{#if ratedopts.length > 1}
						<MetricToggle value={ratedmetric} onchange={(v) => (ratedmetric = v)} options={ratedopts} />
					{/if}
				</div>
				{#if herorated}
					<a
						href="{base}/films?genre={encodeURIComponent(herorated.name)}"
						class="font-display font-bold text-[34px] leading-[1.05] tracking-[-0.025em] mb-1 transition-[color] block"
						style="color: var(--accent-amber);"
						onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
						onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent-amber)')}
					>
						{herorated.name}
					</a>
					<div class="text-[12.5px]" style="color: var(--text-muted);">
						{ratedmetric === 'liked' ? herorated.liked + ' liked films' : herorated.avg.toFixed(2) + ' avg rating'}
					</div>
				{/if}
			</section>
		</div>

		<!-- genre highlights -->
		<HighlightsCard
			title="Genre highlights"
			cap="your favourite film from your top genres"
			items={stats.genrehighlights.map((gh) => ({
				label: gh.genre,
				href: `${base}/films?genre=${encodeURIComponent(gh.genre)}`,
				count: gh.count,
				avg: gh.avg,
				liked: gh.liked,
				top: gh.top
			}))}
			metric={highlightmetric}
			metricOptions={highlightopts}
			onchange={(v: 'rating' | 'liked' | 'count') => (highlightmetric = v)}
		/>

		<!-- most watched + highest rated/liked -->
		<div class="grid grid-cols-2 gap-[18px] items-start">
			<Card title="Most watched">
				<BarList rows={allwatched.slice(0, countLimit)} accent="var(--accent-blue)" showrank={true} />
				<ListExpansion total={allwatched.length} bind:limit={countLimit} />
			</Card>
			<Card title={ratedmetric === 'liked' ? 'Most liked' : 'Highest rated'}>
				{#snippet actions()}
					<div class="flex items-center gap-2">
						{#if ratedmetric === 'rating'}
							<Infotip text="Only genres with at least {genreminthreshold} rated {genreminthreshold === 1 ? 'film' : 'films'} are included." />
						{/if}
						{#if ratedopts.length > 1}
							<MetricToggle value={ratedmetric} onchange={(v) => (ratedmetric = v)} options={ratedopts} />
						{/if}
					</div>
				{/snippet}
				<BarList
					rows={allactive.slice(0, ratedLimit)}
					accent="var(--accent-amber)"
					showrank={true}
					format={ratedmetric === 'liked' ? (v) => v.toLocaleString('en-US') : (v) => v.toFixed(2)}
				/>
				<ListExpansion total={allactive.length} bind:limit={ratedLimit} />
			</Card>
		</div>
	</div>
{/if}
