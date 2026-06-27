<script lang="ts">
	import { getContext } from 'svelte';
	import { base } from '$app/paths';
	import { computeoverview, fmtnum, type overstats } from '$lib/stats/overview';
	import type { dataset } from '$lib/pipeline/types';
	import MetricToggle from '$lib/components/metrictoggle.svelte';
	import BarList from '$lib/components/barlist.svelte';
	import ColumnChart from '$lib/components/columnchart.svelte';

	const dsctx = getContext<{ data: dataset | null }>('dataset');
	const dirctx = getContext<{ dir: string; setdir(v: string): void }>('ovdir');
	const rangectx = getContext<{ kind: string }>('range');

	const stats = $derived(dsctx.data ? computeoverview(dsctx.data) : null);

	let dirmetric = $state('count');
	let genremetric = $state('count');
	let runtimemetric = $state('count');
	let ratingmetric = $state('count');

	const toggleopts = $derived.by(() => {
		if (!stats) return [{ id: 'count', label: 'Watched' }];
		const opts = [{ id: 'count', label: 'Watched' }];
		if (stats.haslikes) {
			opts.push({ id: 'liked', label: 'Liked' });
		}
		if (stats.hasratings && stats.directors.some((d) => d.avg > 0)) {
			opts.push({ id: 'rating', label: 'Rating' });
		}
		return opts;
	});

	const ratingtoggleopts = $derived.by(() => {
		const opts = [{ id: 'count', label: 'Watched' }];
		if (stats?.haslikes) opts.push({ id: 'liked', label: 'Liked' });
		return opts;
	});

	$effect(() => {
		if (toggleopts.length > 0) {
			if (!toggleopts.some((o) => o.id === dirmetric)) dirmetric = toggleopts[0].id;
			if (!toggleopts.some((o) => o.id === genremetric)) genremetric = toggleopts[0].id;
			if (!toggleopts.some((o) => o.id === runtimemetric)) runtimemetric = toggleopts[0].id;
		}
		if (!ratingtoggleopts.some((o) => o.id === ratingmetric)) ratingmetric = 'count';
	});

	const dirminthreshold = $derived(
		(rangectx.kind === '6mo' || rangectx.kind === '1mo') ? 1 : 3
	);

	const dirrows = $derived.by(() => {
		if (!stats) return [];
		if (dirmetric === 'rating') {
			return stats.directors
				.filter((d) => d.ratedfilms >= dirminthreshold)
				.sort((a, b) => b.avg - a.avg)
				.slice(0, 8)
				.map((d) => ({ label: d.name, value: d.avg, href: `${base}/films?director=${encodeURIComponent(d.name)}` }));
		}
		if (dirmetric === 'liked') {
			return stats.directors
				.slice()
				.sort((a, b) => b.liked - a.liked)
				.slice(0, 8)
				.map((d) => ({ label: d.name, value: d.liked, href: `${base}/films?director=${encodeURIComponent(d.name)}` }));
		}
		return stats.directors.slice(0, 8).map((d) => ({ label: d.name, value: d.watched, href: `${base}/films?director=${encodeURIComponent(d.name)}` }));
	});

	const genrerows = $derived.by(() => {
		if (!stats) return [];
		if (genremetric === 'rating') {
			return stats.genres
				.filter((g) => g.avg > 0)
				.sort((a, b) => b.avg - a.avg)
				.slice(0, 8)
				.map((g) => ({ label: g.name, value: g.avg, href: `${base}/films?genre=${encodeURIComponent(g.name)}` }));
		}
		if (genremetric === 'liked') {
			return stats.genres
				.slice()
				.sort((a, b) => b.liked - a.liked)
				.slice(0, 8)
				.map((g) => ({ label: g.name, value: g.liked, href: `${base}/films?genre=${encodeURIComponent(g.name)}` }));
		}
		return stats.genres.slice(0, 8).map((g) => ({ label: g.name, value: g.count, href: `${base}/films?genre=${encodeURIComponent(g.name)}` }));
	});

	function ratingval(v: number) {
		return v.toFixed(1) + ' ★';
	}

	const ratinghref = (d: { label: string }) => `${base}/films?rating=${d.label}`;
	const runtimehref = (d: { label: string }) => `${base}/films?runtimebucket=${encodeURIComponent(d.label)}`;

	const runtimechartkey = $derived(runtimemetric === 'rating' ? 'avg' : runtimemetric === 'liked' ? 'liked' : 'count');
	const runtimefmt = $derived(runtimemetric === 'rating' ? (v: number) => v.toFixed(2) + ' ★' : undefined);

	const ratingstatnum = $derived(
		stats
			? ratingmetric === 'liked'
				? stats.avgratliked.toFixed(2)
				: stats.avgrating.toFixed(2)
			: '—'
	);
	const ratingstatline = $derived(
		stats
			? ratingmetric === 'liked'
				? `average rating across ${fmtnum(stats.totalliked)} liked films`
				: `average rating across ${fmtnum(stats.totalfilms)} films`
			: ''
	);

	const runtimestatnum = $derived(
		stats
			? runtimemetric === 'liked'
				? stats.avgruntimeliked + ' min'
				: runtimemetric === 'rating'
					? stats.avgruntimefivestar + ' min'
					: stats.avgruntime + ' min'
			: '—'
	);
	const runtimestatline = $derived(
		stats
			? runtimemetric === 'liked'
				? `avg runtime across ${fmtnum(stats.totalliked)} liked films`
				: runtimemetric === 'rating'
					? `avg runtime across ${fmtnum(stats.fivestartotal)} 5-star films`
					: `typical runtime across all films`
			: ''
	);
