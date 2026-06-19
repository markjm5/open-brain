<script lang="ts">
	import type { Thought, ThoughtType } from '$lib/types';
	import { THOUGHT_TYPES } from '$lib/types';

	let {
		thoughts = [],
		onSelectThought
	}: {
		thoughts: Thought[];
		onSelectThought: (t: Thought) => void;
	} = $props();

	type CalView = 'month' | 'week' | 'day';

	let view = $state<CalView>('month');
	let currentDate = $state(new Date());

	const TYPE_COLOR: Record<ThoughtType, string> = {
		observation: '#6366f1',
		task: '#f59e0b',
		idea: '#22d3ee',
		reference: '#a855f7',
		person_note: '#ec4899'
	};

	const MONTH_NAMES = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];
	const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	function isSameDay(a: Date, b: Date): boolean {
		return (
			a.getFullYear() === b.getFullYear() &&
			a.getMonth() === b.getMonth() &&
			a.getDate() === b.getDate()
		);
	}

	function isToday(d: Date): boolean {
		return isSameDay(d, new Date());
	}

	function isCurrentMonth(d: Date): boolean {
		return (
			d.getMonth() === currentDate.getMonth() &&
			d.getFullYear() === currentDate.getFullYear()
		);
	}

	function getThoughtsForDay(date: Date): Thought[] {
		return thoughts
			.filter((t) => isSameDay(new Date(t.created_at), date))
			.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
	}

	function getMonthGrid(): Date[] {
		const year = currentDate.getFullYear();
		const month = currentDate.getMonth();
		const firstDayOfWeek = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const days: Date[] = [];

		// Pad from previous month
		for (let i = firstDayOfWeek - 1; i >= 0; i--) {
			days.push(new Date(year, month, -i));
		}
		// Current month days
		for (let d = 1; d <= daysInMonth; d++) {
			days.push(new Date(year, month, d));
		}
		// Pad to fill 6 rows (42 cells)
		const remaining = 42 - days.length;
		for (let i = 1; i <= remaining; i++) {
			days.push(new Date(year, month + 1, i));
		}
		return days;
	}

	function getWeekDays(): Date[] {
		const dayOfWeek = currentDate.getDay();
		return Array.from({ length: 7 }, (_, i) => {
			const d = new Date(currentDate);
			d.setDate(currentDate.getDate() - dayOfWeek + i);
			return d;
		});
	}

	function prevPeriod() {
		const d = new Date(currentDate);
		if (view === 'month') d.setMonth(d.getMonth() - 1);
		else if (view === 'week') d.setDate(d.getDate() - 7);
		else d.setDate(d.getDate() - 1);
		currentDate = d;
	}

	function nextPeriod() {
		const d = new Date(currentDate);
		if (view === 'month') d.setMonth(d.getMonth() + 1);
		else if (view === 'week') d.setDate(d.getDate() + 7);
		else d.setDate(d.getDate() + 1);
		currentDate = d;
	}

	function goToday() {
		currentDate = new Date();
	}

	function openDay(date: Date) {
		currentDate = new Date(date);
		view = 'day';
	}

	function headerTitle(): string {
		if (view === 'month') {
			return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
		} else if (view === 'week') {
			const days = getWeekDays();
			const first = days[0];
			const last = days[6];
			if (first.getMonth() === last.getMonth()) {
				return `${MONTH_NAMES[first.getMonth()]} ${first.getDate()}–${last.getDate()}, ${first.getFullYear()}`;
			}
			return `${MONTH_NAMES[first.getMonth()]} ${first.getDate()} – ${MONTH_NAMES[last.getMonth()]} ${last.getDate()}, ${last.getFullYear()}`;
		} else {
			return `${DAY_NAMES_FULL[currentDate.getDay()]}, ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
		}
	}

	function formatTime(dateStr: string): string {
		return new Date(dateStr).toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	function truncate(text: string, len = 40): string {
		return text.length > len ? text.slice(0, len) + '…' : text;
	}

	function typeColor(type: ThoughtType | undefined): string {
		return TYPE_COLOR[type ?? 'observation'];
	}

	function typeLabel(type: ThoughtType | undefined): string {
		return THOUGHT_TYPES.find((t) => t.value === type)?.label ?? 'Thought';
	}

	// Stats for the header mini-legend: count per type in currently visible period
	let visibleStats = $derived.by(() => {
		let range: Date[] = [];
		if (view === 'month') range = getMonthGrid().filter((d) => isCurrentMonth(d));
		else if (view === 'week') range = getWeekDays();
		else range = [currentDate];

		const counts: Partial<Record<ThoughtType, number>> = {};
		for (const day of range) {
			for (const t of getThoughtsForDay(day)) {
				const type = t.metadata.type ?? 'observation';
				counts[type] = (counts[type] ?? 0) + 1;
			}
		}
		return counts;
	});
</script>

<!-- Calendar wrapper -->
<div class="select-none">
	<!-- ── Toolbar ─────────────────────────────────────────────────────── -->
	<div class="mb-5 flex flex-wrap items-center gap-3">
		<!-- View tabs -->
		<div class="flex items-center gap-1 bg-bg-elevated rounded-lg p-1 shrink-0">
			{#each (['month', 'week', 'day'] as const) as v}
				<button
					onclick={() => (view = v)}
					class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize
						{view === v ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text'}"
				>
					{v}
				</button>
			{/each}
		</div>

		<!-- Navigation -->
		<div class="flex items-center gap-2 flex-1 justify-center">
			<button
				onclick={prevPeriod}
				aria-label="Previous"
				class="w-8 h-8 flex items-center justify-center rounded-lg bg-bg-elevated hover:bg-white/10 text-text-muted hover:text-text transition-colors"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
			</button>
			<span class="text-text font-semibold min-w-64 text-center text-base">{headerTitle()}</span>
			<button
				onclick={nextPeriod}
				aria-label="Next"
				class="w-8 h-8 flex items-center justify-center rounded-lg bg-bg-elevated hover:bg-white/10 text-text-muted hover:text-text transition-colors"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</button>
			<button
				onclick={goToday}
				class="px-3 py-1.5 bg-bg-elevated hover:bg-white/10 text-text-muted hover:text-text rounded-lg text-sm font-medium transition-colors"
			>
				Today
			</button>
		</div>

		<!-- Period stats mini-legend -->
		<div class="flex items-center gap-3 shrink-0">
			{#each THOUGHT_TYPES as t}
				{@const count = visibleStats[t.value] ?? 0}
				{#if count > 0}
					<span class="flex items-center gap-1.5 text-xs text-text-muted">
						<span
							class="w-2 h-2 rounded-full"
							style="background:{TYPE_COLOR[t.value]}"
						></span>
						<span style="color:{TYPE_COLOR[t.value]}" class="font-medium">{count}</span>
					</span>
				{/if}
			{/each}
		</div>
	</div>

	<!-- ── Month View ──────────────────────────────────────────────────── -->
	{#if view === 'month'}
		<!-- Day name header row -->
		<div class="grid grid-cols-7 mb-1">
			{#each DAY_NAMES as name}
				<div class="text-center text-xs text-text-muted font-medium py-2 tracking-wide uppercase">
					{name}
				</div>
			{/each}
		</div>

		<!-- Day grid -->
		<div
			class="grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-white/5"
			style="background:rgba(255,255,255,0.04)"
		>
			{#each getMonthGrid() as day}
				{@const dayThoughts = getThoughtsForDay(day)}
				{@const inMonth = isCurrentMonth(day)}
				{@const today = isToday(day)}
				<div
					class="bg-bg-card min-h-28 p-2 transition-colors
						{inMonth ? 'hover:bg-bg-elevated' : 'opacity-30'}
						{dayThoughts.length > 0 && inMonth ? 'cursor-pointer' : ''}"
					onclick={() => { if (dayThoughts.length > 0 && inMonth) openDay(day); }}
					role="button"
					tabindex="0"
					onkeydown={(e) => {
						if ((e.key === 'Enter' || e.key === ' ') && dayThoughts.length > 0 && inMonth) {
							e.preventDefault();
							openDay(day);
						}
					}}
				>
					<!-- Day number -->
					<div class="flex items-center justify-end mb-1.5">
						<span
							class="w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold
								{today ? 'bg-primary text-white' : 'text-text-muted'}"
						>
							{day.getDate()}
						</span>
					</div>

					<!-- Events -->
					<div class="space-y-0.5">
						{#each dayThoughts.slice(0, 3) as thought}
							<button
								onclick={(e) => {
									e.stopPropagation();
									onSelectThought(thought);
								}}
								class="w-full text-left px-1.5 py-0.5 rounded text-xs truncate hover:opacity-75 transition-opacity"
								style="background-color:{typeColor(thought.metadata.type)}1a; color:{typeColor(thought.metadata.type)}; border-left:2px solid {typeColor(thought.metadata.type)}"
							>
								{truncate(thought.content, 28)}
							</button>
						{/each}
						{#if dayThoughts.length > 3}
							<button
								onclick={(e) => {
									e.stopPropagation();
									openDay(day);
								}}
								class="w-full text-left px-1.5 py-0.5 text-xs text-text-muted hover:text-text transition-colors font-medium"
							>
								+{dayThoughts.length - 3} more
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- ── Week View ───────────────────────────────────────────────────── -->
	{#if view === 'week'}
		<div
			class="grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-white/5"
			style="background:rgba(255,255,255,0.04)"
		>
			{#each getWeekDays() as day}
				{@const dayThoughts = getThoughtsForDay(day)}
				{@const today = isToday(day)}
				<div class="bg-bg-card flex flex-col">
					<!-- Day column header -->
					<div
						class="p-3 border-b border-white/5 text-center
							{today ? 'bg-primary/10' : ''}"
					>
						<div class="text-xs text-text-muted uppercase tracking-wide font-medium">
							{DAY_NAMES[day.getDay()]}
						</div>
						<div
							class="mt-1.5 w-8 h-8 flex items-center justify-center rounded-full mx-auto text-sm font-bold
								{today ? 'bg-primary text-white' : 'text-text'}"
						>
							{day.getDate()}
						</div>
					</div>

					<!-- Day events -->
					<div class="p-2 space-y-1.5 flex-1 min-h-36 overflow-y-auto max-h-72">
						{#each dayThoughts as thought}
							<button
								onclick={() => onSelectThought(thought)}
								class="w-full text-left p-2 rounded-lg hover:opacity-80 transition-opacity"
								style="background-color:{typeColor(thought.metadata.type)}18; border-left:2px solid {typeColor(thought.metadata.type)}"
							>
								<div
									class="text-xs font-semibold mb-0.5"
									style="color:{typeColor(thought.metadata.type)}"
								>
									{formatTime(thought.created_at)}
								</div>
								<div class="text-xs text-text leading-snug">
									{truncate(thought.content, 60)}
								</div>
							</button>
						{/each}
						{#if dayThoughts.length === 0}
							<div class="text-xs text-white/15 text-center py-6 font-medium">—</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- ── Day View ────────────────────────────────────────────────────── -->
	{#if view === 'day'}
		{@const dayThoughts = getThoughtsForDay(currentDate)}
		<div class="bg-bg-card border border-white/5 rounded-xl overflow-hidden">
			{#if dayThoughts.length === 0}
				<div class="text-center py-20">
					<div class="text-3xl mb-3">📭</div>
					<div class="text-text-muted text-sm">No thoughts captured on this day</div>
				</div>
			{:else}
				<!-- Day summary bar -->
				<div class="px-5 py-3 border-b border-white/5 flex items-center gap-4 flex-wrap">
					<span class="text-sm text-text-muted"
						><span class="text-text font-semibold">{dayThoughts.length}</span> thought{dayThoughts.length === 1 ? '' : 's'}</span
					>
					{#each THOUGHT_TYPES as t}
						{@const count = dayThoughts.filter((th) => th.metadata.type === t.value).length}
						{#if count > 0}
							<span
								class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
								style="background:{TYPE_COLOR[t.value]}22; color:{TYPE_COLOR[t.value]}"
							>
								{count}
								{t.label}{count !== 1 ? 's' : ''}
							</span>
						{/if}
					{/each}
				</div>

				<!-- Timeline -->
				<div class="divide-y divide-white/5">
					{#each dayThoughts as thought}
						<button
							onclick={() => onSelectThought(thought)}
							class="w-full text-left p-4 hover:bg-bg-elevated transition-colors flex gap-4 group"
						>
							<!-- Color stripe + dot -->
							<div class="flex flex-col items-center gap-1 pt-1 shrink-0">
								<span
									class="w-2.5 h-2.5 rounded-full shrink-0"
									style="background:{typeColor(thought.metadata.type)}"
								></span>
								<div class="w-px flex-1 min-h-4" style="background:{typeColor(thought.metadata.type)}33"></div>
							</div>

							<div class="flex-1 min-w-0 pb-1">
								<!-- Meta row -->
								<div class="flex items-center gap-2.5 mb-1.5 flex-wrap">
									<time class="text-xs text-text-muted font-mono">
										{formatTime(thought.created_at)}
									</time>
									<span
										class="text-xs font-medium px-2 py-0.5 rounded-full"
										style="background:{typeColor(thought.metadata.type)}22; color:{typeColor(thought.metadata.type)}"
									>
										{typeLabel(thought.metadata.type)}
									</span>
									{#if thought.metadata.topics?.length}
										{#each thought.metadata.topics.slice(0, 3) as topic}
											<span class="text-xs px-1.5 py-0.5 bg-white/5 text-text-muted rounded">
												#{topic}
											</span>
										{/each}
									{/if}
								</div>

								<!-- Content -->
								<p class="text-sm text-text leading-relaxed group-hover:text-white transition-colors">
									{truncate(thought.content, 220)}
								</p>

								<!-- Action items -->
								{#if thought.metadata.action_items?.length}
									<div class="mt-2 space-y-0.5">
										{#each thought.metadata.action_items.slice(0, 2) as item}
											<div class="flex items-start gap-1.5 text-xs text-text-muted">
												<span class="mt-0.5 shrink-0" style="color:{TYPE_COLOR['task']}">○</span>
												<span>{item}</span>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- ── Empty state (no thoughts in this period) ────────────────────── -->
	{#if view === 'month'}
		{@const monthTotal = getMonthGrid()
			.filter((d) => isCurrentMonth(d))
			.reduce((sum, d) => sum + getThoughtsForDay(d).length, 0)}
		{#if monthTotal === 0 && thoughts.length > 0}
			<div class="mt-4 text-center text-text-muted text-sm py-4">
				No thoughts captured in {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}.
				<button onclick={goToday} class="ml-1 text-primary hover:text-primary-light underline"
					>Go to today</button
				>
			</div>
		{/if}
	{/if}
</div>
