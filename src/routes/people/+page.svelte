<script lang="ts">
	import { getContext } from 'svelte';
	import type { dataset } from '$lib/pipeline/types';
	import { computepeople, type personstat } from '$lib/stats/people';
	import { base } from '$app/paths';
	import Card from '$lib/components/card.svelte';
	import Infotip from '$lib/components/infotip.svelte';
	import MetricToggle from '$lib/components/metrictoggle.svelte';
	import IconStarFilled from '~icons/tabler/star-filled';
	import ListExpansion from '$lib/components/listexpansion.svelte';
	import { persistedState } from '$lib/state.svelte';

	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	const dsctx = getContext<{ data: dataset | null }>('dataset');
	const rangectx = getContext<{ kind: string }>('range');
	const stats = $derived(dsctx.data ? computepeople(dsctx.data) : null);

	const hasratings = $derived(dsctx.data?.films.some((f) => f.rating !== null) ?? false);
	const haslikes = $derived(dsctx.data?.films.some((f) => f.liked) ?? false);

	const TABS = ['Directors', 'Actors', 'Crew'] as const;
	type Tab = (typeof TABS)[number];
	const tab = $derived(
		(TABS as readonly string[]).includes($page.url.searchParams.get('tab') ?? '')
			? ($page.url.searchParams.get('tab') as Tab)
			: 'Directors'
	);
	let countLimit = $state(10);
	let ratedLimit = $state(10);
	const ratedmetric = persistedState('postbox_metric_people_rated', 'rating');

	function settab(t: Tab) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('tab', t);
		goto(`${base}/people?${params.toString()}`, { replaceState: true, noScroll: true });
	}

	$effect(() => {
		tab;
		countLimit = 10;
		ratedLimit = 10;
		if (dsctx.data && ratedopts.length > 0) {
			ratedmetric.value = ratedopts.some((o) => o.id === 'rating') ? 'rating' : 'liked';
		}
	});
	$effect(() => {
		if (dsctx.data && ratedopts.length > 0) {
			const hasCurrent = ratedopts.some((o) => o.id === ratedmetric.value);
			if (!hasCurrent) {
				ratedmetric.value = ratedopts[0].id;
			}
		}
	});

	const rows = $derived.by(() => {
		if (!stats) return [];
		if (tab === 'Directors') return stats.directors;
		if (tab === 'Actors') return stats.actors;
		return stats.crew;
	});

	const allbycount = $derived(rows.slice().sort((a, b) => b.watched - a.watched));
	const minthreshold = $derived(
		tab === 'Crew' ? 1 : (rangectx.kind === '6mo' || rangectx.kind === '1mo') ? 1 : 3
	);
	const allbyrating = $derived(
		rows
			.slice()
			.filter((r) => (r.ratedfilms ?? 0) >= minthreshold)
			.sort((a, b) => b.avg - a.avg)
	);
	const allbyliked = $derived(rows.slice().sort((a, b) => b.liked - a.liked));
	const tiptext = $derived(
		`Only ${tab.toLowerCase()} with at least ${minthreshold} rated ${minthreshold === 1 ? 'film' : 'films'} are included.`
	);

	const bycount = $derived(allbycount.slice(0, countLimit));
	const byrating = $derived(allbyrating.slice(0, ratedLimit));
	const byliked = $derived(allbyliked.slice(0, ratedLimit));

	const heroa = $derived(allbycount[0] ?? null);
	const herob = $derived(ratedmetric.value === 'liked' ? allbyliked[0] ?? null : allbyrating[0] ?? null);

	const maxcount = $derived(Math.max(...bycount.map((r) => r.watched), 1));
	const maxrating = $derived(Math.max(...byrating.map((r) => r.avg), 1));
	const maxliked = $derived(Math.max(...byliked.map((r) => r.liked), 1));

	const ratedopts = $derived.by(() => {
		const opts = [];
		if (hasratings && allbyrating.length > 0) {
			opts.push({ id: 'rating', label: 'Highest rated' });
		}
		if (haslikes || (!haslikes && !hasratings)) {
			opts.push({ id: 'liked', label: 'Most liked' });
		}
		return opts;
	});

	/** initials from a full name */
	function initials(name: string): string {
		return name
			.split(/\s+/)
			.map((w) => w[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	function personhref(name: string): string {
		if (tab === 'Directors') return `${base}/films?director=${encodeURIComponent(name)}`;
		if (tab === 'Actors') return `${base}/films?actor=${encodeURIComponent(name)}`;
		if (tab === 'Crew') return `${base}/films?crew=${encodeURIComponent(name)}`;
		return '';
	}
</script>

{#if !stats}
	<div class="py-[60px] font-mono text-[13px]" style="color: var(--text-dim);">
		No data — run the import pipeline first.
	</div>
{:else}
	<div class="flex flex-col gap-[20px]">
		<!-- tab bar -->
		<div class="flex gap-0 border-b border-[var(--border)]">
			{#each TABS as t (t)}
				<button
					class="text-[14px] px-[18px] py-[10px] -mb-px transition-colors"
					style={tab === t
						? 'font-weight: 600; color: var(--text); border-bottom: 2px solid var(--accent);'
						: 'font-weight: 400; color: var(--text-muted); border-bottom: 2px solid transparent;'}
					onclick={() => settab(t)}>{t}</button
				>
			{/each}
		</div>

		<!-- hero row -->
		<div class="grid grid-cols-3 gap-4">
			<section
				class="rounded-[14px] border border-[var(--border)] p-5 px-[22px] flex flex-col justify-center"
				style="background: var(--bg-card);"
			>
				<div
					class="font-mono text-[10.5px] tracking-[0.08em] uppercase mb-2"
					style="color: var(--text-dim);"
				>
					{tab === 'Crew' ? 'Collaborators' : tab + ' watched'}
				</div>
				<div
					class="font-display font-bold text-[52px] leading-none tracking-[-0.03em]"
					style="color: var(--text);"
				>
					{rows.length}
				</div>
				<div class="text-[12.5px] mt-1" style="color: var(--text-muted);">
					unique {tab.toLowerCase()}
				</div>
			</section>
			<section
				class="rounded-[14px] border border-[var(--border)] p-5 px-[22px] flex flex-col justify-center"
				style="background: var(--bg-card);"
			>
				<div
					class="font-mono text-[10.5px] tracking-[0.08em] uppercase mb-2"
					style="color: var(--text-dim);"
				>
					Most watched
				</div>
				{#if heroa}
					<div class="flex items-center gap-3 mb-1">
						{#if heroa.photo}
							<img
								src={heroa.photo}
								alt={heroa.name}
								class="w-10 h-10 rounded-full object-cover shrink-0"
								style="border: 1.5px solid var(--border-2);"
							/>
						{:else}
							<div
								class="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-mono text-[12px] font-bold"
								style="background: color-mix(in oklab, var(--accent) 15%, var(--bg-1)); color: var(--accent); border: 1.5px solid var(--border);"
							>
								{initials(heroa.name)}
							</div>
						{/if}
						<a
							href={personhref(heroa.name)}
							class="font-display font-bold text-[22px] leading-[1.1] tracking-[-0.02em] truncate transition-[color]"
							style="color: var(--text);"
							onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
							onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
						>
							{heroa.name}
						</a>
					</div>
					<div class="text-[12.5px]" style="color: var(--text-muted);">
						{heroa.watched} film{heroa.watched === 1 ? '' : 's'} logged
					</div>
				{/if}
			</section>
			<section
				class="rounded-[14px] border border-[var(--border)] p-5 px-[22px] flex flex-col justify-center"
				style="background: var(--bg-card);"
			>
				<div class="flex items-center justify-between mb-2">
					<div
						class="font-mono text-[10.5px] tracking-[0.08em] uppercase"
						style="color: var(--text-dim);"
					>
						{ratedmetric.value === 'liked' ? 'Most liked' : 'Highest rated'}
					</div>
					{#if ratedopts.length > 1}
						<MetricToggle value={ratedmetric.value} onchange={(v) => (ratedmetric.value = v)} options={ratedopts} />
					{/if}
				</div>
				{#if herob}
					<div class="flex items-center gap-3 mb-1">
						{#if herob.photo}
							<img
								src={herob.photo}
								alt={herob.name}
								class="w-10 h-10 rounded-full object-cover shrink-0"
								style="border: 1.5px solid var(--border-2);"
							/>
						{:else}
							<div
								class="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-mono text-[12px] font-bold"
								style="background: color-mix(in oklab, var(--accent-amber) 15%, var(--bg-1)); color: var(--accent-amber); border: 1.5px solid var(--border);"
							>
								{initials(herob.name)}
							</div>
						{/if}
						<a
							href={personhref(herob.name)}
							class="font-display font-bold text-[22px] leading-[1.1] tracking-[-0.02em] truncate transition-[color]"
							style="color: var(--text);"
							onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
							onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
						>
							{herob.name}
						</a>
					</div>
					<div class="text-[12.5px]" style="color: var(--text-muted);">
						{ratedmetric.value === 'liked'
							? herob.liked + ' liked film' + (herob.liked === 1 ? '' : 's')
							: herob.avg.toFixed(2) + ' avg rating' + (herob.role ? ' · ' + herob.role : '')}
					</div>
				{/if}
			</section>
		</div>

		<!-- two lists -->
		<div class="grid grid-cols-2 gap-[18px] items-start">
			<Card title="Most watched">
				<div class="flex flex-col gap-[9px]">
					{#each bycount as person, i (person.name + '|' + i)}
						{@const w = Math.max(2, (person.watched / maxcount) * 100)}
						<div
							class="grid items-center gap-3"
							style="grid-template-columns: auto 28px minmax(80px, 1fr) 1fr auto;"
						>
							<span class="font-mono text-[11px] w-[18px]" style="color: var(--text-dim);"
								>{String(i + 1).padStart(2, '0')}</span
							>
							{#if person.photo}
								<img
									src={person.photo}
									alt={person.name}
									class="w-7 h-7 rounded-full object-cover"
									style="border: 1px solid var(--border);"
								/>
							{:else}
								<div
									class="w-7 h-7 rounded-full flex items-center justify-center font-mono text-[9px] font-bold shrink-0"
									style="background: color-mix(in oklab, var(--accent) 12%, var(--bg-1)); color: var(--accent);"
								>
									{initials(person.name)}
								</div>
							{/if}
							<div class="flex flex-col min-w-0">
								<a
									href={personhref(person.name) || undefined}
									class="text-[13.5px] font-medium truncate transition-[color]"
									style="color: var(--text);"
									title={person.name}
									onmouseenter={personhref(person.name) ? (e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)') : undefined}
									onmouseleave={personhref(person.name) ? (e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)') : undefined}
									>{person.name}</a
								>
								{#if person.role}
									<span class="text-[11px]" style="color: var(--text-dim);">{person.role}</span>
								{/if}
							</div>
							<span
								class="h-[7px] rounded-full overflow-hidden"
								style="background: var(--bar-track);"
							>
								<span
									class="block h-full rounded-full transition-[width] duration-500"
									style="width: {w}%; background: var(--accent);"
								></span>
							</span>
							<span
								class="font-mono text-[12.5px] font-bold min-w-[32px] flex items-center justify-end"
								style="color: var(--text);">{person.watched}</span
							>
						</div>
					{/each}
				</div>
				<ListExpansion total={allbycount.length} bind:limit={countLimit} />
			</Card>

			<Card title={ratedmetric.value === 'liked' ? 'Most liked' : 'Highest rated'}>
				{#snippet actions()}
					<div class="flex items-center gap-2">
						{#if ratedmetric.value === 'rating'}
							<Infotip text={tiptext} />
						{/if}
						{#if ratedopts.length > 1}
							<MetricToggle value={ratedmetric.value} onchange={(v) => (ratedmetric.value = v)} options={ratedopts} />
						{/if}
					</div>
				{/snippet}
				{@const activelist = ratedmetric.value === 'liked' ? byliked : byrating}
				{@const maxval = ratedmetric.value === 'liked' ? maxliked : maxrating}
				<div class="flex flex-col gap-[9px]">
					{#each activelist as person, i (person.name + '|' + i)}
						{@const w = Math.max(2, ratedmetric.value === 'liked' ? (person.liked / maxval) * 100 : (person.avg / maxval) * 100)}
						<div
							class="grid items-center gap-3"
							style="grid-template-columns: auto 28px minmax(80px, 1fr) 1fr auto;"
						>
							<span class="font-mono text-[11px] w-[18px]" style="color: var(--text-dim);"
								>{String(i + 1).padStart(2, '0')}</span
							>
							{#if person.photo}
								<img
									src={person.photo}
									alt={person.name}
									class="w-7 h-7 rounded-full object-cover"
									style="border: 1px solid var(--border);"
								/>
							{:else}
								<div
									class="w-7 h-7 rounded-full flex items-center justify-center font-mono text-[9px] font-bold shrink-0"
									style="background: color-mix(in oklab, var(--accent-amber) 12%, var(--bg-1)); color: var(--accent-amber);"
								>
									{initials(person.name)}
								</div>
							{/if}
							<div class="flex flex-col min-w-0">
								<a
									href={personhref(person.name) || undefined}
									class="text-[13.5px] font-medium truncate transition-[color]"
									style="color: var(--text);"
									title={person.name}
									onmouseenter={personhref(person.name) ? (e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)') : undefined}
									onmouseleave={personhref(person.name) ? (e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)') : undefined}
									>{person.name}</a
								>
								{#if person.role}
									<span class="text-[11px]" style="color: var(--text-dim);">{person.role}</span>
								{/if}
							</div>
							<span
								class="h-[7px] rounded-full overflow-hidden"
								style="background: var(--bar-track);"
							>
								<span
									class="block h-full rounded-full transition-[width] duration-500"
									style="width: {w}%; background: var(--accent-amber);"
								></span>
							</span>
							<span
								class="font-mono text-[12.5px] font-bold min-w-[42px] flex items-center justify-end gap-0.5"
								style="color: var(--text);"
							>
								{#if ratedmetric.value === 'liked'}
									{person.liked}
								{:else}
									{person.avg.toFixed(1)}
									<IconStarFilled width="11" height="11" class="text-[var(--accent-amber)] shrink-0" />
								{/if}
							</span>
						</div>
					{/each}
				</div>
				{@const allactive = ratedmetric.value === 'liked' ? allbyliked : allbyrating}
				<ListExpansion total={allactive.length} bind:limit={ratedLimit} />
			</Card>
		</div>


	</div>
{/if}
