<script lang="ts">
	import type { rangesel } from '$lib/stats/range';

	let { value, onchange }: { value: rangesel; onchange: (v: rangesel) => void } = $props();

	const PRESETS = [
		{ kind: 'all', label: 'All time' },
		{ kind: '6mo', label: '6mo' },
		{ kind: '1mo', label: '1mo' },
		{ kind: 'custom', label: 'Custom' }
	] as const;

	let customfrom = $state('');
	let customto = $state(new Date().toISOString().slice(0, 10));

	function pick(kind: string) {
		if (kind === 'custom') {
			if (!customfrom) customfrom = new Date(Date.now() - 183 * 86400000).toISOString().slice(0, 10);
			onchange({ kind: 'custom', from: customfrom, to: customto });
		} else {
			onchange({ kind: kind as 'all' | '6mo' | '1mo' });
		}
	}

	function commitcustom() {
		if (customfrom && customto && customfrom <= customto) {
			onchange({ kind: 'custom', from: customfrom, to: customto });
		}
	}
</script>

<div class="flex items-center gap-[6px]">
	<div
		class="flex items-center gap-[3px] p-[3px] rounded-[8px] border border-[var(--border)]"
		style="background: var(--bar-track);"
	>
		{#each PRESETS as p (p.kind)}
			{@const active = value.kind === p.kind}
			<button
				class="font-mono text-[10.5px] px-[9px] py-[4px] rounded-[5px] transition-all whitespace-nowrap"
				style={active
					? 'color: var(--text); background: color-mix(in oklab, var(--accent) 16%, transparent); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--accent) 32%, transparent);'
					: 'color: var(--text-dim);'}
				onclick={() => pick(p.kind)}
			>
				{p.label}
			</button>
		{/each}
	</div>

	{#if value.kind === 'custom'}
		<div class="flex items-center gap-[5px]">
			<input
				type="date"
				bind:value={customfrom}
				onchange={commitcustom}
				class="font-mono text-[10.5px] px-[8px] py-[4px] rounded-[6px] border border-[var(--border)] outline-none"
				style="background: var(--bg-card); color: var(--text-muted);"
			/>
			<span class="font-mono text-[10px]" style="color: var(--text-dim);">–</span>
			<input
				type="date"
				bind:value={customto}
				onchange={commitcustom}
				class="font-mono text-[10.5px] px-[8px] py-[4px] rounded-[6px] border border-[var(--border)] outline-none"
				style="background: var(--bg-card); color: var(--text-muted);"
			/>
		</div>
	{/if}
</div>
