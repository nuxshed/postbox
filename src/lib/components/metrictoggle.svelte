<script lang="ts">
	import IconStar from '~icons/tabler/star';
	import IconHeart from '~icons/tabler/heart';

	type Opt = { id: string; label: string };
	type Props = {
		value: string;
		onchange: (v: string) => void;
		options?: Opt[];
	};
	let { value, onchange, options }: Props = $props();

	const defaults: Opt[] = [
		{ id: 'count', label: 'Watched' },
		{ id: 'rating', label: 'Rating' }
	];
	const opts = $derived(options ?? defaults);
</script>

<div class="inline-flex p-[3px] rounded-[7px] border border-[var(--border)] bg-[var(--bar-track)]">
	{#each opts as o (o.id)}
		{@const active = value === o.id}
		<button
			class="flex items-center justify-center font-mono text-[10.5px] tracking-[0.04em] uppercase px-[9px] py-1 rounded-[5px] transition-all"
			style={active
				? 'color: var(--text); background: color-mix(in oklab, var(--accent) 18%, transparent); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--accent) 35%, transparent);'
				: 'color: var(--text-dim);'}
			onmouseenter={(e) => {
				if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
			}}
			onmouseleave={(e) => {
				if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)';
			}}
			onclick={() => onchange(o.id)}
			title={o.label}
		>
			{#if o.id === 'count'}
				<svg
					width="13"
					height="13"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
					<circle cx="12" cy="12" r="3" />
				</svg>
			{:else if o.id === 'rating'}
				<IconStar width="13" height="13" stroke-width="2" />
			{:else if o.id === 'liked'}
				<IconHeart width="13" height="13" stroke-width="2" />
			{:else}
				{o.label}
			{/if}
		</button>
	{/each}
</div>
