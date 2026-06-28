<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import type { GraphData, GraphNode, GraphLink } from '$lib/stats/graph';

	type Props = {
		data: GraphData;
		accentColor?: string;
	};

	let { data, accentColor = 'var(--accent)' }: Props = $props();

	let canvas: HTMLCanvasElement;
	let container: HTMLDivElement;
	let animId: number;
	let mounted = false;

	// simulation state
	type SimNode = GraphNode & { x: number; y: number; vx: number; vy: number };
	type SimLink = { source: SimNode; target: SimNode; weight: number };

	let simNodes: SimNode[] = [];
	let simLinks: SimLink[] = [];

	// interaction state
	let hoveredNode: SimNode | null = null;
	let dragNode: SimNode | null = null;
	let isPanning = false;
	let panStart = { x: 0, y: 0 };
	let camera = { x: 0, y: 0, zoom: 1 };
	let mouseCanvas = { x: 0, y: 0 };

	// resolved CSS colors (read once from computed style)
	let colors = {
		bg: '#14181c',
		bgCard: '#181e24',
		text: '#e9eef2',
		textMuted: '#8b9aa8',
		textDim: '#5f6e7b',
		border: 'rgba(255,255,255,0.075)',
		accent: '#44d07b',
		accentAmber: '#f2a73c',
		accentBlue: '#54b8e8',
		fontBody: "'Schibsted Grotesk', sans-serif"
	};

	function resolveColors() {
		if (!canvas) return;
		const cs = getComputedStyle(document.documentElement);
		colors.bg = cs.getPropertyValue('--bg').trim() || colors.bg;
		colors.bgCard = cs.getPropertyValue('--bg-card').trim() || colors.bgCard;
		colors.text = cs.getPropertyValue('--text').trim() || colors.text;
		colors.textMuted = cs.getPropertyValue('--text-muted').trim() || colors.textMuted;
		colors.textDim = cs.getPropertyValue('--text-dim').trim() || colors.textDim;
		colors.accent = cs.getPropertyValue('--accent').trim() || colors.accent;
		colors.accentAmber = cs.getPropertyValue('--accent-amber').trim() || colors.accentAmber;
		colors.accentBlue = cs.getPropertyValue('--accent-blue').trim() || colors.accentBlue;
		colors.fontBody = cs.getPropertyValue('--font-body').trim() || colors.fontBody;
	}

	function initSimulation(graphData: GraphData) {
		const nodeMap = new Map<string, SimNode>();
		const w = canvas?.width ?? 800;
		const h = canvas?.height ?? 600;

		simNodes = graphData.nodes.map((n) => {
			const sn: SimNode = {
				...n,
				x: (Math.random() - 0.5) * w * 0.6,
				y: (Math.random() - 0.5) * h * 0.6,
				vx: 0,
				vy: 0
			};
			nodeMap.set(n.id, sn);
			return sn;
		});

		simLinks = [];
		for (const l of graphData.links) {
			const src = nodeMap.get(l.source);
			const tgt = nodeMap.get(l.target);
			if (src && tgt) {
				simLinks.push({ source: src, target: tgt, weight: l.weight });
			}
		}

		// build adjacency for layout
		adjMap.clear();
		for (const link of simLinks) {
			if (!adjMap.has(link.source)) adjMap.set(link.source, new Set());
			if (!adjMap.has(link.target)) adjMap.set(link.target, new Set());
			adjMap.get(link.source)!.add(link.target);
			adjMap.get(link.target)!.add(link.source);
		}

		camera = { x: 0, y: 0, zoom: 1 };
		hoveredNode = null;
		dragNode = null;
	}

	const adjMap = new Map<SimNode, Set<SimNode>>();

	function isConnected(a: SimNode, b: SimNode): boolean {
		return adjMap.get(a)?.has(b) ?? false;
	}

	// Physics
	const REPULSION = 2500;
	const ATTRACTION = 0.006;
	const CENTER_GRAVITY = 0.005;
	const DAMPING = 0.88;
	const MIN_DIST = 20;
	const ALPHA_DECAY = 0.998;
	let alpha = 1;

	function tick() {
		if (alpha < 0.001) alpha = 0.001;

		// repulsion (Barnes-Hut would be ideal but brute force is fine for ≤200 nodes)
		for (let i = 0; i < simNodes.length; i++) {
			for (let j = i + 1; j < simNodes.length; j++) {
				const a = simNodes[i];
				const b = simNodes[j];
				let dx = b.x - a.x;
				let dy = b.y - a.y;
				let dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < MIN_DIST) dist = MIN_DIST;
				const force = (REPULSION * alpha) / (dist * dist);
				const fx = (dx / dist) * force;
				const fy = (dy / dist) * force;
				a.vx -= fx;
				a.vy -= fy;
				b.vx += fx;
				b.vy += fy;
			}
		}

		// attraction along links
		for (const link of simLinks) {
			const dx = link.target.x - link.source.x;
			const dy = link.target.y - link.source.y;
			const dist = Math.sqrt(dx * dx + dy * dy) || 1;
			const force = dist * ATTRACTION * alpha * Math.min(link.weight, 5);
			const fx = (dx / dist) * force;
			const fy = (dy / dist) * force;
			link.source.vx += fx;
			link.source.vy += fy;
			link.target.vx -= fx;
			link.target.vy -= fy;
		}

		// centering
		for (const n of simNodes) {
			n.vx -= n.x * CENTER_GRAVITY * alpha;
			n.vy -= n.y * CENTER_GRAVITY * alpha;
		}

		// integrate
		for (const n of simNodes) {
			if (n === dragNode) continue;
			n.vx *= DAMPING;
			n.vy *= DAMPING;
			n.x += n.vx;
			n.y += n.vy;
		}

		alpha *= ALPHA_DECAY;
	}

	// Helper to resolve CSS variables dynamically
	function resolveColorString(col: string): string {
		if (!col) return colors.accent;
		if (col.startsWith('var(')) {
			const varName = col.slice(4, -1).trim();
			if (typeof document !== 'undefined') {
				const cs = getComputedStyle(document.documentElement);
				return cs.getPropertyValue(varName).trim() || colors.accent;
			}
		}
		return col;
	}

	const currentAccent = $derived(resolveColorString(accentColor));

	// Rendering
	function render() {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const w = canvas.width;
		const h = canvas.height;
		const dpr = window.devicePixelRatio || 1;

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, w, h);

		// apply camera
		ctx.translate(w / 2, h / 2);
		ctx.scale(camera.zoom * dpr, camera.zoom * dpr);
		ctx.translate(camera.x, camera.y);

		const maxWeight = Math.max(...simLinks.map((l) => l.weight), 1);
		const activeAccent = currentAccent;

		// 1. Draw links (edges)
		for (const link of simLinks) {
			const isHighlighted =
				hoveredNode && (link.source === hoveredNode || link.target === hoveredNode);
			
			// Obsidian link opacities: extremely subtle by default, highlighted on hover, faded otherwise
			let opacity = 0.16;
			if (hoveredNode) {
				opacity = isHighlighted ? 0.8 : 0.03;
			} else {
				// slightly scale opacity based on connection weight
				opacity = 0.14 + (link.weight / maxWeight) * 0.12;
			}

			ctx.beginPath();
			ctx.moveTo(link.source.x, link.source.y);
			ctx.lineTo(link.target.x, link.target.y);
			
			ctx.strokeStyle = isHighlighted ? activeAccent : colors.textDim;
			ctx.globalAlpha = opacity;
			ctx.lineWidth = isHighlighted 
				? 1.5 / camera.zoom 
				: (0.5 + (link.weight / maxWeight) * 0.7) / camera.zoom;
			ctx.stroke();
		}

		ctx.globalAlpha = 1;

		// 2. Draw nodes
		for (const node of simNodes) {
			const isHovered = node === hoveredNode;
			const isNeighbor = hoveredNode && isConnected(hoveredNode, node);
			const isFaded = hoveredNode && !isHovered && !isNeighbor;

			const radius = node.size / camera.zoom;

			ctx.beginPath();
			ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

			if (isHovered) {
				ctx.fillStyle = activeAccent;
				ctx.globalAlpha = 1;
			} else if (isNeighbor) {
				// Neighbor nodes are highlighted with Svelte's text color (bright)
				ctx.fillStyle = colors.text;
				ctx.globalAlpha = 1;
			} else if (isFaded) {
				// Faded nodes are pushed way into the background
				ctx.fillStyle = colors.textDim;
				ctx.globalAlpha = 0.08;
			} else {
				// Default nodes are clean, minimalist monochromatic dots (Obsidian style)
				ctx.fillStyle = colors.textMuted;
				ctx.globalAlpha = 0.65;
			}

			ctx.fill();

			// Subtly outline nodes for a sharper look
			if (!isFaded) {
				ctx.beginPath();
				ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
				ctx.strokeStyle = isHovered ? activeAccent : (isNeighbor ? colors.text : colors.bgCard);
				ctx.lineWidth = 1 / camera.zoom;
				ctx.globalAlpha = isHovered || isNeighbor ? 0.5 : 0.2;
				ctx.stroke();
			}

			// Soft glow for hovered node
			if (isHovered) {
				ctx.shadowColor = activeAccent;
				ctx.shadowBlur = 15 / camera.zoom;
				ctx.beginPath();
				ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
				ctx.fill();
				ctx.shadowColor = 'transparent';
				ctx.shadowBlur = 0;
			}

			ctx.globalAlpha = 1;
		}

		// 3. Draw node labels on top of all nodes/links (Obsidian zoom/hover rules)
		for (const node of simNodes) {
			const isHovered = node === hoveredNode;
			const isNeighbor = hoveredNode && isConnected(hoveredNode, node);
			const isFaded = hoveredNode && !isHovered && !isNeighbor;

			if (isFaded) continue;

			// Visibility rule:
			// - If a node is hovered, show label for hovered node and its direct neighbors.
			// - Otherwise, do not show any labels (clean Obsidian look).
			const showLabel = hoveredNode && (isHovered || isNeighbor);

			if (showLabel) {
				const radius = node.size / camera.zoom;
				const fontSize = Math.max(10, 11 / camera.zoom);
				ctx.font = isHovered 
					? `600 ${fontSize}px ${colors.fontBody}`
					: `400 ${fontSize}px ${colors.fontBody}`;
				
				ctx.textAlign = 'center';
				ctx.textBaseline = 'top';


				// Fill text
				ctx.fillStyle = isHovered ? colors.text : colors.textMuted;
				ctx.globalAlpha = isHovered ? 1 : 0.75;
				ctx.fillText(node.label, node.x, node.y + radius + 5 / camera.zoom);
				ctx.globalAlpha = 1;
			}
		}
	}

	function loop() {
		tick();
		render();
		animId = requestAnimationFrame(loop);
	}

	function resize() {
		if (!container || !canvas) return;
		const dpr = window.devicePixelRatio || 1;
		const rect = container.getBoundingClientRect();
		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;
		canvas.style.width = rect.width + 'px';
		canvas.style.height = rect.height + 'px';
	}

	// world coords from mouse event
	function screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
		const rect = canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		const sx = (clientX - rect.left) * dpr;
		const sy = (clientY - rect.top) * dpr;
		const cx = canvas.width / 2;
		const cy = canvas.height / 2;
		const wx = (sx - cx) / (camera.zoom * dpr) - camera.x;
		const wy = (sy - cy) / (camera.zoom * dpr) - camera.y;
		return { x: wx, y: wy };
	}

	function findNodeAt(wx: number, wy: number): SimNode | null {
		// iterate in reverse so top-drawn nodes get priority
		for (let i = simNodes.length - 1; i >= 0; i--) {
			const n = simNodes[i];
			const r = (n.size / camera.zoom) + 4 / camera.zoom;
			const dx = wx - n.x;
			const dy = wy - n.y;
			if (dx * dx + dy * dy <= r * r) return n;
		}
		return null;
	}

	function onMouseMove(e: MouseEvent) {
		const w = screenToWorld(e.clientX, e.clientY);
		mouseCanvas = w;

		if (dragNode) {
			dragNode.x = w.x;
			dragNode.y = w.y;
			dragNode.vx = 0;
			dragNode.vy = 0;
			alpha = Math.max(alpha, 0.3);
			return;
		}

		if (isPanning) {
			const dpr = window.devicePixelRatio || 1;
			const dx = (e.clientX - panStart.x) / (camera.zoom * dpr);
			const dy = (e.clientY - panStart.y) / (camera.zoom * dpr);
			camera.x += dx;
			camera.y += dy;
			panStart = { x: e.clientX, y: e.clientY };
			return;
		}

		const hit = findNodeAt(w.x, w.y);
		hoveredNode = hit;
		canvas.style.cursor = hit ? 'pointer' : 'grab';
	}

	function onMouseDown(e: MouseEvent) {
		const w = screenToWorld(e.clientX, e.clientY);
		const hit = findNodeAt(w.x, w.y);
		if (hit) {
			dragNode = hit;
			alpha = Math.max(alpha, 0.3);
			canvas.style.cursor = 'grabbing';
		} else {
			isPanning = true;
			panStart = { x: e.clientX, y: e.clientY };
			canvas.style.cursor = 'grabbing';
		}
	}

	function onMouseUp(e: MouseEvent) {
		if (dragNode) {
			// if barely moved, treat as click
			const w = screenToWorld(e.clientX, e.clientY);
			const dx = w.x - dragNode.x;
			const dy = w.y - dragNode.y;
			if (dx * dx + dy * dy < 4) {
				goto(`${base}${dragNode.href}`);
			}
			dragNode = null;
		}
		isPanning = false;
		canvas.style.cursor = hoveredNode ? 'pointer' : 'grab';
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		const factor = e.deltaY > 0 ? 0.92 : 1.08;
		camera.zoom = Math.max(0.15, Math.min(6, camera.zoom * factor));
	}

	function onMouseLeave() {
		hoveredNode = null;
		dragNode = null;
		isPanning = false;
	}

	// Reactivity: reinitialize when data changes
	$effect(() => {
		if (mounted && data) {
			initSimulation(data);
			alpha = 1;
		}
	});

	onMount(() => {
		mounted = true;
		resolveColors();
		resize();
		initSimulation(data);
		loop();

		const ro = new ResizeObserver(() => {
			resize();
		});
		ro.observe(container);

		return () => {
			ro.disconnect();
		};
	});

	onDestroy(() => {
		if (animId) cancelAnimationFrame(animId);
	});
