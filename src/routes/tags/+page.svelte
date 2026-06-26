<script lang="ts">
	import { getContext } from 'svelte';
	import type { dataset } from '$lib/pipeline/types';
	import { computetags } from '$lib/stats/tags';
	import { base } from '$app/paths';
	import BarList from '$lib/components/barlist.svelte';
	import Card from '$lib/components/card.svelte';
	import IconStarFilled from '~icons/tabler/star-filled';

	const dsctx = getContext<{ data: dataset | null }>('dataset');
	const stats = $derived(dsctx.data ? computetags(dsctx.data) : null);

	let expanded = $state(false);

	const countrows = $derived(
		stats
			? (expanded ? stats.bycount : stats.bycount.slice(0, 10)).map((t) => ({
					label: '#' + t.name,
					value: t.count,
					href: `${base}/films?tag=${encodeURIComponent(t.name)}`
				}))
			: []
	);
	const ratingrows = $derived(
		stats
			? (expanded ? stats.byrating : stats.byrating.slice(0, 10)).map((t) => ({
					label: '#' + t.name,
					value: t.avg,
					href: `${base}/films?tag=${encodeURIComponent(t.name)}`
				}))
			: []
	);
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
					{stats.totallogs.toLocaleString('en-US')} total tagged entries
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
					{stats.toptag.count.toLocaleString('en-US')} entries
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

		<!-- two lists -->
		<div class="grid grid-cols-2 gap-[18px]">
			<Card title="By watch count">
				<BarList rows={countrows} accent="var(--accent)" showrank={true} />
				{#if stats && stats.bycount.length > 10}
					<div class="mt-3 pt-3 flex justify-center">
						<button
							class="font-mono text-[11px] tracking-[0.06em] uppercase transition-colors"
							style="color: var(--text-dim);"
							onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
							onmouseleave={(e) =>
								((e.currentTarget as HTMLElement).style.color = 'var(--text-dim)')}
							onclick={() => (expanded = !expanded)}
							>{expanded ? '↑ show less' : '↓ show all ' + stats.bycount.length}</button
						>
					</div>
				{/if}
			</Card>
			<Card title="By avg rating">
				<BarList
					rows={ratingrows}
					accent="var(--accent-amber)"
					showrank={true}
					format={(v) => v.toFixed(1) + '★'}
				/>
				{#if stats && stats.byrating.length > 10}
					<div class="mt-3 pt-3 flex justify-center">
						<button
							class="font-mono text-[11px] tracking-[0.06em] uppercase transition-colors"
							style="color: var(--text-dim);"
							onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
							onmouseleave={(e) =>
								((e.currentTarget as HTMLElement).style.color = 'var(--text-dim)')}
							onclick={() => (expanded = !expanded)}
							>{expanded ? '↑ show less' : '↓ show all ' + stats.byrating.length}</button
						>
					</div>
				{/if}
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
						<span class="font-mono text-[10.5px] flex items-center gap-0.5" style="color: var(--text-muted);"
							>{t.avg.toFixed(1)}<IconStarFilled width="10" height="10" class="text-[var(--accent-amber)] shrink-0" /></span
						>
					</a>
				{/each}
			</div>
		</Card>
	</div>
{/if}
