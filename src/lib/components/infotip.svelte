<script lang="ts">
	import IconInfoCircle from '~icons/tabler/info-circle';

	type Props = { text: string };
	let { text }: Props = $props();
	let show = $state(false);
</script>

<div class="relative inline-flex items-center">
	<button
		class="flex items-center justify-center transition-colors focus:outline-none"
		style="color: var(--text-dim);"
		onmouseenter={() => (show = true)}
		onmouseleave={() => (show = false)}
		onfocus={() => (show = true)}
		onblur={() => (show = false)}
		tabindex="-1"
		aria-label={text}
		type="button"
	>
		<IconInfoCircle width="15" height="15" stroke-width="1.5" />
	</button>

	{#if show}
		<div
			class="absolute right-0 top-[calc(100%+7px)] z-50 rounded-[8px] border border-[var(--border-2)] px-[11px] py-[8px] text-[12px] leading-[1.45] pointer-events-none"
			style="background: var(--bg-card); color: var(--text-muted); min-width: 180px; max-width: 240px; box-shadow: 0 6px 20px rgba(0,0,0,0.4); white-space: normal;"
		>
			<!-- arrow -->
			<div
				class="absolute right-[5px] top-[-5px] w-[9px] h-[9px] rotate-45 border-l border-t border-[var(--border-2)]"
				style="background: var(--bg-card);"
			></div>
			{text}
		</div>
	{/if}
</div>
