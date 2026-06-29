<script lang="ts">
	import { getContext } from 'svelte';
	import type { dataset } from '$lib/pipeline/types';
	import { computetags } from '$lib/stats/tags';
	import { base } from '$app/paths';
	import BarList from '$lib/components/barlist.svelte';
	import Card from '$lib/components/card.svelte';
	import MetricToggle from '$lib/components/metrictoggle.svelte';
	import IconStarFilled from '~icons/tabler/star-filled';
	import ListExpansion from '$lib/components/listexpansion.svelte';
	import HighlightsCard from '$lib/components/highlightscard.svelte';

	const dsctx = getContext<{ data: dataset | null }>('dataset');
	const rangectx = getContext<{ kind: string }>('range');
	const tagminthreshold = $derived(
		rangectx.kind === 'all' ? 5 : rangectx.kind === '6mo' ? 2 : 1
	);

	const hasratings = $derived(dsctx.data?.films.some((f) => f.rating !== null) ?? false);
	const haslikes = $derived(dsctx.data?.films.some((f) => f.liked) ?? false);
	const rawstats = $derived(dsctx.data ? computetags(dsctx.data, tagminthreshold) : null);

	let tagHighlightMetric = $state<'rating' | 'liked' | 'count'>('rating');
	let limit = $state(10);
	let ratedmetric = $state('rating');

	const stats = $derived(
		dsctx.data
			? computetags(dsctx.data, tagminthreshold, tagHighlightMetric)
			: null
	);

	const highlightopts = $derived.by(() => {
		const opts = [{ id: 'count', label: 'Watched' }];
		if (haslikes) {
			opts.push({ id: 'liked', label: 'Liked' });
		}
		const hasRatedTags = rawstats && rawstats.tags.some((t) => t.avg > 0);
		if (hasratings && hasRatedTags) {
			opts.push({ id: 'rating', label: 'Rating' });
		}
		return opts;
	});

	$effect(() => {
		if (dsctx.data && highlightopts.length > 0) {
			if (!highlightopts.some((o) => o.id === tagHighlightMetric)) {
				const hasRating = highlightopts.some((o) => o.id === 'rating');
				const hasLiked = highlightopts.some((o) => o.id === 'liked');
				if (hasRating) {
					tagHighlightMetric = 'rating';
				} else if (hasLiked) {
					tagHighlightMetric = 'liked';
				} else {
					tagHighlightMetric = 'count';
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
		if (hasratings && stats && stats.byrating.some((t) => t.avg > 0)) {
			opts.push({ id: 'rating', label: 'By avg rating' });
		}
		if (haslikes || (!haslikes && !hasratings)) {
			opts.push({ id: 'liked', label: 'Most liked' });
		}
		return opts;
	});

	const countrows = $derived(
		stats
			? stats.bycount.slice(0, limit).map((t) => ({
					label: '#' + t.name,
					value: t.count,
					href: `${base}/films?tag=${encodeURIComponent(t.name)}`
				}))
			: []
	);
	const ratingrows = $derived(
		stats
			? stats.byrating.slice(0, limit).map((t) => ({
					label: '#' + t.name,
					value: t.avg,
					href: `${base}/films?tag=${encodeURIComponent(t.name)}`
				}))
			: []
	);
	const likedrows = $derived(
		stats
			? stats.byliked.slice(0, limit).map((t) => ({
					label: '#' + t.name,
					value: t.liked,
					href: `${base}/films?tag=${encodeURIComponent(t.name)}`
				}))
			: []
	);

	const activerows = $derived(ratedmetric === 'liked' ? likedrows : ratingrows);
	const activelist = $derived(ratedmetric === 'liked' ? stats?.byliked ?? [] : stats?.byrating ?? []);
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
					Tags used
				</div>
				<div
					class="font-display font-bold text-[52px] leading-none tracking-[-0.03em]"
					style="color: var(--text);"
				>
					{stats.tags.length}
				</div>
				<div class="text-[12.5px] mt-1" style="color: var(--text-muted);">
					{stats.totallogs.toLocaleString('en-US')} tag applications
				</div>
			</section>
			<section
				class="rounded-[14px] border border-[var(--border)] p-5 px-[22px] flex flex-col justify-center"
				style="background: var(--bg-card);"
			>
				<div
					class="font-mono text-[10.5px] tracking-[0.08em] uppercase mb-2"
					style="color: var(--text-dim);"
				>
					Most used
				</div>
				<a
					href="{base}/films?tag={encodeURIComponent(stats.toptag.name)}"
					class="font-mono font-bold text-[28px] leading-[1.1] tracking-[0.02em] mb-1 transition-[color] block"
					style="color: var(--accent);"
					onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)')}
					onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
				>
					#{stats.toptag.name}
				</a>
				<div class="text-[12.5px]" style="color: var(--text-muted);">
					{stats.toptag.count.toLocaleString('en-US')} film{stats.toptag.count === 1 ? '' : 's'}
				</div>
			</section>
			<section
				class="rounded-[14px] border border-[var(--border)] p-5 px-[22px] flex flex-col justify-center"
				style="background: var(--bg-card);"
			>
				<div
					class="font-mono text-[10.5px] tracking-[0.08em] uppercase mb-2"
					style="color: var(--text-dim);"
				>
					Avg rating across tags
				</div>
				<div
					class="font-num font-bold text-[52px] leading-[0.9] tracking-[-0.03em] mb-1"
					style="color: var(--text);"
				>
					{stats.avgacross.toFixed(2)}
				</div>
				<div class="text-[12.5px]" style="color: var(--text-muted);">across all tags</div>
			</section>
		</div>
		<!-- tag highlights -->
		<HighlightsCard
			title="Tag highlights"
			cap="your favourite film from your top tags"
			items={stats.taghighlights.map((th) => ({
				label: '#' + th.tag,
				count: th.count,
				avg: th.avg,
				liked: th.liked,
				top: th.top
			}))}
			metric={tagHighlightMetric}
			metricOptions={highlightopts}
			onchange={(v: 'rating' | 'liked' | 'count') => (tagHighlightMetric = v)}
		/>

		<!-- two lists -->
		<div class="grid grid-cols-2 gap-[18px]">
			<Card title="By film count">
				<BarList rows={countrows} accent="var(--accent)" showrank={true} />
				{#if stats}
					<ListExpansion total={stats.bycount.length} bind:limit />
				{/if}
			</Card>
			<Card title={ratedmetric === 'liked' ? 'Most liked' : 'By avg rating'}>
				{#snippet actions()}
					{#if ratedopts.length > 1}
						<MetricToggle value={ratedmetric} onchange={(v) => (ratedmetric = v)} options={ratedopts} />
					{/if}
				{/snippet}
				<BarList
					rows={activerows}
					accent="var(--accent-amber)"
					showrank={true}
					format={ratedmetric === 'liked' ? (v) => v.toLocaleString('en-US') : (v) => v.toFixed(1) + '★'}
				/>
				<ListExpansion total={activelist.length} bind:limit />
			</Card>
		</div>

		<!-- all tags cloud -->
		<Card title="All tags">
			<div class="flex flex-wrap gap-2">
				{#each stats.bycount as t (t.name)}
					{@const intensity = Math.round((t.count / (stats.bycount[0]?.count || 1)) * 10)}
					<a
						href="{base}/films?tag={encodeURIComponent(t.name)}"
						class="flex items-center gap-2 px-[13px] py-[7px] rounded-[8px] border border-[var(--border)] transition-[border-color]"
						style="background: color-mix(in oklab, var(--accent) {intensity}%, transparent);"
						onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)')}
						onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
					>
						<span class="font-mono text-[12px]" style="color: var(--text);">#{t.name}</span>
						<span class="font-mono text-[10.5px]" style="color: var(--text-dim);"
							>{t.count.toLocaleString('en-US')}</span
						>
						{#if t.avg > 0}
							<span class="font-mono text-[10.5px] flex items-center gap-0.5" style="color: var(--text-muted);"
								>{t.avg.toFixed(1)}<IconStarFilled width="10" height="10" class="text-[var(--accent-amber)] shrink-0" /></span
							>
						{/if}
					</a>
				{/each}
			</div>
		</Card>
	</div>
{/if}
