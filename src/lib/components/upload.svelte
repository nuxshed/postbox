<script lang="ts">
	import { loadfromzip } from '$lib/pipeline';
	import type { dataset } from '$lib/pipeline/types';

	type Props = { onloaded: (data: dataset) => void };
	let { onloaded }: Props = $props();

	let file = $state<File | null>(null);
	let dragging = $state(false);
	let status = $state<'idle' | 'loading' | 'error'>('idle');
	let msg = $state('');
	let progress = $state<{ done: number; total: number } | null>(null);

	function onfile(f: File) {
		if (!f.name.endsWith('.zip')) {
			msg = 'Please upload a .zip file.';
			status = 'error';
			return;
		}
		file = f;
		status = 'idle';
		msg = '';
	}

	function ondrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const f = e.dataTransfer?.files[0];
		if (f) onfile(f);
	}

	function onchange(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		if (f) onfile(f);
	}

	async function run() {
		if (!file) return;
		status = 'loading';
		progress = null;
		try {
			const data = await loadfromzip(file, (m, done, total) => {
				msg = m;
				if (done != null && total != null) progress = { done, total };
			});
			onloaded(data);
		} catch (e) {
			status = 'error';
			msg = String(e);
		}
	}
</script>

<div
	class="min-h-screen flex flex-col items-center justify-center px-6"
	style="background: var(--bg);"
>
	<div class="w-full max-w-[460px] flex flex-col gap-6">
		<!-- logo -->
		<div class="flex flex-col gap-1">
			<span
				class="font-display font-bold text-[28px] tracking-[-0.025em]"
				style="color: var(--text);">postbox</span
			>
			<span class="text-[14px]" style="color: var(--text-muted);"
				>import your Letterboxd data to get started</span
			>
		</div>

		<!-- drop zone -->
		<button
			class="relative flex flex-col items-center justify-center gap-3 rounded-[14px] border-2 border-dashed p-10 text-center transition-colors cursor-pointer"
			style={dragging
				? 'border-color: var(--accent); background: color-mix(in oklab, var(--accent) 6%, transparent);'
				: file
					? 'border-color: var(--accent); background: color-mix(in oklab, var(--accent) 4%, transparent);'
					: 'border-color: var(--border-2); background: var(--bg-card);'}
			ondragover={(e) => {
				e.preventDefault();
				dragging = true;
			}}
			ondragleave={() => (dragging = false)}
			{ondrop}
			onclick={() => document.getElementById('zipinput')?.click()}
			type="button"
		>
			<svg
				width="28"
				height="28"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				style="color: {file ? 'var(--accent)' : 'var(--text-dim)'};"
			>
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
					points="17 8 12 3 7 8"
				/><line x1="12" y1="3" x2="12" y2="15" />
			</svg>
			{#if file}
				<span class="text-[14px] font-medium" style="color: var(--text);">{file.name}</span>
				<span class="text-[12px]" style="color: var(--text-muted);"
					>{(file.size / 1024 / 1024).toFixed(1)} MB · click to change</span
				>
			{:else}
				<span class="text-[14px] font-medium" style="color: var(--text);"
					>Drop your export zip here</span
				>
				<span class="text-[12px]" style="color: var(--text-muted);"
					>or click to browse · from letterboxd.com/settings/data</span
				>
			{/if}
		</button>
		<input id="zipinput" type="file" accept=".zip" class="hidden" {onchange} />

		<!-- progress / error -->
		{#if status === 'loading'}
			<div class="flex flex-col gap-2">
				<div class="flex justify-between items-center">
					<span class="font-mono text-[11.5px]" style="color: var(--text-muted);">{msg}</span>
					{#if progress}
						<span class="font-mono text-[11.5px]" style="color: var(--text-dim);"
							>{progress.done} / {progress.total}</span
						>
					{/if}
				</div>
				{#if progress}
					<div class="h-[3px] rounded-full overflow-hidden" style="background: var(--bar-track);">
						<div
							class="h-full rounded-full transition-[width] duration-300"
							style="width: {(progress.done / progress.total) * 100}%; background: var(--accent);"
						></div>
					</div>
				{:else}
					<div class="h-[3px] rounded-full overflow-hidden" style="background: var(--bar-track);">
						<div
							class="h-full w-1/3 rounded-full animate-pulse"
							style="background: var(--accent);"
						></div>
					</div>
				{/if}
			</div>
		{:else if status === 'error'}
			<p class="font-mono text-[12px]" style="color: #e05c5c;">{msg}</p>
		{/if}

		<!-- import button -->
		{#if status !== 'loading'}
			<button
				class="h-[44px] rounded-[10px] font-medium text-[14px] tracking-[-0.01em] transition-opacity disabled:opacity-40"
				style="background: var(--accent); color: var(--bg);"
				disabled={!file}
				onclick={run}>Import data</button
			>
		{/if}
	</div>
</div>
