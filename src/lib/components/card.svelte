<script lang="ts">
	import type { Snippet } from 'svelte';
	type Props = {
		title?: string;
		cap?: string;
		children: Snippet;
		actions?: Snippet;
	};
	let { title, cap, children, actions }: Props = $props();
</script>

<section
	class="rounded-[14px] border border-[var(--border)] p-5 px-[22px] flex flex-col"
	style="background: var(--bg-card);"
>
	{#if title || actions}
		<header class="flex items-start justify-between mb-4">
			<div>
				{#if title}
					<h3
						class="font-display font-semibold text-[17px] tracking-[-0.01em]"
						style="color: var(--text);"
					>
						{title}
					</h3>
				{/if}
				{#if cap}
					<div class="text-[12.5px] mt-[2px]" style="color: var(--text-muted);">{cap}</div>
				{/if}
			</div>
			{#if actions}
				{@render actions()}
			{/if}
		</header>
	{/if}
	{@render children()}
</section>
