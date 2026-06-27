<script lang="ts">
	import { goto } from '$app/navigation';
	import IconStarFilled from '~icons/tabler/star-filled';

	type Datapoint = { label: string; title?: string; [key: string]: any };
	type AxisLabel = { label: string; index: number };
	type Props = {
		data: Datapoint[];
		accent?: string;
		height?: number;
		gap?: number;
		valuekey?: string;
		showvalues?: boolean;
		format?: (v: number) => string;
		gethref?: (d: Datapoint) => string | undefined;
		axislabels?: AxisLabel[];
	};
	let {
		data,
		accent = 'var(--accent-blue)',
		height = 160,
		gap = 4,
		valuekey = 'count',
		showvalues = false,
		format = (n: number) => n.toLocaleString('en-US'),
		gethref,
		axislabels
	}: Props = $props();

	const max = $derived(Math.max(...data.map((d) => d[valuekey] ?? 0), 1));

	let hovered = $state<number | null>(null);
</script>

<div>
	<div class="flex items-stretch" style="height: {height}px; gap: {gap}px;">
		{#each data as d, i}
			{@const val = d[valuekey] ?? 0}
			{@const h = Math.max(2, (val / max) * 100)}
			{@const href = gethref?.(d)}
			<div
				class="flex-1 flex flex-col items-center min-w-0 {href ? 'cursor-pointer' : ''}"
				onclick={href ? () => goto(href!) : undefined}
				role={href ? 'button' : undefined}
				onmouseenter={() => (hovered = i)}
				onmouseleave={() => (hovered = null)}
			>
				<div class="flex-1 w-full flex flex-col justify-end items-center relative">
					{#if showvalues && val > 0}
						<div
							class="absolute w-full text-center font-mono text-[9px] leading-none pointer-events-none"
							style="bottom: calc({h}% + 4px); color: var(--text-dim);"
						>
							{format(val)}
						</div>
					{/if}
					{#if hovered === i && val > 0}
						<div
							class="absolute left-1/2 z-20 pointer-events-none whitespace-nowrap"
							style="bottom: calc({h}% + 10px); transform: translateX(-50%);"
						>
							<div
								class="rounded-[7px] px-[9px] py-[5px] font-mono text-[11px] flex items-center gap-0"
								style="background: var(--bg-card); border: 1px solid var(--border-2); color: var(--text-muted);"
							>
								{#if d.title}
									{@render startext(d.title)}
								{:else}
									{d.label}<span class="font-bold ml-[6px]" style="color: var(--text);">{@render startext(format(val))}</span>
								{/if}
							</div>
						</div>
					{/if}
					<div
						class="w-full rounded-t-[4px] rounded-b-[1px] min-h-[2px]"
						style="height: {h}%; background: {accent}; opacity: {hovered === null || hovered === i ? (hovered === i ? 1 : 0.92) : 0.4}; transition: height 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.15s ease;"
					></div>
				</div>
				{#if !axislabels}
					<div
						class="font-mono text-[10px] mt-[6px] truncate h-[13px] leading-[13px] w-full text-center"
						style="color: {hovered === i ? 'var(--text)' : 'var(--text-dim)'}; transition: color 0.15s ease;"
					>
						{d.label}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	{#snippet startext(text: string)}
		{#each text.split('★') as part, j}
			{part}{#if j < text.split('★').length - 1}<IconStarFilled width="10" height="10" style="color: var(--text); display: inline; vertical-align: middle; margin: 0 1px;" />{/if}
		{/each}
	{/snippet}

	{#if axislabels?.length}
		<div class="relative h-[18px] mt-[4px]">
			{#each axislabels as al}
				{@const pos = ((al.index + 0.5) / data.length) * 100}
				<div
					class="absolute top-0 font-mono text-[10px] whitespace-nowrap"
					style="left: {pos}%; transform: translateX(-50%); color: var(--text-dim);"
				>
					{al.label}
				</div>
			{/each}
		</div>
	{/if}
</div>