</script>

{#if !stats}
	<!-- empty state -->
	<div class="flex flex-col items-start py-[60px] max-w-[560px]">
		<div class="font-mono text-[13px] tracking-[0.1em]" style="color: var(--accent);">01</div>
		<h2
			class="font-display font-bold text-[52px] tracking-[-0.03em] mt-[14px]"
			style="color: var(--text);"
		>
			Overview
		</h2>
		<p class="text-[16px] mt-[14px] leading-relaxed" style="color: var(--text-muted);">
			Import your Letterboxd data to see your film stats.
		</p>
		<a
			href="{base}/pipeline"
			class="font-mono text-[12px] mt-7 px-4 py-3 rounded-[10px] border border-dashed border-[var(--border-2)]"
			style="color: var(--text-dim);"
		>
			→ run the import pipeline
		</a>
	</div>
{:else if dirctx.dir === 'marquee'}
	<!-- MARQUEE LAYOUT -->
	<div class="flex flex-col gap-6">
		<!-- hero section -->
		<div
			class="grid gap-[40px] items-stretch border-b border-[var(--border)] pb-7"
			style="grid-template-columns: 1.5fr 1fr;"
		>
			<div class="flex flex-col justify-center">
				<div
					class="font-mono text-[11px] tracking-[0.16em] uppercase mb-[6px]"
					style="color: var(--text-dim);"
				>
					films logged
				</div>
				<div
					class="font-num font-extrabold text-[168px] leading-[0.82] tracking-[-0.05em]"
					style="color: var(--text);"
				>
					{fmtnum(stats.totalfilms)}
				</div>
				<div
					class="font-display font-semibold text-[30px] tracking-[-0.02em] mt-1"
					style="color: var(--text-muted);"
				>
					films watched
				</div>
				<div class="flex gap-[26px] mt-6 text-[13.5px] font-mono" style="color: var(--text-muted);">
					<span><b style="color: var(--text);">{fmtnum(stats.totalentries)}</b> entries</span>
					<span><b style="color: var(--text);">{stats.daystotal}</b> days watched</span>
				</div>
			</div>
			<div
				class="flex flex-col justify-center gap-[22px] pl-[40px] border-l border-[var(--border)]"
			>
				<div>
					<div
						class="font-num font-bold text-[52px] leading-[0.9] tracking-[-0.03em]"
						style="color: var(--accent-green);"
					>
						{stats.avgrating.toFixed(2)}
					</div>
					<div class="text-[13px] mt-[5px]" style="color: var(--text-muted);">Average rating</div>
				</div>
				<div>
					<div
						class="font-num font-bold text-[52px] leading-[0.9] tracking-[-0.03em]"
						style="color: var(--accent-amber);"
					>
						{fmtnum(stats.hourstotal)}<small class="text-[26px] opacity-70">h</small>
					</div>
					<div class="text-[13px] mt-[5px]" style="color: var(--text-muted);">
						Hours watched
					</div>
				</div>
				<div>
					<div
						class="font-num font-bold text-[52px] leading-[0.9] tracking-[-0.03em]"
						style="color: var(--accent-blue);"
					>
						{stats.filmsthisyear}
					</div>
					<div class="text-[13px] mt-[5px]" style="color: var(--text-muted);">
						Films in {stats.thisyear}
					</div>
				</div>
			</div>
		</div>

		<!-- charts row -->
		<div class="grid grid-cols-2 gap-[18px]">
			<div
				class="flex flex-col rounded-[14px] border border-[var(--border)] p-5 px-[22px]"
				style="background: var(--bg-card);"
			>
				<div class="flex items-center justify-between mb-4">
					<h3
						class="font-display font-semibold text-[17px] tracking-[-0.01em]"
						style="color: var(--text);"
					>
						Rating distribution
					</h3>
					<MetricToggle value={ratingmetric} onchange={(v) => (ratingmetric = v)} options={ratingtoggleopts} />
				</div>
				<div class="flex-1 flex flex-col justify-end">
					<ColumnChart
						data={stats.ratingdist.map((r) => ({
							label: r.star % 1 === 0 ? String(r.star) : r.star + '',
							count: r.count,
							liked: r.liked
						}))}
						accent="var(--accent-blue)"
						height={120}
						valuekey={ratingmetric}
					/>
					<div
						class="flex items-baseline gap-[10px] mt-4 pt-[14px] border-t border-[var(--border)]"
					>
						<span
							class="font-num font-bold text-[22px] tracking-[-0.02em]"
							style="color: var(--accent-blue);">{ratingstatnum}</span
						>
						<span class="text-[12.5px]" style="color: var(--text-muted);">{ratingstatline}</span>
					</div>
				</div>
			</div>
			<div
				class="flex flex-col rounded-[14px] border border-[var(--border)] p-5 px-[22px]"
				style="background: var(--bg-card);"
			>
				<div class="flex items-center justify-between mb-4">
					<h3
						class="font-display font-semibold text-[17px] tracking-[-0.01em]"
						style="color: var(--text);"
					>
						Runtime preferences
					</h3>
					<MetricToggle value={runtimemetric} onchange={(v) => (runtimemetric = v)} options={toggleopts} />
				</div>
				<div class="flex-1 flex flex-col justify-end">
					<ColumnChart data={stats.runtimebuckets} accent="var(--accent-amber)" height={120} gethref={runtimehref} valuekey={runtimechartkey} format={runtimefmt} />
					<div
						class="flex items-baseline gap-[10px] mt-4 pt-[14px] border-t border-[var(--border)]"
					>
						<span
							class="font-num font-bold text-[22px] tracking-[-0.02em]"
							style="color: var(--accent-amber);">{runtimestatnum}</span
						>
						<span class="text-[12.5px]" style="color: var(--text-muted);">{runtimestatline}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- lower row -->
		<div class="grid grid-cols-2 gap-[18px]">
			<div
				class="rounded-[14px] border border-[var(--border)] p-5 px-[22px]"
				style="background: var(--bg-card);"
			>
				<div class="flex items-center justify-between mb-[14px]">
					<div
						class="font-mono text-[10.5px] tracking-[0.16em] uppercase"
						style="color: var(--accent-green);"
					>
						Directors
					</div>
					<MetricToggle value={dirmetric} onchange={(v) => (dirmetric = v)} options={toggleopts} />
				</div>
				<BarList
					rows={dirrows}
					accent="var(--accent-green)"
					showrank={true}
					renderval={dirmetric === 'rating' ? ratingval : undefined}
				/>
			</div>
			<div
				class="rounded-[14px] border border-[var(--border)] p-5 px-[22px]"
				style="background: var(--bg-card);"
			>
				<div class="flex items-center justify-between mb-[14px]">
					<div
						class="font-mono text-[10.5px] tracking-[0.16em] uppercase"
						style="color: var(--accent-blue);"
					>
						Genres
					</div>
					<MetricToggle value={genremetric} onchange={(v) => (genremetric = v)} options={toggleopts} />
				</div>
				<BarList
					rows={genrerows}
					accent="var(--accent-blue)"
					showrank={true}
					renderval={genremetric === 'rating' ? ratingval : undefined}
				/>
			</div>
		</div>

		<!-- insights -->
		<div
			class="rounded-[14px] border border-[var(--border)] p-5 px-[22px]"
			style="background: var(--bg-card);"
		>
			<h3
				class="font-display font-semibold text-[17px] tracking-[-0.01em] mb-4"
				style="color: var(--text);"
			>
				Insights
			</h3>
			<div
				class="grid gap-px border border-[var(--border)] rounded-[12px] overflow-hidden"
				style="background: var(--border); grid-template-columns: repeat(4, 1fr);"
			>
				{#each stats.insights as it (it.k)}
					<div class="px-[18px] pt-[18px] pb-5" style="background: var(--bg-card);">
						<div
							class="font-mono text-[10.5px] tracking-[0.06em] uppercase"
							style="color: var(--text-dim);"
						>
							{it.k}
						</div>
						{#if it.href}
							<a
								href="{base}{it.href}"
								class="font-num font-bold text-[27px] tracking-[-0.02em] mt-[10px] leading-none transition-[color] block"
								style="color: var(--text);"
								onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
								onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
							>{it.v}</a>
						{:else}
							<div
								class="font-num font-bold text-[27px] tracking-[-0.02em] mt-[10px] leading-none"
								style="color: var(--text);"
							>
								{it.v}
							</div>
						{/if}
						<div class="text-[12px] mt-[7px] leading-[1.35]" style="color: var(--text-muted);">
							{#if it.subhref}
								<a
									href="{base}{it.subhref}"
									class="transition-[color] inline-block"
									style="color: var(--text-muted);"
									onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
									onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
								>
									{it.sub}
								</a>
							{:else}
								{it.sub}
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{:else if dirctx.dir === 'panel'}
	<!-- PANEL LAYOUT -->
	{@const heroes = [
		{ v: fmtnum(stats.totalfilms), l: 'Films watched', color: 'var(--text)' },
		{ v: stats.avgrating.toFixed(2), l: 'Average rating', color: 'var(--accent-green)' },
		{ v: fmtnum(stats.hourstotal) + 'h', l: 'Hours watched', color: 'var(--accent-amber)' },
		{ v: String(stats.filmsthisyear), l: 'Films in ' + stats.thisyear, color: 'var(--accent-blue)' }
	]}
	<div class="grid gap-4" style="grid-template-columns: repeat(4, 1fr);">
		{#each heroes as h (h.l)}
			<div
				class="flex flex-col justify-center rounded-[14px] border border-[var(--border)] p-5 px-[22px]"
				style="background: linear-gradient(180deg, var(--bg-1), var(--bg-card));"
			>
				<div
					class="font-num font-bold text-[48px] leading-[0.9] tracking-[-0.03em]"
					style="color: {h.color};"
				>
					{h.v}
				</div>
				<div class="text-[13px] mt-2" style="color: var(--text-muted);">{h.l}</div>
			</div>
		{/each}

		<div
			class="col-span-2 rounded-[14px] border border-[var(--border)] p-5 px-[22px] flex flex-col"
			style="background: var(--bg-card);"
		>
			<div class="flex items-center justify-between mb-4">
				<h3
					class="font-display font-semibold text-[17px] tracking-[-0.01em]"
					style="color: var(--text);"
				>
					Rating distribution
				</h3>
				<MetricToggle value={ratingmetric} onchange={(v) => (ratingmetric = v)} options={ratingtoggleopts} />
			</div>
			<div class="flex-1 flex flex-col justify-end">
				<ColumnChart
					data={stats.ratingdist.map((r) => ({
						label: r.star % 1 === 0 ? String(r.star) : r.star + '',
						count: r.count,
						liked: r.liked
					}))}
					accent="var(--accent-blue)"
					height={120}
					gethref={ratinghref}
					valuekey={ratingmetric}
				/>
				<div class="flex items-baseline gap-[10px] mt-4 pt-[14px] border-t border-[var(--border)]">
					<span
						class="font-num font-bold text-[22px] tracking-[-0.02em]"
						style="color: var(--accent-blue);">{ratingstatnum}</span
					>
					<span class="text-[12.5px]" style="color: var(--text-muted);">{ratingstatline}</span>
				</div>
			</div>
		</div>

		<div
			class="col-span-2 rounded-[14px] border border-[var(--border)] p-5 px-[22px] flex flex-col"
			style="background: var(--bg-card);"
		>
			<div class="flex items-center justify-between mb-4">
				<h3
					class="font-display font-semibold text-[17px] tracking-[-0.01em]"
					style="color: var(--text);"
				>
					Runtime preferences
				</h3>
				<MetricToggle value={runtimemetric} onchange={(v) => (runtimemetric = v)} options={toggleopts} />
			</div>
			<div class="flex-1 flex flex-col justify-end">
				<ColumnChart data={stats.runtimebuckets} accent="var(--accent-amber)" height={120} gethref={runtimehref} valuekey={runtimechartkey} format={runtimefmt} />
				<div class="flex items-baseline gap-[10px] mt-4 pt-[14px] border-t border-[var(--border)]">
					<span
						class="font-num font-bold text-[22px] tracking-[-0.02em]"
						style="color: var(--accent-amber);">{runtimestatnum}</span
					>
					<span class="text-[12.5px]" style="color: var(--text-muted);">{runtimestatline}</span>
				</div>
			</div>
		</div>

		<div
			class="col-span-2 min-h-[280px] rounded-[14px] border border-[var(--border)] p-5 px-[22px]"
			style="background: var(--bg-card);"
		>
			<div class="flex items-center justify-between mb-[14px]">
				<div
					class="font-mono text-[10.5px] tracking-[0.16em] uppercase"
					style="color: var(--accent-green);"
				>
					Directors
				</div>
				<MetricToggle value={dirmetric} onchange={(v) => (dirmetric = v)} options={toggleopts} />
			</div>
			<BarList
				rows={dirrows}
				accent="var(--accent-green)"
				showrank={true}
				renderval={dirmetric === 'rating' ? ratingval : undefined}
			/>
		</div>

		<div
			class="col-span-2 min-h-[280px] rounded-[14px] border border-[var(--border)] p-5 px-[22px]"
			style="background: var(--bg-card);"
		>
			<div class="flex items-center justify-between mb-[14px]">
				<div
					class="font-mono text-[10.5px] tracking-[0.16em] uppercase"
					style="color: var(--accent-blue);"
				>
					Genres
				</div>
				<MetricToggle value={genremetric} onchange={(v) => (genremetric = v)} options={toggleopts} />
			</div>
			<BarList
				rows={genrerows}
				accent="var(--accent-blue)"
				showrank={true}
				renderval={genremetric === 'rating' ? ratingval : undefined}
			/>
		</div>

		<div
			class="col-span-4 rounded-[14px] border border-[var(--border)] p-5 px-[22px]"
			style="background: var(--bg-card);"
		>
			<h3
				class="font-display font-semibold text-[17px] tracking-[-0.01em] mb-4"
				style="color: var(--text);"
			>
				Insights
			</h3>
			<div
				class="grid gap-px border border-[var(--border)] rounded-[12px] overflow-hidden"
				style="background: var(--border); grid-template-columns: repeat(4, 1fr);"
			>
				{#each stats.insights as it (it.k)}
					<div class="px-[18px] pt-[18px] pb-5" style="background: var(--bg-card);">
						<div
							class="font-mono text-[10.5px] tracking-[0.06em] uppercase"
							style="color: var(--text-dim);"
						>
							{it.k}
						</div>
						{#if it.href}
							<a
								href="{base}{it.href}"
								class="font-num font-bold text-[27px] tracking-[-0.02em] mt-[10px] leading-none transition-[color] block"
								style="color: var(--text);"
								onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
								onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
							>{it.v}</a>
						{:else}
							<div
								class="font-num font-bold text-[27px] tracking-[-0.02em] mt-[10px] leading-none"
								style="color: var(--text);"
							>
								{it.v}
							</div>
						{/if}
						<div class="text-[12px] mt-[7px] leading-[1.35]" style="color: var(--text-muted);">
							{#if it.subhref}
								<a
									href="{base}{it.subhref}"
									class="transition-[color] inline-block"
									style="color: var(--text-muted);"
									onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
									onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
								>
									{it.sub}
								</a>
							{:else}
								{it.sub}
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{:else}
	<!-- LEDGER LAYOUT (default) -->
	<!-- heroes -->
	{@const heroes = [
		{
			v: fmtnum(stats.totalfilms),
			l: 'Films watched',
			s: '',
			color: 'var(--text)'
		},
		{
			v: stats.avgrating.toFixed(2),
			l: 'Average rating',
			s: '',
			color: 'var(--accent-green)'
		},
		{
			v: fmtnum(stats.hourstotal) + 'h',
			l: 'Hours watched',
			s: '',
			color: 'var(--accent-amber)'
		},
		{
			v: String(stats.filmsthisyear),
			l: 'Films in ' + stats.thisyear,
			s: '',
			color: 'var(--accent-blue)'
		}
	]}
	<div class="grid grid-cols-4 gap-0">
		{#each heroes as h, i (h.l)}
			<div
				class="px-7 border-l border-[var(--border)]"
				class:border-l-0={i === 0}
				class:pl-0={i === 0}
			>
				<div
					class="font-num font-bold text-[58px] leading-[0.9] tracking-[-0.04em]"
					style="color: {h.color};"
				>
					{h.v}
				</div>
				<div class="text-[14px] mt-3 font-medium" style="color: var(--text);">{h.l}</div>
				{#if h.s}
					<div class="font-mono text-[11px] mt-1" style="color: var(--text-dim);">{h.s}</div>
				{/if}
			</div>
		{/each}
	</div>

	<div class="h-px my-[26px]" style="background: var(--border);"></div>

	<!-- 3-col grid -->
	<div class="grid gap-7" style="grid-template-columns: 1fr 1px 1fr 1px 1fr;">
		<!-- rating dist -->
		<div class="min-w-0">
			<div class="flex items-center justify-between mb-4">
				<h3
					class="font-display font-semibold text-[16px] tracking-[-0.01em]"
					style="color: var(--text);"
				>
					Rating distribution
				</h3>
				<MetricToggle value={ratingmetric} onchange={(v) => (ratingmetric = v)} options={ratingtoggleopts} />
			</div>
			<div class="flex-1 flex flex-col justify-end">
				<ColumnChart
					data={stats.ratingdist.map((r) => ({
						label: r.star % 1 === 0 ? String(r.star) : r.star + '',
						count: r.count,
						liked: r.liked
					}))}
					accent="var(--accent-blue)"
					height={150}
					gethref={ratinghref}
					valuekey={ratingmetric}
				/>
				<div class="flex items-baseline gap-[10px] mt-4 pt-[14px] border-t border-[var(--border)]">
					<span
						class="font-num font-bold text-[22px] tracking-[-0.02em]"
						style="color: var(--accent-blue);">{ratingstatnum}</span
					>
					<span class="text-[12.5px]" style="color: var(--text-muted);">{ratingstatline}</span>
				</div>
			</div>
		</div>

		<div class="w-px" style="background: var(--border);"></div>

		<!-- runtime -->
		<div class="min-w-0">
			<div class="flex items-center justify-between mb-4">
				<h3
					class="font-display font-semibold text-[16px] tracking-[-0.01em]"
					style="color: var(--text);"
				>
					Runtime preferences
				</h3>
				<MetricToggle value={runtimemetric} onchange={(v) => (runtimemetric = v)} options={toggleopts} />
			</div>
			<div class="flex-1 flex flex-col justify-end">
				<ColumnChart data={stats.runtimebuckets} accent="var(--accent-amber)" height={150} gethref={runtimehref} valuekey={runtimechartkey} format={runtimefmt} />
				<div class="flex items-baseline gap-[10px] mt-4 pt-[14px] border-t border-[var(--border)]">
					<span
						class="font-num font-bold text-[22px] tracking-[-0.02em]"
						style="color: var(--accent-amber);">{runtimestatnum}</span
					>
					<span class="text-[12.5px]" style="color: var(--text-muted);">{runtimestatline}</span>
				</div>
			</div>
		</div>

		<div class="w-px" style="background: var(--border);"></div>

		<!-- directors -->
		<div class="min-w-0">
			<div class="flex items-center justify-between mb-[14px]">
				<div
					class="font-mono text-[10.5px] tracking-[0.16em] uppercase"
					style="color: var(--accent-green);"
				>
					Directors
				</div>
				<MetricToggle value={dirmetric} onchange={(v) => (dirmetric = v)} options={toggleopts} />
			</div>
			<BarList
				rows={dirrows}
				accent="var(--accent-green)"
				showrank={true}
				renderval={dirmetric === 'rating' ? ratingval : undefined}
			/>
		</div>
	</div>

	<div class="h-px my-[26px]" style="background: var(--border);"></div>

	<!-- insights -->
	<div>
		<h3
			class="font-display font-semibold text-[16px] tracking-[-0.01em] mb-5"
			style="color: var(--text);"
		>
			Insights
		</h3>
		<div
			class="grid gap-px border border-[var(--border)] rounded-[12px] overflow-hidden"
			style="background: var(--border); grid-template-columns: repeat(4, 1fr);"
		>
			{#each stats.insights as it (it.k)}
				<div class="px-[18px] pt-[18px] pb-5" style="background: var(--bg-card);">
					<div
						class="font-mono text-[10.5px] tracking-[0.06em] uppercase"
						style="color: var(--text-dim);"
					>
						{it.k}
					</div>
					{#if it.href}
						<a
							href="{base}{it.href}"
							class="font-num font-bold text-[27px] tracking-[-0.02em] mt-[10px] leading-none transition-[color] block"
							style="color: var(--text);"
							onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
							onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
						>{it.v}</a>
					{:else}
						<div
							class="font-num font-bold text-[27px] tracking-[-0.02em] mt-[10px] leading-none"
							style="color: var(--text);"
						>
							{it.v}
						</div>
					{/if}
					<div class="text-[12px] mt-[7px] leading-[1.35]" style="color: var(--text-muted);">
						{#if it.subhref}
							<a
								href="{base}{it.subhref}"
								class="transition-[color] inline-block"
								style="color: var(--text-muted);"
								onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
								onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
							>
								{it.sub}
							</a>
						{:else}
							{it.sub}
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
