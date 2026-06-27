<script lang="ts">
	import { onMount } from 'svelte';
	import { geoNaturalEarth1, geoPath } from 'd3-geo';
	import { feature, mesh } from 'topojson-client';
	import type { Topology, Objects } from 'topojson-specification';

	type CountryEntry = { name: string; count: number; avg: number; liked: number };
	type Props = {
		data: CountryEntry[];
		metric: string;
		oncountryclick?: (name: string) => void;
	};
	let { data, metric, oncountryclick }: Props = $props();

	// ISO 3166-1 numeric → display name (must match world.ts countryname() output)
	const ISO: Record<number, string> = {
		4: 'Afghanistan',
		8: 'Albania',
		12: 'Algeria',
		24: 'Angola',
		32: 'Argentina',
		36: 'Australia',
		40: 'Austria',
		50: 'Bangladesh',
		56: 'Belgium',
		64: 'Bhutan',
		68: 'Bolivia',
		76: 'Brazil',
		100: 'Bulgaria',
		116: 'Cambodia',
		120: 'Cameroon',
		124: 'Canada',
		152: 'Chile',
		156: 'China',
		170: 'Colombia',
		188: 'Costa Rica',
		191: 'Croatia',
		192: 'Cuba',
		196: 'Cyprus',
		203: 'Czech Republic',
		208: 'Denmark',
		214: 'Dominican Republic',
		218: 'Ecuador',
		818: 'Egypt',
		231: 'Ethiopia',
		246: 'Finland',
		250: 'France',
		266: 'Gabon',
		276: 'Germany',
		288: 'Ghana',
		300: 'Greece',
		320: 'Guatemala',
		332: 'Haiti',
		340: 'Honduras',
		348: 'Hungary',
		356: 'India',
		360: 'Indonesia',
		364: 'Iran',
		368: 'Iraq',
		372: 'Ireland',
		376: 'Israel',
		380: 'Italy',
		388: 'Jamaica',
		392: 'Japan',
		400: 'Jordan',
		398: 'Kazakhstan',
		404: 'Kenya',
		410: 'South Korea',
		408: 'North Korea',
		414: 'Kuwait',
		422: 'Lebanon',
		430: 'Liberia',
		434: 'Libya',
		442: 'Luxembourg',
		458: 'Malaysia',
		466: 'Mali',
		484: 'Mexico',
		504: 'Morocco',
		508: 'Mozambique',
		104: 'Myanmar',
		516: 'Namibia',
		524: 'Nepal',
		528: 'Netherlands',
		554: 'New Zealand',
		558: 'Nicaragua',
		566: 'Nigeria',
		578: 'Norway',
		586: 'Pakistan',
		591: 'Panama',
		600: 'Paraguay',
		604: 'Peru',
		608: 'Philippines',
		616: 'Poland',
		620: 'Portugal',
		630: 'Puerto Rico',
		634: 'Qatar',
		642: 'Romania',
		643: 'Russia',
		682: 'Saudi Arabia',
		686: 'Senegal',
		694: 'Sierra Leone',
		703: 'Slovakia',
		705: 'Slovenia',
		706: 'Somalia',
		710: 'South Africa',
		728: 'South Sudan',
		724: 'Spain',
		144: 'Sri Lanka',
		736: 'Sudan',
		752: 'Sweden',
		756: 'Switzerland',
		760: 'Syria',
		158: 'Taiwan',
		764: 'Thailand',
		792: 'Turkey',
		800: 'Uganda',
		804: 'Ukraine',
		784: 'United Arab Emirates',
		826: 'UK',
		840: 'USA',
		858: 'Uruguay',
		860: 'Uzbekistan',
		862: 'Venezuela',
		704: 'Vietnam',
		887: 'Yemen',
		894: 'Zambia',
		716: 'Zimbabwe',
		344: 'Hong Kong',
		446: 'Macau',
		275: 'Palestine'
	};

	type CountryShape = {
		id: number;
		path: string;
		centroid: [number, number];
		name: string | null;
	};

	const W = 860;
	const H = 440;

	let countries = $state<CountryShape[]>([]);
	let borderpath = $state('');
	let tooltip = $state<{ name: string; count: number; avg: number; x: number; y: number } | null>(
		null
	);
	let hovered = $state<number | null>(null);

	const datamap = $derived(new Map(data.map((d) => [d.name, d])));
	const maxcount = $derived(Math.max(...data.map((d) => d.count), 1));
	const maxavg = $derived(Math.max(...data.map((d) => d.avg ?? 0), 1));
	const maxliked = $derived(Math.max(...data.map((d) => d.liked ?? 0), 1));

	function getopacity(id: number): number | null {
		const name = ISO[id];
		const entry = name ? datamap.get(name) : null;
		if (!entry) return null;
		const val = metric === 'liked' ? (entry.liked ?? 0) : metric === 'count' ? entry.count : (entry.avg ?? 0);
		const mx = metric === 'liked' ? maxliked : metric === 'count' ? maxcount : maxavg;
		return 0.18 + Math.min(1, val / mx) * 0.72;
	}

	onMount(async () => {
		const world = await fetch('/countries-110m.json').then((r) => r.json());

		const proj = geoNaturalEarth1().fitSize([W, H], { type: 'Sphere' } as any);
		const pathgen = geoPath().projection(proj);

		const feats = feature(world as Topology<Objects>, (world as any).objects.countries);
		const borders = mesh(
			world as Topology<Objects>,
			(world as any).objects.countries,
			(a: any, b: any) => a !== b
		);

		let fallbackId = -1;
		countries = (feats as any).features.map((f: any) => {
			const rawId = f.id !== undefined ? +f.id : NaN;
			const id = isNaN(rawId) ? fallbackId-- : rawId;
			return {
				id,
				path: pathgen(f) ?? '',
				centroid: pathgen.centroid(f),
				name: ISO[id] ?? null
			};
		});
		borderpath = pathgen(borders as any) ?? '';
	});
