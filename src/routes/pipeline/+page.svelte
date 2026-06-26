<script lang="ts">
	import { loadpipeline, clearstored } from '$lib/pipeline';
	import type { dataset } from '$lib/pipeline/types';

	let status = $state('idle');
	let progress = $state<{ done: number; total: number } | null>(null);
	let data = $state<dataset | null>(null);
	let error = $state<string | null>(null);

	async function run() {
		error = null;
		data = null;
		progress = null;
		try {
			data = await loadpipeline((msg, done, total) => {
				status = msg;
				if (done != null && total != null) progress = { done, total };
			});
			status = 'complete';
		} catch (e) {
			error = String(e);
			status = 'error';
		}
	}

	function reset() {
		clearstored();
		data = null;
		status = 'idle';
		progress = null;
		error = null;
	}
</script>

<div class="p-8 font-mono text-sm">
	<h1 class="mb-4 text-lg font-bold">pipeline test</h1>

	<div class="mb-4 flex gap-3">
		<button onclick={run} class="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
			>run pipeline</button
		>
		<button onclick={reset} class="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700"
			>clear cache & reset</button
		>
	</div>

	<p class="mb-2">status: <span class="text-yellow-300">{status}</span></p>

	{#if progress}
		<p class="mb-2">
			progress: {progress.done} / {progress.total}
			<span class="ml-2 text-gray-400">
				({Math.round((progress.done / progress.total) * 100)}%)
			</span>
		</p>
		<div class="mb-4 h-2 w-64 rounded bg-gray-700">
			<div
				class="h-2 rounded bg-blue-500 transition-all"
				style="width: {(progress.done / progress.total) * 100}%"
			></div>
		</div>
	{/if}

	{#if error}
		<p class="text-red-400">error: {error}</p>
	{/if}

	{#if data}
		<div class="mt-4 space-y-2">
			<p>films: {data.films.length}</p>
			<p>diary entries: {data.diary.length}</p>
			<p>enriched: {data.films.filter((f) => f.tmdb != null).length} with tmdb data</p>
			<p>cached at: {new Date(data.enrichedat).toLocaleString()}</p>

			<details class="mt-4">
				<summary class="cursor-pointer text-gray-400">first 3 films</summary>
				<pre class="mt-2 overflow-auto text-xs">{JSON.stringify(
						data.films.slice(0, 3),
						null,
						2
					)}</pre>
			</details>

			<details class="mt-2">
				<summary class="cursor-pointer text-gray-400">first 3 diary entries</summary>
				<pre class="mt-2 overflow-auto text-xs">{JSON.stringify(
						data.diary.slice(0, 3),
						null,
						2
					)}</pre>
			</details>
		</div>
	{/if}
</div>
