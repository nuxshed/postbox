<script lang="ts">
	import IconChevronDown from '~icons/tabler/chevron-down';
	import IconChevronUp from '~icons/tabler/chevron-up';

	type Props = {
		total: number;
		limit: number;
	};

	let { total, limit = $bindable(10) }: Props = $props();

	const limits = $derived.by(() => {
		const steps = [10, 20, 100];
		const list: number[] = [];
		for (const s of steps) {
			if (total > s) {
				list.push(s);
			} else {
				break;
			}
		}
		if (list.length === 0 || list[list.length - 1] < total) {
			list.push(total);
		}
		return list;
	});

	let stage = $derived(Math.max(0, limits.indexOf(limit)));

	const moreLabel = $derived.by(() => {
		if (stage >= limits.length - 1) return '';
		const nextLimit = limits[stage + 1];
		if (nextLimit === total) {
			return 'show all';
		}
		const diff = nextLimit - limits[stage];
		return `show ${diff} more`;
	});

	function showMore() {
		if (stage < limits.length - 1) {
			limit = limits[stage + 1];
		}
	}

	function showLess() {
		if (stage > 0) {
			limit = limits[stage - 1];
		}
	}
</script>

{#if limits.length > 1}
	<div class="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-center gap-5">
		{#if stage > 0}
			<button class="expand-btn group" onclick={showLess}>
				<IconChevronUp class="icon-size text-[var(--text-dim)] transition-colors group-hover:text-[var(--text-muted)]" />
				<span>show less</span>
			</button>
		{/if}
		{#if stage < limits.length - 1}
			<button class="expand-btn group" onclick={showMore}>
				<span>{moreLabel}</span>
				<IconChevronDown class="icon-size text-[var(--text-dim)] transition-colors group-hover:text-[var(--text-muted)]" />
			</button>
		{/if}
	</div>
{/if}

<style>
	.expand-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: inherit;
		font-size: 12px;
		font-weight: 500;
		color: var(--text-muted);
		transition: color 0.15s ease;
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px 8px;
	}
	.expand-btn:hover {
		color: var(--text);
	}
	:global(.expand-btn .icon-size) {
		width: 14px;
		height: 14px;
	}
</style>
