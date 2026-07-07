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
	type SimNode = GraphNode & { x: number; y: number; z: number; vx: number; vy: number; vz: number };
	type SimLink = { source: SimNode; target: SimNode; weight: number };

	let simNodes: SimNode[] = [];
	let simLinks: SimLink[] = [];

	// interaction state
	let hoveredNode: SimNode | null = null;
	let dragNode: SimNode | null = null;
	let isPanning = false;
	let panStart = { x: 0, y: 0 };
	let mouseDownPos = { x: 0, y: 0 };
	let camera = { x: 0, y: 0, zoom: 1 };

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
		const size = Math.min(w, h);

		simNodes = graphData.nodes.map((n) => {
			// Distribute nodes randomly inside a 3D sphere
			const radius = Math.random() * size * 0.25;
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(Math.random() * 2 - 1);
			const sn: SimNode = {
				...n,
				x: radius * Math.sin(phi) * Math.cos(theta),
				y: radius * Math.sin(phi) * Math.sin(theta),
				z: radius * Math.cos(phi),
				vx: 0,
				vy: 0,
				vz: 0
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
	const REPULSION = 1800;
	const ATTRACTION = 0.008;
	const CENTER_GRAVITY = 0.006;
	const DAMPING = 0.88;
	const MIN_DIST = 20;
	let alpha = 1;

	const FOCAL_LENGTH = 450;

	function rotateY(node: SimNode, angle: number) {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const nx = node.x * cos - node.z * sin;
		const nz = node.x * sin + node.z * cos;
		node.x = nx;
		node.z = nz;
		const nvx = node.vx * cos - node.vz * sin;
		const nvz = node.vx * sin + node.vz * cos;
		node.vx = nvx;
		node.vz = nvz;
	}

	function rotateX(node: SimNode, angle: number) {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const ny = node.y * cos - node.z * sin;
		const nz = node.y * sin + node.z * cos;
		node.y = ny;
		node.z = nz;
		const nvy = node.vy * cos - node.vz * sin;
		const nvz = node.vy * sin + node.vz * cos;
		node.vy = nvy;
		node.vz = nvz;
	}

	function tick() {
		if (alpha < 0.001) alpha = 0.001;

		// repulsion (3D)
		for (let i = 0; i < simNodes.length; i++) {
			for (let j = i + 1; j < simNodes.length; j++) {
				const a = simNodes[i];
				const b = simNodes[j];
				let dx = b.x - a.x;
				let dy = b.y - a.y;
				let dz = b.z - a.z;
				let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
				if (dist < MIN_DIST) dist = MIN_DIST;
				const force = (REPULSION * alpha) / (dist * dist);
				const fx = (dx / dist) * force;
				const fy = (dy / dist) * force;
				const fz = (dz / dist) * force;
				a.vx -= fx;
				a.vy -= fy;
				a.vz -= fz;
				b.vx += fx;
				b.vy += fy;
				b.vz += fz;
			}
		}

		// attraction (3D)
		for (const link of simLinks) {
			const dx = link.target.x - link.source.x;
			const dy = link.target.y - link.source.y;
			const dz = link.target.z - link.source.z;
			const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
			const force = dist * ATTRACTION * alpha * Math.min(link.weight, 5);
			const fx = (dx / dist) * force;
			const fy = (dy / dist) * force;
			const fz = (dz / dist) * force;
			link.source.vx += fx;
			link.source.vy += fy;
			link.source.vz += fz;
			link.target.vx -= fx;
			link.target.vy -= fy;
			link.target.vz -= fz;
		}

		// centering gravity (3D)
		for (const n of simNodes) {
			n.vx -= n.x * CENTER_GRAVITY * alpha;
			n.vy -= n.y * CENTER_GRAVITY * alpha;
			n.vz -= n.z * CENTER_GRAVITY * alpha;
		}

		// passive auto-rotation (drifting) when not interacting
		if (!dragNode && !isPanning) {
			for (const n of simNodes) {
				rotateY(n, 0.0006);
				rotateX(n, 0.0002);
			}
		}

		// integrate (3D)
		for (const n of simNodes) {
			if (n === dragNode) continue;
			n.vx *= DAMPING;
			n.vy *= DAMPING;
			n.vz *= DAMPING;
			n.x += n.vx;
			n.y += n.vy;
			n.z += n.vz;
		}
	}

	// Project 3D point to screen space
	function project(n: SimNode) {
		const cx = n.x + camera.x;
		const cy = n.y + camera.y;
		const cz = Math.max(-FOCAL_LENGTH + 50, n.z);
		const scale = FOCAL_LENGTH / (FOCAL_LENGTH + cz);
		
		const px = cx * scale * camera.zoom;
		const py = cy * scale * camera.zoom;
		
		return { px, py, scale };
	}

	function render() {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const w = canvas.width;
		const h = canvas.height;
		const dpr = window.devicePixelRatio || 1;

		ctx.clearRect(0, 0, w, h);

		ctx.save();
		// Center origin in the viewport
		ctx.translate(w / 2, h / 2);

		const activeAccent = accentColor;

		// Calculate max weight for link width scaling
		let maxWeight = 1;
		for (const link of simLinks) {
			if (link.weight > maxWeight) maxWeight = link.weight;
		}

		// 1. Draw links (edges)
		for (const link of simLinks) {
			const isHighlighted =
				hoveredNode && (link.source === hoveredNode || link.target === hoveredNode);
			
			const srcProj = project(link.source);
			const tgtProj = project(link.target);

			const avgZ = (link.source.z + link.target.z) / 2;
			const depthScale = FOCAL_LENGTH / (FOCAL_LENGTH + Math.max(-FOCAL_LENGTH + 50, avgZ));

			let opacity = 0.16;
			if (hoveredNode) {
				opacity = isHighlighted ? 0.8 : 0.03;
			} else {
				opacity = 0.14 + (link.weight / maxWeight) * 0.12;
			}

			// scale link opacity based on average depth
			opacity *= Math.max(0.1, depthScale);

			ctx.beginPath();
			ctx.moveTo(srcProj.px * dpr, srcProj.py * dpr);
			ctx.lineTo(tgtProj.px * dpr, tgtProj.py * dpr);

			ctx.strokeStyle = isHighlighted ? activeAccent : colors.textDim;
			ctx.globalAlpha = opacity;
			ctx.lineWidth = (isHighlighted 
				? 1.5 
				: (0.5 + (link.weight / maxWeight) * 0.7)) * depthScale * dpr;
			ctx.stroke();
		}

		// Project all nodes and z-sort (painter's algorithm)
		const projectedNodes = simNodes.map((n) => {
			const proj = project(n);
			return {
				node: n,
				px: proj.px * dpr,
				py: proj.py * dpr,
				scale: proj.scale,
				z: n.z
			};
		});

		// Sort by z depth descending (draw furthest first, closest last)
		projectedNodes.sort((a, b) => b.z - a.z);

		// 2. Draw nodes
		for (const item of projectedNodes) {
			const { node, px, py, scale } = item;
			const isHovered = node === hoveredNode;
			const isNeighbor = hoveredNode && isConnected(hoveredNode, node);
			const isFaded = hoveredNode && !isHovered && !isNeighbor;

			const radius = node.size * scale * dpr;

			ctx.beginPath();
			ctx.arc(px, py, radius, 0, Math.PI * 2);

			let opacity = 1.0;
			if (isHovered) {
				ctx.fillStyle = activeAccent;
				opacity = 1.0;
			} else if (isNeighbor) {
				ctx.fillStyle = colors.text;
				opacity = 1.0;
			} else if (isFaded) {
				ctx.fillStyle = colors.textDim;
				opacity = 0.08;
			} else {
				ctx.fillStyle = colors.textMuted;
				// scale opacity based on depth
				opacity = 0.65 * Math.max(0.15, scale);
			}

			ctx.globalAlpha = opacity;
			ctx.fill();

			// Subtly outline nodes for a sharper look
			if (!isFaded) {
				ctx.beginPath();
				ctx.arc(px, py, radius, 0, Math.PI * 2);
				ctx.strokeStyle = isHovered ? activeAccent : (isNeighbor ? colors.text : colors.bgCard);
				ctx.lineWidth = 1 * dpr;
				ctx.globalAlpha = (isHovered || isNeighbor ? 0.5 : 0.2) * opacity;
				ctx.stroke();
			}

			// Soft glow for hovered node
			if (isHovered) {
				ctx.shadowColor = activeAccent;
				ctx.shadowBlur = 15 * dpr;
				ctx.beginPath();
				ctx.arc(px, py, radius, 0, Math.PI * 2);
				ctx.fill();
				ctx.shadowColor = 'transparent';
				ctx.shadowBlur = 0;
			}
		}

		ctx.globalAlpha = 1;

		// 3. Draw labels on top of all nodes
		// --- Ambient hub labels (always visible, spatially deduplicated) ---
		// Pick the top nodes by degree (number of neighbors) to label
		const HUB_LABEL_COUNT = 12;
		const GRID_CELL_PX = 160 * dpr; // minimum distance between ambient labels
		const occupiedCells = new Set<string>();

		// Sort projected nodes by degree descending for label priority
		const byDegree = [...projectedNodes].sort(
			(a, b) => (adjMap.get(b.node)?.size ?? 0) - (adjMap.get(a.node)?.size ?? 0)
		);

		let hubsLabeled = 0;
		const hubLabelSet = new Set<SimNode>();

		for (const item of byDegree) {
			if (hubsLabeled >= HUB_LABEL_COUNT) break;
			if (adjMap.get(item.node)?.size === 0) break; // skip isolated
			const cellX = Math.round(item.px / GRID_CELL_PX);
			const cellY = Math.round(item.py / GRID_CELL_PX);
			const cellKey = `${cellX},${cellY}`;
			if (occupiedCells.has(cellKey)) continue;
			occupiedCells.add(cellKey);
			hubLabelSet.add(item.node);
			hubsLabeled++;
		}

		for (const item of projectedNodes) {
			const { node, px, py, scale } = item;
			const isHovered = node === hoveredNode;
			const isNeighbor = hoveredNode && isConnected(hoveredNode, node);
			const isFaded = hoveredNode && !isHovered && !isNeighbor;

			if (isFaded) continue;

			const showHoverLabel = hoveredNode && (isHovered || isNeighbor);
			const showAmbientLabel = !hoveredNode && hubLabelSet.has(node);

			if (showHoverLabel || showAmbientLabel) {
				const radius = node.size * scale * dpr;
				const fontSize = isHovered
					? Math.max(10, 11 * scale) * dpr
					: Math.max(9, 9.5 * scale) * dpr;
				ctx.font = isHovered
					? `600 ${fontSize}px ${colors.fontBody}`
					: `400 ${fontSize}px ${colors.fontBody}`;

				ctx.textAlign = 'center';
				ctx.textBaseline = 'top';

				const labelY = py + radius + 5 * dpr;

				if (showAmbientLabel && !isHovered) {
					// Subtle pill background for ambient labels
					const metrics = ctx.measureText(node.label);
					const tw = metrics.width;
					const th = fontSize;
					const pad = 3 * dpr;
					ctx.globalAlpha = 0.45;
					ctx.fillStyle = colors.bg;
					const rx = px - tw / 2 - pad;
					const ry = labelY - pad * 0.5;
					const rw = tw + pad * 2;
					const rh = th + pad;
					ctx.beginPath();
					ctx.roundRect(rx, ry, rw, rh, 3 * dpr);
					ctx.fill();
				}

				ctx.fillStyle = isHovered ? colors.text : (isNeighbor ? colors.textMuted : colors.textDim);
				ctx.globalAlpha = isHovered ? 1 : (isNeighbor ? 0.75 : 0.6);
				ctx.fillText(node.label, px, labelY);
				ctx.globalAlpha = 1;
			}
		}

		ctx.restore();
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

	function findNodeAtScreen(sx: number, sy: number): SimNode | null {
		if (!canvas) return null;
		const w = canvas.width;
		const h = canvas.height;
		const dpr = window.devicePixelRatio || 1;

		// Sort nodes by z ascending (closest / largest scale first)
		const sorted = [...simNodes].sort((a, b) => a.z - b.z);

		for (const n of sorted) {
			const cx = n.x + camera.x;
			const cy = n.y + camera.y;
			const cz = Math.max(-FOCAL_LENGTH + 50, n.z);
			const scale = FOCAL_LENGTH / (FOCAL_LENGTH + cz);

			// Projected coordinates on screen relative to canvas center
			const px = (w / 2) + cx * scale * camera.zoom * dpr;
			const py = (h / 2) + cy * scale * camera.zoom * dpr;

			const radius = n.size * scale * camera.zoom * dpr;
			const hitRadius = Math.max(radius + 8 * dpr, 12 * dpr); // min hit area

			const dx = sx - px;
			const dy = sy - py;
			if (dx * dx + dy * dy <= hitRadius * hitRadius) {
				return n;
			}
		}
		return null;
	}

	function onMouseMove(e: MouseEvent) {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		const sx = (e.clientX - rect.left) * dpr;
		const sy = (e.clientY - rect.top) * dpr;

		if (dragNode) {
			const scale = FOCAL_LENGTH / (FOCAL_LENGTH + Math.max(-FOCAL_LENGTH + 50, dragNode.z));
			// Back-project screen coordinates to 3D space coordinates relative to camera
			const targetX = (sx - canvas.width / 2) / (scale * camera.zoom * dpr) - camera.x;
			const targetY = (sy - canvas.height / 2) / (scale * camera.zoom * dpr) - camera.y;
			
			dragNode.x = targetX;
			dragNode.y = targetY;
			dragNode.vx = 0;
			dragNode.vy = 0;
			dragNode.vz = 0;
			alpha = Math.max(alpha, 0.3);
			return;
		}

		if (isPanning) {
			const dx = e.clientX - panStart.x;
			const dy = e.clientY - panStart.y;

			if (e.shiftKey) {
				// Shift+drag pans the camera in 3D
				camera.x += dx / (camera.zoom * dpr);
				camera.y += dy / (camera.zoom * dpr);
			} else {
				// Normal drag rotates the 3D graph (yaw and pitch)
				const sensitivity = 0.004;
				const angleY = dx * sensitivity;
				const angleX = dy * sensitivity;

				for (const n of simNodes) {
					rotateY(n, angleY);
					rotateX(n, angleX);
				}
			}

			panStart = { x: e.clientX, y: e.clientY };
			return;
		}

		const hit = findNodeAtScreen(sx, sy);
		hoveredNode = hit;
		canvas.style.cursor = hit ? 'pointer' : 'grab';
	}

	function onMouseDown(e: MouseEvent) {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		const sx = (e.clientX - rect.left) * dpr;
		const sy = (e.clientY - rect.top) * dpr;

		mouseDownPos = { x: e.clientX, y: e.clientY };

		const hit = findNodeAtScreen(sx, sy);
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
			// Click detection based on screen travel
			const dx = e.clientX - mouseDownPos.x;
			const dy = e.clientY - mouseDownPos.y;
			if (dx * dx + dy * dy < 25) {
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
