<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Upload from '$lib/components/upload.svelte';
	import RangeSelector from '$lib/components/rangeselector.svelte';
	import { setContext } from 'svelte';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadstored, clearstored } from '$lib/pipeline/store';
	import type { dataset } from '$lib/pipeline/types';
	import { filterbyrange, type rangesel } from '$lib/stats/range';

	let { children } = $props();

	let data = $state<dataset | null>(null);
	let ready = $state(false);
	let dir = $state('ledger');
	let dropdownopen = $state(false);
	let range = $state<rangesel>({ kind: 'all' });

	const filtereddata = $derived(data ? filterbyrange(data, range) : null);

	onMount(() => {
		data = loadstored();
		ready = true;
	});

	function onloaded(d: dataset) {
		data = d;
	}

	function updatedata() {
		clearstored();
		data = null;
		dropdownopen = false;
	}

	setContext('dataset', {
		get data() {
			return filtereddata;
		}
	});
	setContext('ovdir', {
		get dir() {
			return dir;
		},
		setdir(v: string) {
			dir = v;
		}
	});

	const NAV = [
		{ label: 'Overview', href: '/' },
		{ label: 'Activity', href: '/activity' },
		{ label: 'Era', href: '/era' },
		{ label: 'World', href: '/world' },
		{ label: 'Genres', href: '/genres' },
		{ label: 'People', href: '/people' },
		{ label: 'Tags', href: '/tags' },
		{ label: 'Films', href: '/films' }
	];

	const TITLES: Record<string, string> = {
		'/': 'Overview',
		'/activity': 'Activity',
		'/era': 'Era',
		'/world': 'World',
		'/genres': 'Genres',
		'/people': 'People',
		'/tags': 'Tags',
		'/films': 'Films'
	};

	const DIRS = [
		{ id: 'ledger', title: 'Ledger' },
		{ id: 'marquee', title: 'Marquee' },
		{ id: 'panel', title: 'Panel' }
	];

	const pathname = $derived($page.url.pathname);
	const pagetitle = $derived(TITLES[pathname] ?? pathname.slice(1));
	const isoverview = $derived(pathname === '/');
	const ispipeline = $derived(pathname.startsWith('/pipeline'));
	const username = $derived(data?.profile?.name || data?.profile?.username || 'you');
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if ispipeline}
	{@render children()}
{:else if !ready}
	<!-- prevent flash before localStorage check -->
	<div class="min-h-screen" style="background: var(--bg);"></div>
{:else if !data}
	<Upload {onloaded} />
{:else}
	<div class="min-h-screen flex flex-col" style="background: var(--bg);">
		<!-- topbar -->
		<header
			class="sticky top-0 z-50 flex items-center gap-7 px-8 h-[60px] border-b border-[var(--border)]"
			style="background: color-mix(in oklab, var(--bg) 88%, transparent); backdrop-filter: blur(14px) saturate(1.2);"
		>
			<a href="{base}/" class="flex items-center gap-[9px] select-none">
				<span
					class="font-display font-bold text-[20px] tracking-[-0.02em]"
					style="color: var(--text);">postbox</span
				>
			</a>

			<nav class="flex items-center gap-0.5 ml-2">
				{#each NAV as n (n.href)}
					{@const active = pathname === n.href}
					<a
						href="{base}{n.href}"
						class="relative text-[13.5px] font-medium tracking-[0.01em] px-3 py-[7px] rounded-[7px] transition-colors"
						style={active ? 'color: var(--text);' : 'color: var(--text-muted);'}
						onmouseenter={(e) => {
							if (!active) {
								(e.currentTarget as HTMLElement).style.color = 'var(--text)';
								(e.currentTarget as HTMLElement).style.background = 'var(--bar-track)';
							}
						}}
						onmouseleave={(e) => {
							if (!active) {
								(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
								(e.currentTarget as HTMLElement).style.background = '';
							}
						}}
					>
						{n.label}
						{#if active}
							<span
								class="absolute left-3 right-3 bottom-[-1px] h-[2px] rounded-[2px]"
								style="background: var(--accent);"
							></span>
						{/if}
					</a>
				{/each}
			</nav>

			<!-- user avatar + dropdown -->
			<div class="ml-auto flex items-center gap-[9px] relative">
				<span class="text-[13px] font-mono" style="color: var(--text-muted);">{username}</span>
				<button
					class="w-[26px] h-[26px] rounded-full shrink-0 focus:outline-none"
					style="background: linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 40%, #222));"
					onclick={() => (dropdownopen = !dropdownopen)}
					aria-label="User menu"
				></button>

				{#if dropdownopen}
					<!-- backdrop -->
					<button
						class="fixed inset-0 z-40"
						tabindex="-1"
						onclick={() => (dropdownopen = false)}
						aria-label="Close menu"
					></button>
					<!-- dropdown -->
					<div
						class="absolute right-0 top-[calc(100%+8px)] z-50 rounded-[10px] border border-[var(--border)] py-1 min-w-[160px]"
						style="background: var(--bg-card); box-shadow: 0 8px 24px rgba(0,0,0,0.35);"
					>
						<button
							class="w-full flex items-center gap-[9px] px-[14px] py-[9px] text-[13px] transition-colors text-left"
							style="color: var(--text-muted);"
							onmouseenter={(e) => {
								(e.currentTarget as HTMLElement).style.color = 'var(--text)';
								(e.currentTarget as HTMLElement).style.background = 'var(--bar-track)';
							}}
							onmouseleave={(e) => {
								(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
								(e.currentTarget as HTMLElement).style.background = '';
							}}
							onclick={updatedata}
						>
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
								<polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.5" />
							</svg>
							Update data
						</button>
					</div>
				{/if}
			</div>
		</header>

		<!-- page head -->
		<div class="border-b border-[var(--border)]" style="background: var(--bg);">
			<div
				class="max-w-[1280px] mx-auto px-8 pt-[30px] pb-[22px] flex items-end justify-between gap-6"
			>
				<h1
					class="font-display font-bold text-[40px] tracking-[-0.03em] leading-[0.95]"
					style="color: var(--text);"
				>
					{pagetitle}
				</h1>

				<div class="flex items-center gap-3">
					<RangeSelector value={range} onchange={(v) => (range = v)} />

					{#if isoverview}
						<div
							class="flex items-center gap-0.5 p-[3px] rounded-[8px] border border-[var(--border)]"
							style="background: var(--bar-track);"
						>
							{#each DIRS as d (d.id)}
								{@const active = dir === d.id}
								<button
									class="flex items-center justify-center w-[30px] h-[28px] rounded-[6px] transition-all"
									style={active
										? 'color: var(--accent); background: color-mix(in oklab, var(--accent) 14%, transparent); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--accent) 30%, transparent);'
										: 'color: var(--text-dim);'}
									onmouseenter={(e) => {
										if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
									}}
									onmouseleave={(e) => {
										if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)';
									}}
									title={d.title}
									onclick={() => (dir = d.id)}
								>
									{#if d.id === 'ledger'}
										<svg
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
										>
											<line x1="3" y1="6" x2="21" y2="6" /><line
												x1="3"
												y1="12"
												x2="21"
												y2="12"
											/><line x1="3" y1="18" x2="21" y2="18" />
										</svg>
									{:else if d.id === 'marquee'}
										<svg
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<rect x="3" y="3" width="18" height="7" rx="1" /><rect
												x="3"
												y="13"
												width="8"
												height="8"
												rx="1"
											/><rect x="14" y="13" width="7" height="8" rx="1" />
										</svg>
									{:else}
										<svg
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<rect x="3" y="3" width="7" height="7" rx="1" /><rect
												x="14"
												y="3"
												width="7"
												height="7"
												rx="1"
											/><rect x="3" y="14" width="7" height="7" rx="1" /><rect
												x="14"
												y="14"
												width="7"
												height="7"
												rx="1"
											/>
										</svg>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- content -->
		<main class="max-w-[1280px] mx-auto px-8 pt-7 pb-[60px] w-full flex-1">
			{@render children()}
		</main>

		<!-- footer -->
		<footer
			class="max-w-[1280px] mx-auto w-full px-8 py-[22px] pb-9 flex items-center gap-[10px] font-mono text-[11.5px] border-t border-[var(--border)]"
			style="color: var(--text-dim);"
		>
			<span>postbox</span>
			<span class="opacity-50">·</span>
			<span>{data.films.length.toLocaleString()} films</span>
			<span class="opacity-50">·</span>
			<span>{data.diary.length.toLocaleString()} entries logged</span>
			<span class="flex-1"></span>
			<span class="opacity-80">a personal film almanac</span>
		</footer>
	</div>
{/if}
