<script lang="ts">
	/* eslint-disable svelte/prefer-svelte-reactivity */
	import type { diaryentry } from '$lib/pipeline/types';
	import IconStarFilled from '~icons/tabler/star-filled';
	import IconStarHalfFilled from '~icons/tabler/star-half-filled';

	type Cell = { key: string; count: number; inyear: boolean };
	type Props = {
		daycounts: Record<string, number>;
		year: number;
		accent?: string;
		diary?: diaryentry[];
	};
	let { daycounts, year, accent = 'var(--accent-amber)', diary = [] }: Props = $props();

	const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
	const DAY_COL_W = 28; // px reserved for Mon/Wed/Fri labels
	const GAP = 2; // px gap between cells

	let containerw = $state(0);
	let containerEl = $state<HTMLDivElement>();

	const grid = $derived.by(() => {
		const jan1 = new Date(year + '-01-01T00:00:00');
		const dec31 = new Date(year + '-12-31T00:00:00');
		const dow = (jan1.getDay() + 6) % 7; // Monday = 0
		const start = new Date(jan1);
		start.setDate(start.getDate() - dow);

		const weeks: Cell[][] = [];
		const cur = new Date(start);
		let maxcount = 1;

		while (cur <= dec31) {
			const col: Cell[] = [];
			for (let d = 0; d < 7; d++) {
				const key = cur.toISOString().slice(0, 10);
				const inyear = cur.getFullYear() === year;
				const count = inyear ? (daycounts[key] ?? 0) : -1;
				if (count > maxcount) maxcount = count;
				col.push({ key, count, inyear });
				cur.setDate(cur.getDate() + 1);
			}
			weeks.push(col);
		}
		return { weeks, maxcount };
	});

	// dynamic cell size: fill available width
	const numweeks = $derived(grid.weeks.length);
	const cellsize = $derived(
		containerw > 0
			? Math.max(10, Math.floor((containerw - DAY_COL_W - GAP - numweeks * GAP) / numweeks))
			: 13
	);

	const monthlabels = $derived.by(() => {
		const labels: { wi: number; name: string }[] = [];
		let lastmonth = -1;
		grid.weeks.forEach((col, wi) => {
			const first = col.find((c) => c.inyear);
			if (first) {
				const m = new Date(first.key + 'T00:00:00').getMonth();
				if (m !== lastmonth) {
					labels.push({ wi, name: MONTHS[m] });
					lastmonth = m;
				}
			}
		});
		return labels;
	});

	function cellbg(lv: number): string {
		if (lv < 0) return 'transparent';
		if (lv === 0) return 'var(--bar-track)';
		const opacities = [35, 55, 75, 100];
		const p = opacities[lv - 1];
		return p === 100 ? accent : `color-mix(in oklab, ${accent} ${p}%, transparent)`;
	}

	function level(c: number): number {
		if (c < 0) return -1;
		if (c === 0) return 0;
		const r = c / grid.maxcount;
		if (r <= 0.25) return 1;
		if (r <= 0.5) return 2;
		if (r <= 0.75) return 3;
		return 4;
	}

	const diaryByDate = $derived.by(() => {
		const map: Record<string, diaryentry[]> = {};
		for (const entry of diary) {
			const d = (entry.watcheddate || entry.date)?.slice(0, 10);
			if (!d) continue;
			if (!map[d]) map[d] = [];
			map[d].push(entry);
		}
		return map;
	});

	let tooltip = $state<{
		date: string;
		count: number;
		movies: diaryentry[];
		x: number;
		y: number;
	} | null>(null);

	const tooltipAlign = $derived.by(() => {
		if (!tooltip || containerw === 0) return '-50%';
		if (tooltip.x < 110) return '-15%';
		if (containerw - tooltip.x < 110) return '-85%';
		return '-50%';
	});

	function onCellEnter(e: MouseEvent, cell: Cell) {
		if (!cell.inyear || cell.count < 0) return;
		const target = e.currentTarget as HTMLDivElement;
		const rect = target.getBoundingClientRect();
		if (containerEl) {
			const containerRect = containerEl.getBoundingClientRect();
			const x = rect.left - containerRect.left + rect.width / 2;
			const y = rect.top - containerRect.top;
			tooltip = {
				date: cell.key,
				count: cell.count,
				movies: diaryByDate[cell.key] ?? [],
				x,
				y
			};
		}
	}

	function onCellLeave() {
		tooltip = null;
	}

	function formatTooltipDate(d: string): string {
		const dt = new Date(d + 'T00:00:00');
		return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<div bind:clientWidth={containerw} bind:this={containerEl} class="w-full relative" style="position: relative;">
	<!-- month labels row -->
	<div
		class="flex mb-[4px]"
		style="padding-left: {DAY_COL_W + GAP}px; gap: {GAP}px;"
	>
		{#each grid.weeks as _week, wi (wi)}
			{@const lbl = monthlabels.find((m) => m.wi === wi)}
			<div
				class="font-mono text-[9px] shrink-0 overflow-visible whitespace-nowrap"
				style="width: {cellsize}px; color: var(--text-dim);"
			>
				{lbl?.name ?? ''}
			</div>
		{/each}
	</div>

	<!-- grid row -->
	<div class="flex" style="gap: {GAP}px;">
		<!-- day labels -->
		<div
			class="flex flex-col shrink-0"
			style="gap: {GAP}px; width: {DAY_COL_W}px;"
		>
			{#each ['', 'Mon', '', 'Wed', '', 'Fri', ''] as day, di (di)}
				<div
					class="font-mono text-[9px] text-right pr-[4px] shrink-0"
					style="height: {cellsize}px; line-height: {cellsize}px; color: var(--text-dim);"
				>
					{day}
				</div>
			{/each}
		</div>

		<!-- week columns -->
		<div class="flex flex-1" style="gap: {GAP}px;">
			{#each grid.weeks as col, wi (wi)}
				<div class="flex flex-col" style="gap: {GAP}px; flex: 1;">
					{#each col as cell (cell.key)}
						{@const lv = level(cell.count)}
						<div
							style="height: {cellsize}px; border-radius: {Math.max(2, Math.round(cellsize * 0.22))}px; background: {cellbg(lv)};{cell.inyear && cell.count >= 0 ? ' cursor: pointer;' : ''}"
							onmouseenter={(e) => onCellEnter(e, cell)}
							onmouseleave={onCellLeave}
							role="presentation"
						></div>
					{/each}
				</div>
			{/each}
		</div>
	</div>

	<!-- legend -->
	<div
		class="font-mono text-[10px] flex items-center gap-[6px] pt-[10px]"
		style="color: var(--text-dim);"
	>
		<span>Less</span>
		{#each [0, 1, 2, 3, 4] as lv (lv)}
			<div
				style="width: {Math.min(cellsize, 13)}px; height: {Math.min(cellsize, 13)}px; border-radius: 2px; background: {cellbg(lv)};"
			></div>
		{/each}
		<span>More</span>
	</div>

	<!-- Tooltip -->
	{#if tooltip}
		<div
			style="
				position: absolute;
				left: {tooltip.x}px;
				top: {tooltip.y}px;
				transform: translate({tooltipAlign}, calc(-100% - 10px));
				background: var(--bg-card);
				border: 1px solid var(--border-2);
				border-radius: 10px;
				padding: 10px 14px;
				pointer-events: none;
				z-index: 50;
				box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
				min-width: 200px;
				max-width: 280px;
				display: flex;
				flex-direction: column;
				gap: 6px;
			"
		>
			<div class="flex items-center justify-between gap-4 font-mono text-[10.5px]">
				<span style="color: var(--text-muted); font-weight: 500;">{formatTooltipDate(tooltip.date)}</span>
				<span style="color: {accent}; font-weight: 700;">
					{tooltip.count} {tooltip.count === 1 ? 'film' : 'films'}
				</span>
			</div>

			{#if tooltip.movies.length > 0}
				<div class="h-px my-0.5" style="background: var(--border);"></div>
				<div class="flex flex-col gap-2">
					{#each tooltip.movies.slice(0, 3) as m, i (m.name + '|' + m.year + '|' + i)}
						<div class="flex flex-col gap-0.5">
							<div class="flex items-baseline justify-between gap-2">
								<span class="font-medium text-[13px] leading-tight truncate" style="color: var(--text);">
									{m.name}
								</span>
								<span class="font-mono text-[11px] shrink-0" style="color: var(--text-dim);">
									{m.year}
								</span>
							</div>
							{#if m.rating !== null || m.rewatch}
								<div class="flex items-center gap-1.5 text-[11.5px] font-mono" style="color: var(--text-muted);">
									{#if m.rating !== null}
										<span class="flex items-center gap-0.5" style="color: var(--accent-amber);">
											{#each Array(Math.floor(m.rating)) as _, i (i)}
												<IconStarFilled width="11" height="11" />
											{/each}
											{#if m.rating % 1 !== 0}
												<IconStarHalfFilled width="11" height="11" />
											{/if}
										</span>
									{/if}
									{#if m.rating !== null && m.rewatch}
										<span style="color: var(--text-dim);">·</span>
									{/if}
									{#if m.rewatch}
										<span class="text-[9.5px] uppercase tracking-wider flex items-center gap-0.5" style="color: var(--accent-green);">
											<span style="font-size: 11px; line-height: 1;">↻</span> rewatch
										</span>
									{/if}
								</div>
							{/if}
						</div>
					{/each}

					{#if tooltip.movies.length > 3}
						<div class="text-[10px] font-mono text-center pt-0.5" style="color: var(--text-dim);">
							+ {tooltip.movies.length - 3} more
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
