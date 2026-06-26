<script lang="ts">
	import { getContext } from 'svelte';
	import type { dataset } from '$lib/pipeline/types';
	import { computegenres } from '$lib/stats/genres';
	import BarList from '$lib/components/barlist.svelte';
	import Card from '$lib/components/card.svelte';
	import Infotip from '$lib/components/infotip.svelte';

	const dsctx = getContext<{ data: dataset | null }>('dataset');
	const stats = $derived(dsctx.data ? computegenres(dsctx.data) : null);

	const watchwedrows = $derived(
		stats ? stats.topwatched.map((g) => ({ label: g.name, value: g.count })) : []
	);
	const ratedrows = $derived(
		stats ? stats.toprated.map((g) => ({ label: g.name, value: g.avg })) : []
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
				<div
					class="font-display font-bold text-[34px] leading-[1.05] tracking-[-0.025em] mb-1"
					style="color: var(--accent-blue);"
				>
					{stats.topgenre.name}
				</div>
				<div class="text-[12.5px]" style="color: var(--text-muted);">
					{stats.topgenre.count.toLocaleString('en-US')} logged entries
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
					Highest rated
				</div>
				<div
					class="font-display font-bold text-[34px] leading-[1.05] tracking-[-0.025em] mb-1"
					style="color: var(--accent-amber);"
				>
					{stats.topratedgenre.name}
				</div>
				<div class="text-[12.5px]" style="color: var(--text-muted);">
					{stats.topratedgenre.avg.toFixed(2)} avg rating
				</div>
			</section>
		</div>

		<!-- most watched + highest rated -->
		<div class="grid grid-cols-2 gap-[18px]">
			<Card title="Most watched">
				<BarList rows={watchwedrows} accent="var(--accent-blue)" showrank={true} />
			</Card>
			<Card title="Highest rated">
				{#snippet actions()}
					<Infotip text="Only genres with at least 20 logged entries are included." />
				{/snippet}
				<BarList
					rows={ratedrows}
					accent="var(--accent-amber)"
					showrank={true}
					format={(v) => v.toFixed(2)}
				/>
			</Card>
		</div>

		<!-- niche meter + all genres -->
		<div class="grid gap-[18px]" style="grid-template-columns: 1fr 2fr; align-items: start;">
			<Card title="Mainstream vs niche">
				<div class="flex flex-col flex-1 justify-center gap-0">
					<div class="flex justify-between mb-[10px]">
						<span
							class="font-mono text-[10.5px] tracking-[0.08em] uppercase"
							style="color: var(--text-dim);">Mainstream</span
						>
						<span
							class="font-mono text-[10.5px] tracking-[0.08em] uppercase"
							style="color: var(--text-dim);">Niche</span
						>
					</div>
					<div class="relative h-[6px] rounded-full" style="background: var(--bar-track);">
						<div
							class="absolute inset-0 rounded-full"
							style="background: linear-gradient(to right, transparent, color-mix(in oklab, var(--accent) 35%, transparent));"
						></div>
						<div
							class="absolute top-1/2 w-[14px] h-[14px] rounded-full border-[2.5px]"
							style="left: {stats.nichescore}%; transform: translate(-50%, -50%); background: var(--accent); box-shadow: 0 0 10px color-mix(in oklab, var(--accent) 60%, transparent); border-color: var(--bg-card);"
						></div>
					</div>
					<div class="flex items-baseline gap-[10px] mt-5">
						<span
							class="font-num font-bold text-[52px] leading-[0.9] tracking-[-0.03em]"
							style="color: var(--accent);">{stats.nichescore}</span
						>
						<div>
							<div class="text-[13px]" style="color: var(--text-muted);">niche score</div>
							<div class="font-mono text-[10.5px] mt-[3px]" style="color: var(--text-dim);">
								out of 100
							</div>
						</div>
					</div>
					<div
						class="mt-4 text-[13px] leading-[1.5] border-t border-[var(--border)] pt-[14px]"
						style="color: var(--text-muted);"
					>
						{stats.nichedesc}
					</div>
				</div>
			</Card>

			<Card title="All genres">
				<div class="grid grid-cols-2 gap-[6px]">
					{#each stats.genrecount as g (g.name)}
						{@const w = Math.max(3, (g.count / (stats.genrecount[0]?.count || 1)) * 100)}
						<div
							class="relative overflow-hidden rounded-[6px] flex items-center justify-between gap-2 px-[10px] py-[8px]"
							style="background: var(--bg-1);"
						>
							<div
								class="absolute inset-0 rounded-[6px]"
								style="width: {w}%; background: color-mix(in oklab, var(--accent-blue) 12%, transparent);"
							></div>
							<span class="relative text-[13px] font-medium truncate" style="color: var(--text);"
								>{g.name}</span
							>
							<div class="relative flex items-center gap-[10px] shrink-0">
								<span class="font-mono text-[12px] font-bold" style="color: var(--text);"
									>{g.count.toLocaleString('en-US')}</span
								>
								<span class="font-mono text-[10.5px]" style="color: var(--text-muted);"
									>{g.avg.toFixed(1)}</span
								>
							</div>
						</div>
					{/each}
				</div>
			</Card>
		</div>
	</div>
{/if}