</script>

<div class="graph-container" bind:this={container}>
	<canvas
		bind:this={canvas}
		onmousemove={onMouseMove}
		onmousedown={onMouseDown}
		onmouseup={onMouseUp}
		onwheel={onWheel}
		onmouseleave={onMouseLeave}
	></canvas>

	<!-- tooltip -->
	{#if hoveredNode && !dragNode}
		{@const rect = canvas?.getBoundingClientRect()}
		{@const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1}
		{@const sx = (hoveredNode.x + camera.x) * camera.zoom * dpr + (canvas?.width ?? 0) / 2}
		{@const sy = (hoveredNode.y + camera.y) * camera.zoom * dpr + (canvas?.height ?? 0) / 2}
		<div
			class="tooltip"
			style="
				left: {sx / dpr + (rect?.left ?? 0) - (container?.getBoundingClientRect().left ?? 0)}px;
				top: {sy / dpr + (rect?.top ?? 0) - (container?.getBoundingClientRect().top ?? 0) - 42}px;
			"
		>
			<span class="tooltip-label">{hoveredNode.label}</span>
			{#if hoveredNode.meta}
				<span class="tooltip-meta">{hoveredNode.meta}</span>
			{/if}
		</div>
	{/if}

	<!-- zoom controls -->
	<div class="zoom-controls">
		<button
			class="zoom-btn"
			onclick={() => (camera.zoom = Math.min(6, camera.zoom * 1.3))}
			aria-label="Zoom in"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
			</svg>
		</button>
		<button
			class="zoom-btn"
			onclick={() => (camera.zoom = Math.max(0.15, camera.zoom * 0.7))}
			aria-label="Zoom out"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
		</button>
		<button
			class="zoom-btn"
			onclick={() => { camera = { x: 0, y: 0, zoom: 1 }; }}
			aria-label="Reset view"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.5" />
			</svg>
		</button>
	</div>
</div>

<style>
	.graph-container {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 500px;
		overflow: hidden;
		border-radius: 12px;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
		cursor: grab;
	}

	.tooltip {
		position: absolute;
		pointer-events: none;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 6px 12px;
		border-radius: 8px;
		background: var(--bg-card);
		border: 1px solid var(--border-2);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
		z-index: 20;
		white-space: nowrap;
	}

	.tooltip-label {
		font-family: var(--font-body), sans-serif;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--text);
	}

	.tooltip-meta {
		font-family: var(--font-mono), monospace;
		font-size: 10.5px;
		color: var(--text-muted);
	}

	.zoom-controls {
		position: absolute;
		bottom: 14px;
		right: 14px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		z-index: 10;
	}

	.zoom-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s;
	}

	.zoom-btn:hover {
		color: var(--text);
		background: color-mix(in oklab, var(--accent) 10%, var(--bg-card));
		border-color: color-mix(in oklab, var(--accent) 30%, var(--border));
	}
</style>
