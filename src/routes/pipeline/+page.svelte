<script lang="ts">
	import { loadfromzip, clearstored } from '$lib/pipeline';
	import type { dataset, pipelinetelemetry } from '$lib/pipeline/types';

	let status = $state('idle');
	let progress = $state<{ done: number; total: number } | null>(null);
	let data = $state<dataset | null>(null);
	let error = $state<string | null>(null);
	let file = $state<File | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	// Telemetry options
	let bypassLocalStorage = $state(false);
	let bypassIndexedDb = $state(false);

	// Telemetry metrics
	let telemetry = $state<pipelinetelemetry>({
		stage: 'idle',
		totalTime: 0,
		csvParseTime: 0,
		cacheLookupTime: 0,
		enrichmentTime: 0,
		totalFilms: 0,
		cacheHits: 0,
		cacheMisses: 0,
		toEnrichCount: 0,
		averageQueryLatency: 0,
		batchLogs: [],
		missDetails: [],
		processedFilms: []
	});

	async function run() {
		if (!file) {
			error = 'No zip file selected';
			return;
		}
		error = null;
		data = null;
		progress = null;
		telemetry = {
			stage: 'idle',
			totalTime: 0,
			csvParseTime: 0,
			cacheLookupTime: 0,
			enrichmentTime: 0,
			totalFilms: 0,
			cacheHits: 0,
			cacheMisses: 0,
			toEnrichCount: 0,
			averageQueryLatency: 0,
			batchLogs: [],
			missDetails: [],
			processedFilms: []
		};
		
		try {
			data = await loadfromzip(
				file,
				(msg, done, total) => {
					status = msg;
					if (done != null && total != null) progress = { done, total };
				},
				(tel) => {
					telemetry = tel;
				},
				{
					bypassLocalStorage,
					bypassIndexedDb
				}
			);
			status = 'complete';
		} catch (e) {
			error = String(e);
			status = 'error';
		}
	}

	function reset() {
		clearstored();
		data = null;
		file = null;
		if (fileInput) fileInput.value = '';
		status = 'idle';
		progress = null;
		error = null;
		telemetry = {
			stage: 'idle',
			totalTime: 0,
			csvParseTime: 0,
			cacheLookupTime: 0,
			enrichmentTime: 0,
			totalFilms: 0,
			cacheHits: 0,
			cacheMisses: 0,
			toEnrichCount: 0,
			averageQueryLatency: 0,
			batchLogs: [],
			missDetails: [],
			processedFilms: []
		};
	}

	function onchange(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		if (f && f.name.endsWith('.zip')) {
			file = f;
			error = null;
		} else {
			file = null;
			error = 'Please select a valid .zip file';
		}
	}

	function formatTime(ms: number): string {
		if (ms < 1000) return `${ms.toFixed(0)}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	}

	const pct = $derived(
		telemetry.totalFilms
			? (progress
				? progress.done / progress.total
				: telemetry.cacheHits / telemetry.totalFilms) * 100
			: 0
	);
</script>

<div class="max-w-4xl mx-auto p-6 font-mono text-sm text-gray-300 flex flex-col gap-6">
	<h1 class="text-xl font-bold text-white pb-2">pipeline test</h1>

	<!-- Upload & Controls Box -->
	<div class="border border-gray-800 rounded-lg p-4 bg-gray-900/30 flex flex-col gap-4">
		<div class="flex flex-wrap gap-4 items-center justify-between">
			<!-- Upload Button/Input -->
			<div class="flex items-center gap-2">
				<span class="text-gray-400 font-semibold">ZIP file:</span>
				<button 
					type="button"
					onclick={() => fileInput?.click()}
					class="text-xs bg-gray-800 border border-gray-700 hover:bg-gray-700/80 rounded px-2.5 py-1 text-gray-300 focus:outline-none transition-colors cursor-pointer"
				>
					{file ? file.name : 'upload .zip'}
				</button>
				<input 
					type="file" 
					accept=".zip" 
					bind:this={fileInput} 
					onchange={onchange} 
					class="hidden" 
				/>
			</div>

			<!-- Control Actions -->
			<div class="flex gap-2">
				<button 
					onclick={run} 
					disabled={!file} 
					class="rounded bg-blue-600 px-4 py-1.5 text-white hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 transition-colors font-medium cursor-pointer"
				>
					run pipeline
				</button>
				<button 
					onclick={reset} 
					class="rounded bg-red-600 px-4 py-1.5 text-white hover:bg-red-700 transition-colors font-medium cursor-pointer"
				>
					clear cache & reset
				</button>
			</div>
		</div>

		<!-- Bypass Options -->
		<div class="flex flex-wrap gap-6 pt-3 text-xs">
			<label class="flex items-center gap-2 cursor-pointer select-none text-gray-400 hover:text-gray-200">
				<input type="checkbox" bind:checked={bypassLocalStorage} class="accent-blue-500" />
				<span>bypass localstorage</span>
			</label>
			<label class="flex items-center gap-2 cursor-pointer select-none text-gray-400 hover:text-gray-200">
				<input type="checkbox" bind:checked={bypassIndexedDb} class="accent-blue-500" />
				<span>bypass indexeddb</span>
			</label>
		</div>
	</div>

	<!-- Status & Ingestion Progress -->
	<div class="border border-gray-800 rounded-lg p-4 bg-gray-900/20">
		<div class="flex justify-between items-center mb-2">
			<div>status: <span class="text-yellow-400 font-bold">{status}</span></div>
			{#if progress}
				<div class="text-xs text-gray-400">
					progress: {progress.done} / {progress.total} ({Math.round((progress.done / progress.total) * 100)}%)
				</div>
			{/if}
		</div>

		{#if progress || telemetry.totalFilms > 0}
			<div class="h-2 w-full rounded bg-gray-800 overflow-hidden">
				<div
					class="h-full bg-blue-500 transition-all duration-300"
					style="width: {pct}%"
				></div>
			</div>
		{/if}

		{#if error}
			<p class="text-red-400 mt-2">error: {error}</p>
		{/if}
	</div>

	<!-- Stats Grid -->
	<div class="border border-gray-800 rounded-lg p-4 bg-gray-900/30">
		<h3 class="text-xs uppercase tracking-wider text-gray-500 font-bold mb-3">statistics</h3>
		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-xs">
			<div class="flex justify-between pb-1">
				<span class="text-gray-400">elapsed time:</span>
				<span class="text-white font-semibold">{formatTime(telemetry.totalTime)}</span>
			</div>
			<div class="flex justify-between pb-1">
				<span class="text-gray-400">csv parse time:</span>
				<span class="text-white font-semibold">{formatTime(telemetry.csvParseTime)}</span>
			</div>
			<div class="flex justify-between pb-1">
				<span class="text-gray-400">cache lookup time:</span>
				<span class="text-white font-semibold">{formatTime(telemetry.cacheLookupTime)}</span>
			</div>
			<div class="flex justify-between pb-1">
				<span class="text-gray-400">enrichment time:</span>
				<span class="text-white font-semibold">{formatTime(telemetry.enrichmentTime)}</span>
			</div>
			<div class="flex justify-between pb-1">
				<span class="text-gray-400">average latency:</span>
				<span class="text-white font-semibold">{formatTime(telemetry.averageQueryLatency)}</span>
			</div>
			<div class="flex justify-between pb-1">
				<span class="text-gray-400">cache ratio (hits/misses):</span>
				<span class="text-white font-semibold">
					{telemetry.cacheHits} / {telemetry.cacheMisses}
					{#if telemetry.totalFilms > 0}
						<span class="text-gray-400 ml-1">({Math.round((telemetry.cacheHits / telemetry.totalFilms) * 100)}%)</span>
					{/if}
				</span>
			</div>
		</div>
	</div>

	<!-- Collapsible Batch Logs -->
	{#if telemetry.batchLogs.length > 0}
		<details class="border border-gray-800 rounded-lg bg-gray-900/10">
			<summary class="cursor-pointer text-gray-400 p-3 font-semibold select-none hover:text-white transition-colors">
				batch logs ({telemetry.batchLogs.length})
			</summary>
			<div class="p-4 pt-0 space-y-2 text-xs max-h-60 overflow-y-auto mt-1">
				{#each telemetry.batchLogs as log (log.batchIndex)}
					<div class="pb-2 mb-2">
						<div class="flex justify-between font-bold text-gray-300">
							<span>batch #{log.batchIndex} ({log.size} films)</span>
							<span class="text-gray-400 font-normal">{formatTime(log.latency)} - {log.status}</span>
						</div>
						<div class="text-gray-500 mt-0.5">{log.films.map(f => `${f.name} (${f.year})`).join(', ')}</div>
						{#if log.error}
							<div class="text-red-400 mt-1">error: {log.error}</div>
						{/if}
					</div>
				{/each}
			</div>
		</details>
	{/if}

	<!-- Collapsible Processed Entries List (Hits & Misses) -->
	{#if telemetry.processedFilms.length > 0}
		<details class="border border-gray-800 rounded-lg bg-gray-900/10" open>
			<summary class="cursor-pointer text-gray-400 p-3 font-semibold select-none hover:text-white transition-colors">
				processed films ({telemetry.processedFilms.length})
			</summary>
			<div class="p-4 pt-0 max-h-96 overflow-y-auto mt-1">
				<table class="w-full text-left text-xs border-collapse">
					<thead>
						<tr class="text-gray-500">
							<th class="py-2 font-semibold">film</th>
							<th class="py-2 text-center font-semibold">year</th>
							<th class="py-2 font-semibold">cache status</th>
							<th class="py-2 font-semibold">resolved status</th>
							<th class="py-2 text-right font-semibold">tmdb id</th>
						</tr>
					</thead>
					<tbody>
						{#each telemetry.processedFilms as pf (pf.uri)}
							<tr class="hover:bg-gray-800/10 transition-colors">
								<td class="py-2 font-semibold text-gray-300">{pf.name}</td>
								<td class="py-2 text-center text-gray-400">{pf.year}</td>
								<td class="py-2">
									{#if pf.isHit}
										<span class="text-emerald-500 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">HIT</span>
									{:else}
										<span class="text-amber-500 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded">MISS</span>
									{/if}
								</td>
								<td class="py-2">
									<span class="text-gray-400 capitalize">{pf.status.replace('resolved_', '')}</span>
								</td>
								<td class="py-2 text-right text-gray-400">
									{pf.tmdbid || '—'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
	{/if}
</div>
