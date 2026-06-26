<script lang="ts">
	import IconStarFilled from '~icons/tabler/star-filled';

	type Row = { label: string; value: number; sub?: string; unit?: string; href?: string };
	type Props = {
		rows: Row[];
		accent?: string;
		showrank?: boolean;
		format?: (v: number) => string;
		renderval?: (v: number) => string;
	};
	let {
		rows,
		accent = 'var(--accent-green)',
		showrank = false,
		format = (n) => n.toLocaleString('en-US'),
		renderval
	}: Props = $props();

	const max = $derived(Math.max(...rows.map((r) => r.value), 1));
	const cols = $derived(
		showrank ? 'auto minmax(80px, 150px) 1fr auto' : 'minmax(60px, 200px) 1fr auto'
	);
</script>

<div class="flex flex-col gap-[9px]">
	{#each rows as row, i (row.label + '|' + i)}
		{@const w = Math.max(2, (row.value / max) * 100)}
		{@const val = renderval ? renderval(row.value) : format(row.value)}
		<div class="grid items-center gap-3" style="grid-template-columns: {cols};">
			{#if showrank}
				<span class="font-mono text-[11px] w-[18px]" style="color: var(--text-dim);">
					{String(i + 1).padStart(2, '0')}
				</span>
			{/if}
			<div class="flex flex-col min-w-0">
				{#if row.href}
					<a
						href={row.href}
						class="text-[13.5px] font-medium truncate transition-[color]"
						style="color: var(--text);"
						title={row.label}
						onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
						onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
					>
						{row.label}
					</a>
				{:else}
					<span
						class="text-[13.5px] font-medium truncate"
						style="color: var(--text);"
						title={row.label}
					>
						{row.label}
					</span>
				{/if}
				{#if row.sub}
					<span class="text-[11px] truncate" style="color: var(--text-dim);">{row.sub}</span>
				{/if}
			</div>
			<span class="h-[7px] rounded-full overflow-hidden" style="background: var(--bar-track);">
				<span
					class="block h-full rounded-full transition-[width] duration-500"
					style="width: {w}%; background: {accent};"
				></span>
			</span>
			<span
				class="font-mono text-[12.5px] font-bold min-w-[42px] flex items-center justify-end gap-0.5"
				style="color: var(--text);"
			>
				{#if val.endsWith('★') || val.endsWith(' ★')}
					{val.replace('★', '').trim()}
					<IconStarFilled width="11" height="11" class="text-[var(--accent-amber)] shrink-0" />
				{:else}
					{val}{row.unit ?? ''}
				{/if}
			</span>
		</div>
	{/each}
</div>
