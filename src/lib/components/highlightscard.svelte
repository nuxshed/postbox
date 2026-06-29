<script lang="ts">
	import { base } from '$app/paths';
	import { filmslug, tmdbposter } from '$lib/utils';
	import Card from './card.svelte';
	import Infotip from './infotip.svelte';
	import MetricToggle from './metrictoggle.svelte';

	interface HighlightItem {
		label: string;
		count: number;
		avg: string;
		liked: number;
		top: {
			name: string;
			director: string | null;
			rating: number | null;
			poster: string | null;
			uri: string;
		} | null;
	}

	interface Props {
		title: string;
		cap?: string;
		items: HighlightItem[];
		metric: 'rating' | 'liked' | 'count';
		metricOptions: { id: string; label: string }[];
		onchange: (v: 'rating' | 'liked' | 'count') => void;
	}

	let {
		title,
		cap = '',
		items = [],
		metric,
		onchange,
		metricOptions = []
	}: Props = $props();

	let hoveredLabel = $state<string | null>(null);
</script>

<Card {title} {cap}>
	{#snippet actions()}
		<div class="flex items-center gap-2">
			<Infotip text="<strong style='color: var(--text); font-weight: bold; display: block; margin-bottom: 4px;'>Selection priority</strong>Films are ranked by highest rating. Ties are broken by favourites, then rewatch count, and finally recency." />
			{#if metricOptions.length > 1}
				<MetricToggle value={metric} onchange={(v) => onchange(v as any)} options={metricOptions} />
			{/if}
		</div>
	{/snippet}

	<div
		class="grid gap-[14px]"
		style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));"
	>
		{#each items as item (item.label)}
			{#if item.count > 0 || item.top}
				<div
					class="flex flex-col p-3.5 rounded-[10px] border border-[var(--border)] gap-2.5 transition-colors duration-200"
					style="background: {hoveredLabel === item.label ? 'color-mix(in oklab, var(--text) 4%, var(--bg-1))' : 'var(--bg-1)'};"
				>
					<div class="flex items-baseline justify-between gap-1 overflow-hidden">
						<span
							class="font-mono text-[10px] tracking-[0.08em] uppercase truncate"
							style="color: var(--text-dim);"
							title={item.label}
						>
							{item.label}
						</span>
						<span class="font-num text-[11px] shrink-0" style="color: var(--text-muted);">
							{#if metric === 'rating'}
								{item.avg}★
							{:else if metric === 'liked'}
								{item.liked} liked
							{:else}
								{item.count.toLocaleString()} film{item.count === 1 ? '' : 's'}
							{/if}
						</span>
					</div>

					{#if item.top}
						<a
							href="{base}/films/{filmslug(item.top.uri)}"
							class="group flex flex-col gap-2"
							onmouseenter={() => (hoveredLabel = item.label)}
							onmouseleave={() => (hoveredLabel = null)}
						>
							<div
								class="relative overflow-hidden rounded-[8px] border border-[var(--border)] flex flex-col"
								style="aspect-ratio: 2/3; background: var(--bg-card);"
							>
								{#if tmdbposter(item.top.poster)}
									<img
										src={tmdbposter(item.top.poster)}
										alt={item.top.name}
										class="w-full h-full object-cover"
										loading="lazy"
									/>
								{:else}
									<div class="flex-1 flex items-end p-3">
										<span
											class="font-display font-semibold text-[12px] leading-tight"
											style="color: var(--text-muted);"
										>
											{item.top.name}
										</span>
									</div>
								{/if}
							</div>
							<div>
								<div
									class="text-[12px] font-medium leading-tight truncate group-hover:text-[var(--accent)] transition-colors"
									title={item.top.name}
								>
									{item.top.name}
								</div>
								{#if item.top.director}
									<div
										class="text-[11px] mt-0.5 truncate"
										style="color: var(--text-dim);"
										title={item.top.director}
									>
										by {item.top.director}
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
