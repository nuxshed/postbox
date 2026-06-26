<script lang="ts">
	type Datapoint = { label: string; title?: string; [key: string]: any };
	type Props = {
		data: Datapoint[];
		accent?: string;
		height?: number;
		gap?: number;
		valuekey?: string;
		showvalues?: boolean;
		format?: (v: number) => string;
	};
	let {
		data,
		accent = 'var(--accent-blue)',
		height = 160,
		gap = 4,
		valuekey = 'count',
		showvalues = false,
		format = (n: number) => n.toLocaleString('en-US')
	}: Props = $props();

	const max = $derived(Math.max(...data.map((d) => d[valuekey] ?? 0), 1));
</script>

<div class="flex items-stretch" style="height: {height}px; gap: {gap}px;">
	{#each data as d}
		{@const val = d[valuekey] ?? 0}
		{@const h = Math.max(2, (val / max) * 100)}
		<div class="flex-1 flex flex-col items-center min-w-0">
			<div class="flex-1 w-full flex flex-col justify-end items-center">
				{#if showvalues && val > 0}
					<div
						class="font-mono text-[9px] mb-[3px] leading-none truncate w-full text-center"
						style="color: var(--text-dim);"
					>
						{format(val)}
					</div>
				{/if}
				<div
					class="w-full rounded-t-[4px] rounded-b-[1px] min-h-[2px] opacity-[0.92] hover:opacity-100 cursor-default"
					style="height: {h}%; background: {accent};"
					title={d.title ?? `${d.label}: ${val.toLocaleString()}`}
				></div>
			</div>
			<div
				class="font-mono text-[10px] mt-[6px] truncate h-[13px] leading-[13px] w-full text-center"
				style="color: var(--text-dim);"
			>
				{d.label}
			</div>
		</div>
	{/each}
</div>