</script>

<div style="position: relative;">
	<svg
		viewBox="0 0 {W} {H}"
		style="width: 100%; height: auto; display: block;"
		role="img"
		aria-label="World map of films watched"
	>
		<rect width={W} height={H} fill="rgba(255,255,255,0.015)" />

		{#each countries as c (c.id)}
			{@const op = hovered === c.id && getopacity(c.id) !== null ? 1 : getopacity(c.id)}
			<path
				role="presentation"
				d={c.path}
				fill={op !== null ? 'var(--accent)' : 'rgba(255,255,255,0.05)'}
				fill-opacity={op !== null ? op : 0.07}
				stroke={hovered === c.id ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.09)'}
				stroke-width={hovered === c.id ? 1 : 0.5}
				style={getopacity(c.id) !== null ? 'cursor: pointer;' : ''}
				onclick={() => {
					const name = ISO[c.id];
					if (name && datamap.has(name) && oncountryclick) oncountryclick(name);
				}}
				onmouseenter={() => {
					hovered = c.id;
					const name = ISO[c.id];
					const entry = name ? datamap.get(name) : null;
					if (entry && c.centroid) {
						tooltip = {
							name: entry.name,
							count: entry.count,
							avg: entry.avg,
							x: (c.centroid[0] / W) * 100,
							y: (c.centroid[1] / H) * 100
						};
					}
				}}
				onmouseleave={() => {
					hovered = null;
					tooltip = null;
				}}
			/>
		{/each}

		{#if borderpath}
			<path d={borderpath} fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5" />
		{/if}
	</svg>

	{#if tooltip}
		<div
			style="position: absolute; left: {tooltip.x}%; top: {tooltip.y}%; transform: translate(-50%, calc(-100% - 10px)); background: var(--bg-card); border: 1px solid var(--border-2); border-radius: 10px; padding: 9px 14px; pointer-events: none; z-index: 20; white-space: nowrap; box-shadow: 0 6px 24px rgba(0,0,0,0.55);"
		>
			<div style="font-weight: 700; font-size: 13px; margin-bottom: 4px; color: var(--text);">
				{tooltip.name}
			</div>
			<div
				class="font-mono text-[11px]"
				style="color: var(--text-muted); display: flex; gap: 10px;"
			>
				<span>{tooltip.count.toLocaleString()} films</span>
				<span style="color: var(--text-dim);">·</span>
				<span>
					{tooltip.avg.toFixed(2)}
				</span>
			</div>
		</div>
	{/if}
</div>
