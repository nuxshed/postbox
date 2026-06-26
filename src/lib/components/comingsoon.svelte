<script lang="ts">
	type Props = { slug: string; idx: number; note: string };
	let { slug, idx, note }: Props = $props();
</script>

<div class="flex flex-col items-start py-[60px] max-w-[560px]">
	<div class="font-mono text-[13px] tracking-[0.1em]" style="color: var(--accent);">
		{String(idx).padStart(2, '0')}
	</div>
	<h2
		class="font-display font-bold text-[52px] tracking-[-0.03em] mt-[14px] capitalize"
		style="color: var(--text);"
	>
		{slug}
	</h2>
	<p class="text-[16px] mt-[14px] leading-relaxed" style="color: var(--text-muted);">{note}</p>
	<div
		class="font-mono text-[12px] mt-7 px-4 py-3 rounded-[10px] border border-dashed border-[var(--border-2)]"
		style="color: var(--text-dim);"
	>
		Next in the build — overview is live, this page is coming next.
	</div>
</div>
