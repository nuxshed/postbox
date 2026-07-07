<script lang="ts">
	import { getContext } from 'svelte';
	import type { dataset } from '$lib/pipeline/types';
	import { base } from '$app/paths';
	import Card from '$lib/components/card.svelte';
	import ForceGraph from '$lib/components/forcegraph.svelte';
	import {
		computeMovieGraph,
		computeActorGraph,
		computeDirectorGraph,
		type GraphData
	} from '$lib/stats/graph';

	const dsctx = getContext<{ data: dataset | null }>('dataset');

	const TABS = ['Movies', 'Actors', 'Directors'] as const;
	type Tab = (typeof TABS)[number];
	let tab = $state<Tab>('Movies');

	const hasTmdb = $derived(
		dsctx.data ? dsctx.data.films.some((f) => f.tmdb) : false
	);

	const graphData = $derived.by((): GraphData | null => {
		if (!dsctx.data || !hasTmdb) return null;
		if (tab === 'Movies') return computeMovieGraph(dsctx.data);
		if (tab === 'Actors') return computeActorGraph(dsctx.data);
		return computeDirectorGraph(dsctx.data);
	});

	const nodeCount = $derived(graphData?.nodes.length ?? 0);
	const linkCount = $derived(graphData?.links.length ?? 0);

	const mostConnected = $derived.by(() => {
		if (!graphData || graphData.nodes.length === 0) return null;
		const connCount = new Map<string, number>();
		for (const n of graphData.nodes) connCount.set(n.id, 0);
		for (const l of graphData.links) {
			connCount.set(l.source, (connCount.get(l.source) ?? 0) + 1);
			connCount.set(l.target, (connCount.get(l.target) ?? 0) + 1);
		}
		let best: { id: string; label: string; count: number; href: string } | null = null;
		for (const n of graphData.nodes) {
			const c = connCount.get(n.id) ?? 0;
			if (!best || c > best.count) {
				best = { id: n.id, label: n.label, count: c, href: n.href };
			}
		}
		return best;
	});

	const accentForTab = $derived(
		tab === 'Movies' ? 'var(--accent-blue)' : tab === 'Actors' ? 'var(--accent)' : 'var(--accent-amber)'
	);
</script>

{#if !dsctx.data}
	<div class="py-[60px] font-mono text-[13px]" style="color: var(--text-dim);">
		No data — run the import pipeline first.
	</div>
{:else if !hasTmdb}
	<div class="flex flex-col gap-[20px]">
		<!-- tab bar -->
		<div class="flex gap-0 border-b border-[var(--border)]">
			{#each TABS as t (t)}
				<button
					class="text-[14px] px-[18px] py-[10px] -mb-px transition-colors"
					style={tab === t
						? 'font-weight: 600; color: var(--text); border-bottom: 2px solid var(--accent);'
						: 'font-weight: 400; color: var(--text-muted); border-bottom: 2px solid transparent;'}
					onclick={() => (tab = t)}>{t}</button
				>
			{/each}
		</div>

		<div
			class="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-[var(--border)] py-20 px-8"
			style="background: var(--bg-card);"
		>
			<svg
				width="40" height="40" viewBox="0 0 24 24" fill="none"
				stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
				style="color: var(--text-dim); margin-bottom: 16px;"
			>
				<circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" />
				<circle cx="12" cy="18" r="2.5" />
				<line x1="8.2" y1="7" x2="10.3" y2="16" opacity="0.5" />
				<line x1="15.8" y1="7" x2="13.7" y2="16" opacity="0.5" />
				<line x1="8.5" y1="6" x2="15.5" y2="6" opacity="0.5" />
			</svg>
			<div
				class="font-display font-semibold text-[18px] tracking-[-0.01em] mb-2"
				style="color: var(--text);"
			>
				TMDB enrichment needed
			</div>
			<div class="text-[13px] text-center max-w-[420px] leading-[1.6]" style="color: var(--text-muted);">
				The graph requires cast and director data from TMDB to build relationships between your watched films.
				Re-import your data with a valid TMDB API key to see the graph.
			</div>
			<a
				href="{base}/pipeline"
				class="mt-6 font-mono text-[11px] tracking-[0.04em] px-4 py-[9px] rounded-[8px] border border-[var(--border)] transition-colors"
				style="color: var(--text-muted); background: var(--bar-track);"
				onmouseenter={(e) => {
					(e.currentTarget as HTMLElement).style.color = 'var(--text)';
					(e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
				}}
				onmouseleave={(e) => {
					(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
					(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
				}}
			>
				→ run the import pipeline
			</a>
		</div>
	</div>
{:else}
	<div class="flex flex-col gap-[20px]">
		<!-- tab bar -->
		<div class="flex gap-0 border-b border-[var(--border)]">
			{#each TABS as t (t)}
				<button
					class="text-[14px] px-[18px] py-[10px] -mb-px transition-colors"
					style={tab === t
						? 'font-weight: 600; color: var(--text); border-bottom: 2px solid var(--accent);'
						: 'font-weight: 400; color: var(--text-muted); border-bottom: 2px solid transparent;'}
					onclick={() => (tab = t)}>{t}</button
				>
			{/each}
		</div>

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
					{tab === 'Movies' ? 'Films in graph' : tab + ' in graph'}
				</div>
				<div
					class="font-display font-bold text-[52px] leading-none tracking-[-0.03em]"
					style="color: var(--text);"
				>
					{nodeCount}
				</div>
				<div class="text-[12.5px] mt-1" style="color: var(--text-muted);">
					nodes
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
					Connections
				</div>
				<div
					class="font-display font-bold text-[52px] leading-none tracking-[-0.03em]"
					style="color: var(--text);"
				>
					{linkCount.toLocaleString('en-US')}
				</div>
				<div class="text-[12.5px] mt-1" style="color: var(--text-muted);">
					{tab === 'Movies'
						? 'shared cast/crew'
						: tab === 'Actors'
							? 'co-appearances'
							: 'shared actors'}
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
					Most connected
				</div>
				{#if mostConnected}
					<a
						href="{base}{mostConnected.href}"
						class="font-display font-bold text-[22px] leading-[1.1] tracking-[-0.02em] truncate transition-[color]"
						style="color: var(--text);"
						onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
						onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
					>
						{mostConnected.label}
					</a>
					<div class="text-[12.5px] mt-1" style="color: var(--text-muted);">
						{mostConnected.count} connection{mostConnected.count === 1 ? '' : 's'}
					</div>
				{:else}
					<div class="text-[12.5px]" style="color: var(--text-dim);">—</div>
				{/if}
			</section>
		</div>

		<!-- graph canvas -->
		<Card title="Relationship graph">
			{#snippet actions()}
				<div class="flex items-center gap-3">
					<span class="font-mono text-[10.5px]" style="color: var(--text-dim);">
						scroll to zoom · drag to pan · click node to open
					</span>
				</div>
			{/snippet}
			{#if graphData && nodeCount > 0}
				<div style="height: 560px;">
					{#key graphData}
						<ForceGraph data={graphData} accentColor={accentForTab} />
					{/key}
				</div>
			{:else}
				<div class="flex flex-col items-center justify-center py-16" style="color: var(--text-dim);">
					<div class="font-mono text-[12px]">Not enough connected data for this view.</div>
				</div>
			{/if}
		</Card>
	</div>
{/if}

