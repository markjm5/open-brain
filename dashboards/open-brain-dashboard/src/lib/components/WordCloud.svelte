<script lang="ts">
	// @ts-ignore - d3-cloud has no bundled types
	import cloud from 'd3-cloud';
	import type { Thought, ThoughtType } from '$lib/types';
	import { THOUGHT_TYPES } from '$lib/types';
	import { onMount } from 'svelte';

	let { thoughts = [] }: { thoughts: Thought[] } = $props();

	// ── Type filter ───────────────────────────────────────────────────────
	let activeType = $state<ThoughtType | null>(null);

	let filteredThoughts = $derived(
		activeType ? thoughts.filter((t) => t.metadata.type === activeType) : thoughts
	);

	// ── Colors ────────────────────────────────────────────────────────────
	const TYPE_COLOR: Record<ThoughtType, string> = {
		observation: '#6366f1',
		task: '#f59e0b',
		idea: '#22d3ee',
		reference: '#a855f7',
		person_note: '#ec4899'
	};

	const MUTED_PALETTE = [
		'#6366f1', '#f59e0b', '#22d3ee', '#a855f7', '#ec4899',
		'#34d399', '#f87171', '#60a5fa', '#fbbf24', '#a78bfa'
	];

	// ── Stop words ────────────────────────────────────────────────────────
	const STOP_WORDS = new Set([
		'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'been',
		'will', 'would', 'could', 'should', 'about', 'into', 'their', 'there',
		'when', 'what', 'which', 'where', 'your', 'also', 'some', 'than',
		'then', 'them', 'they', 'were', 'more', 'just', 'like', 'over',
		'such', 'very', 'each', 'much', 'only', 'need', 'make', 'made',
		'time', 'work', 'used', 'using', 'going', 'look', 'well', 'even',
		'back', 'after', 'know', 'most', 'may', 'want', 'here', 'take',
		'come', 'been', 'good', 'keep', 'find', 'give', 'way', 'our',
		'help', 'how', 'not', 'out', 'can', 'has', 'had', 'his', 'her',
		'all', 'any', 'are', 'but', 'per', 'one', 'two', 'new', 'get',
		'its', 'now', 'see', 'set', 'use', 'was', 'who', 'got', 'let',
		'put', 'too', 'add', 'ask', 'run', 'add', 'did', 'via', 'yet',
		'does', 'dont', 'isnt', 'cant', 'wont', 'didnt', 'hasnt', 'havent',
		'ive', 'youre', 'were', 'theyre', 'its', 'thats', 'dont', 'weve',
		'heres', 'theres', 'whats', 'okay', 'sure', 'really', 'still', 'think'
	]);

	// ── Word processing ───────────────────────────────────────────────────
	interface WordData {
		text: string;
		size: number;
		color: string;
		count: number;
		types: Partial<Record<ThoughtType, number>>;
	}

	function processWords(source: Thought[]): WordData[] {
		const freq = new Map<string, { count: number; types: Partial<Record<ThoughtType, number>> }>();

		for (const thought of source) {
			const type = thought.metadata.type ?? 'observation';
			const raw = thought.content
				.toLowerCase()
				.replace(/https?:\/\/\S+/g, ' ')
				.replace(/[^a-z0-9'\s-]/g, ' ')
				.replace(/'/g, '')
				.split(/[\s\-]+/);

			for (const w of raw) {
				const word = w.replace(/^'+|'+$/g, '').trim();
				if (word.length < 4 || STOP_WORDS.has(word) || /^\d+$/.test(word)) continue;

				if (!freq.has(word)) freq.set(word, { count: 0, types: {} });
				const entry = freq.get(word)!;
				entry.count++;
				entry.types[type] = (entry.types[type] ?? 0) + 1;
			}
		}

		const sorted = Array.from(freq.entries())
			.sort((a, b) => b[1].count - a[1].count)
			.slice(0, 160);

		if (!sorted.length) return [];

		const maxCount = sorted[0][1].count;
		const minCount = sorted[sorted.length - 1][1].count;

		return sorted.map(([text, { count, types }], i) => {
			// Dominant type → color
			const dominant = (Object.entries(types).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'observation') as ThoughtType;
			// Scale 14–72px, using sqrt to soften the range
			const t = maxCount === minCount ? 0.5 : (count - minCount) / (maxCount - minCount);
			const size = Math.round(14 + Math.sqrt(t) * 58);

			return {
				text,
				size,
				color: activeType ? TYPE_COLOR[activeType] ?? MUTED_PALETTE[i % MUTED_PALETTE.length] : TYPE_COLOR[dominant],
				count,
				types
			};
		});
	}

	// ── Layout state ──────────────────────────────────────────────────────
	interface PlacedWord {
		text: string;
		size: number;
		x: number;
		y: number;
		rotate: number;
		color: string;
		count: number;
		types: Partial<Record<ThoughtType, number>>;
	}

	let containerEl: HTMLDivElement | undefined = $state();
	let svgWidth = $state(900);
	const svgHeight = 500;

	let placedWords = $state<PlacedWord[]>([]);
	let generating = $state(false);
	let seed = $state(0); // bump to force re-layout

	// Tooltip
	let tooltip = $state<{ word: PlacedWord; x: number; y: number } | null>(null);

	function buildCloud(source: Thought[], w: number) {
		generating = true;
		placedWords = [];

		const wordData = processWords(source);
		if (!wordData.length) {
			generating = false;
			return;
		}

		// Seeded-ish rotate: mostly horizontal, occasionally ±90°
		const rng = mulberry32(seed);
		const rotate = () => (rng() > 0.75 ? (rng() > 0.5 ? 90 : -90) : 0);

		cloud()
			.size([w, svgHeight])
			.words(wordData.map((d) => ({ ...d })))
			.padding(5)
			.rotate(rotate)
			.font('Inter, ui-sans-serif, system-ui, sans-serif')
			.fontWeight((d: WordData) => (d.size > 40 ? '700' : d.size > 24 ? '600' : '400'))
			.fontSize((d: WordData) => d.size)
			.on('end', (laid: PlacedWord[]) => {
				placedWords = laid;
				generating = false;
			})
			.start();
	}

	// Simple seeded PRNG so re-layout with same seed gives same result
	function mulberry32(seed: number) {
		let s = seed | 0;
		return () => {
			s = (s + 0x6d2b79f5) | 0;
			let t = Math.imul(s ^ (s >>> 15), 1 | s);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
		};
	}

	// Re-run whenever filtered thoughts or width change
	$effect(() => {
		const src = filteredThoughts;
		const w = svgWidth;
		const _seed = seed; // track seed changes too
		if (src.length > 0 && w > 0) {
			buildCloud(src, w);
		}
	});

	// Observe container width
	onMount(() => {
		if (!containerEl) return;
		const ro = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect.width;
			if (w && Math.abs(w - svgWidth) > 20) svgWidth = Math.floor(w);
		});
		ro.observe(containerEl);
		svgWidth = containerEl.clientWidth || 900;
		return () => ro.disconnect();
	});

	function handleWordHover(e: MouseEvent, word: PlacedWord) {
		tooltip = { word, x: e.offsetX, y: e.offsetY };
	}

	function clearTooltip() {
		tooltip = null;
	}

	function typeLabel(t: ThoughtType): string {
		return THOUGHT_TYPES.find((x) => x.value === t)?.label ?? t;
	}
</script>

<div class="select-none">
	<!-- ── Toolbar ────────────────────────────────────────────────────── -->
	<div class="mb-5 flex items-center justify-between flex-wrap gap-3">
		<!-- Type filter pills -->
		<div class="flex flex-wrap gap-2">
			<button
				onclick={() => (activeType = null)}
				class="px-3 py-1.5 rounded-full text-sm font-medium transition-all
					{!activeType ? 'bg-primary text-white' : 'bg-bg-elevated text-text-muted hover:text-text'}"
			>
				All types
			</button>
			{#each THOUGHT_TYPES as t}
				<button
					onclick={() => (activeType = activeType === t.value ? null : t.value)}
					class="px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5"
					style={activeType === t.value
						? `background:${TYPE_COLOR[t.value]}22; color:${TYPE_COLOR[t.value]}; outline:1px solid ${TYPE_COLOR[t.value]}66`
						: ''}
					class:bg-bg-elevated={activeType !== t.value}
					class:text-text-muted={activeType !== t.value}
				>
					<span
						class="w-2 h-2 rounded-full"
						style="background:{TYPE_COLOR[t.value]}"
					></span>
					{t.label}
				</button>
			{/each}
		</div>

		<div class="flex items-center gap-3">
			<span class="text-xs text-text-muted">
				{filteredThoughts.length} thoughts · {placedWords.length} words
			</span>
			<button
				onclick={() => seed++}
				class="flex items-center gap-1.5 px-3 py-1.5 bg-bg-elevated hover:bg-white/10 text-text-muted hover:text-text rounded-lg text-sm font-medium transition-colors"
				title="Shuffle layout"
			>
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
				</svg>
				Shuffle
			</button>
		</div>
	</div>

	<!-- ── Cloud canvas ───────────────────────────────────────────────── -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={containerEl}
		class="relative w-full bg-bg-card border border-white/5 rounded-2xl overflow-hidden"
		style="height:{svgHeight}px"
		onmouseleave={clearTooltip}
	>
		{#if generating || (filteredThoughts.length > 0 && placedWords.length === 0)}
			<div class="absolute inset-0 flex flex-col items-center justify-center gap-3">
				<div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
				<div class="text-text-muted text-sm">Generating word cloud…</div>
			</div>
		{:else if filteredThoughts.length === 0}
			<div class="absolute inset-0 flex flex-col items-center justify-center gap-2">
				<div class="text-4xl">🧠</div>
				<div class="text-text-muted text-sm">No thoughts to visualize</div>
			</div>
		{:else if placedWords.length === 0}
			<div class="absolute inset-0 flex flex-col items-center justify-center gap-2">
				<div class="text-4xl">📭</div>
				<div class="text-text-muted text-sm">Not enough unique words to generate a cloud</div>
			</div>
		{:else}
			<svg
				width={svgWidth}
				height={svgHeight}
				class="w-full"
				role="img"
				aria-label="Word cloud of captured thoughts"
			>
				<g transform="translate({svgWidth / 2},{svgHeight / 2})">
					{#each placedWords as word}
						<!-- svelte-ignore a11y_mouse_events_have_key_events -->
						<text
							text-anchor="middle"
							transform="translate({word.x},{word.y}) rotate({word.rotate})"
							style="font-size:{word.size}px; fill:{word.color}; font-family:Inter,ui-sans-serif,system-ui,sans-serif; font-weight:{word.size > 40 ? 700 : word.size > 24 ? 600 : 400}; cursor:pointer; transition:opacity 0.15s"
							onmouseover={(e) => handleWordHover(e, word)}
							onmouseout={clearTooltip}
						>
							{word.text}
						</text>
					{/each}
				</g>
			</svg>

			<!-- Tooltip -->
			{#if tooltip}
				<div
					class="absolute z-10 pointer-events-none px-3 py-2.5 bg-bg-elevated border border-white/10 rounded-xl shadow-xl text-sm min-w-36"
					style="left:{Math.min(tooltip.x + 12, svgWidth - 160)}px; top:{Math.max(tooltip.y - 60, 8)}px"
				>
					<div class="font-semibold text-text mb-1.5">"{tooltip.word.text}"</div>
					<div class="text-text-muted text-xs mb-1.5">
						{tooltip.word.count} mention{tooltip.word.count !== 1 ? 's' : ''}
					</div>
					<div class="space-y-0.5">
						{#each Object.entries(tooltip.word.types).sort((a, b) => b[1] - a[1]) as [type, count]}
							<div class="flex items-center gap-1.5 text-xs">
								<span
									class="w-1.5 h-1.5 rounded-full shrink-0"
									style="background:{TYPE_COLOR[type as ThoughtType]}"
								></span>
								<span style="color:{TYPE_COLOR[type as ThoughtType]}">{typeLabel(type as ThoughtType)}</span>
								<span class="text-text-muted ml-auto">{count}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<!-- ── Legend ─────────────────────────────────────────────────────── -->
	<div class="mt-4 flex items-center justify-center gap-5 flex-wrap">
		{#each THOUGHT_TYPES as t}
			<span class="flex items-center gap-1.5 text-xs text-text-muted">
				<span class="w-2 h-2 rounded-full" style="background:{TYPE_COLOR[t.value]}"></span>
				{t.label}
			</span>
		{/each}
		<span class="text-xs text-text-muted/40">· word size = frequency</span>
	</div>
</div>
