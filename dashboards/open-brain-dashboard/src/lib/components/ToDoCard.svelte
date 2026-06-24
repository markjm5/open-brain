<script lang="ts">
	import { getThoughts } from '$lib/api';
	import { supabase } from '$lib/supabase';
	import type { Thought } from '$lib/types';
	import { onMount } from 'svelte';

	let { onSelectThought }: { onSelectThought: (t: Thought) => void } = $props();

	const LOCAL_KEY = 'ob1-dismissed-tasks';

	let tasks = $state<Thought[]>([]);
	let loading = $state(true);
	let collapsed = $state(false);
	let error = $state<string | null>(null);
	let dismissed = $state<Set<string>>(new Set());
	let showDismissed = $state(false);
	let syncing = $state(false);

	// ── Local cache (instant reads, no flicker) ───────────────────────────
	function readLocal(): Set<string> {
		try {
			const raw = localStorage.getItem(LOCAL_KEY);
			return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
		} catch {
			return new Set();
		}
	}

	function writeLocal(set: Set<string>) {
		localStorage.setItem(LOCAL_KEY, JSON.stringify([...set]));
	}

	// ── Supabase user-metadata sync ───────────────────────────────────────
	async function loadFromSupabase(): Promise<Set<string> | null> {
		const { data, error } = await supabase.auth.getUser();
		if (error || !data.user) return null;
		const raw = data.user.user_metadata?.dismissed_tasks as string[] | undefined;
		return raw ? new Set(raw) : new Set();
	}

	async function saveToSupabase(set: Set<string>) {
		syncing = true;
		await supabase.auth.updateUser({
			data: { dismissed_tasks: [...set] }
		});
		syncing = false;
	}

	async function persist(set: Set<string>) {
		writeLocal(set);
		await saveToSupabase(set);
	}

	function dismiss(task: Thought) {
		const next = new Set(dismissed);
		next.add(task.content.trim());
		dismissed = next;
		persist(next);
	}

	function restore(task: Thought) {
		const next = new Set(dismissed);
		next.delete(task.content.trim());
		dismissed = next;
		persist(next);
	}

	let openTasks = $derived(tasks.filter((t) => !dismissed.has(t.content.trim())));
	let doneTasks = $derived(tasks.filter((t) => dismissed.has(t.content.trim())));

	onMount(async () => {
		// Show local cache immediately so there's no blank flash
		dismissed = readLocal();

		// Fetch tasks and remote dismissed state in parallel
		const [, remote] = await Promise.all([
			getThoughts({ type: 'task', limit: 100 }).then(
				(t) => { tasks = t; },
				() => { error = 'Could not load tasks'; }
			).finally(() => { loading = false; }),
			loadFromSupabase()
		]);

		// Remote is source of truth — merge and update local cache
		if (remote !== null) {
			dismissed = remote;
			writeLocal(remote);
		}
	});

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		const now = new Date();
		const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays}d ago`;
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<div class="bg-bg-card border border-white/5 rounded-2xl overflow-hidden mb-6">
	<!-- Header -->
	<div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
		<div class="flex items-center gap-3">
			<span class="w-2.5 h-2.5 rounded-full bg-task shrink-0"></span>
			<h2 class="text-sm font-semibold text-text">Open To-Dos</h2>
			{#if !loading}
				<span class="text-xs px-2 py-0.5 rounded-full bg-task/15 text-task font-medium">
					{openTasks.length}
				</span>
				{#if doneTasks.length > 0}
					<button
						onclick={() => (showDismissed = !showDismissed)}
						class="text-xs text-text-muted hover:text-text transition-colors"
					>
						{showDismissed ? 'Hide' : `+${doneTasks.length} done`}
					</button>
				{/if}
				{#if syncing}
					<span class="flex items-center gap-1 text-xs text-text-muted">
						<span class="w-2.5 h-2.5 border border-text-muted border-t-transparent rounded-full animate-spin"></span>
						Saving…
					</span>
				{/if}
			{/if}
		</div>
		<button
			onclick={() => (collapsed = !collapsed)}
			class="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-text-muted hover:text-text transition-colors"
			aria-label={collapsed ? 'Expand' : 'Collapse'}
		>
			<svg
				class="w-3.5 h-3.5 transition-transform duration-200 {collapsed ? '-rotate-90' : ''}"
				fill="none" stroke="currentColor" viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</button>
	</div>

	<!-- Body -->
	{#if !collapsed}
		{#if loading}
			<div class="flex items-center gap-3 px-5 py-6 text-text-muted text-sm">
				<div class="w-4 h-4 border-2 border-task border-t-transparent rounded-full animate-spin shrink-0"></div>
				Loading tasks…
			</div>
		{:else if error}
			<div class="px-5 py-6 text-sm text-red-400">{error}</div>
		{:else if openTasks.length === 0 && doneTasks.length === 0}
			<div class="px-5 py-10 text-center">
				<div class="text-2xl mb-2">✅</div>
				<div class="text-sm text-text-muted">All clear — no open tasks</div>
			</div>
		{:else if openTasks.length === 0}
			<div class="px-5 py-6 text-center">
				<div class="text-2xl mb-2">✅</div>
				<div class="text-sm text-text-muted">All tasks done!</div>
			</div>
		{:else}
			<ul class="divide-y divide-white/5 max-h-72 overflow-y-auto">
				{#each openTasks as task}
					<li class="flex items-start gap-3 px-5 py-3.5 hover:bg-bg-elevated transition-colors group">
						<!-- Tick-off checkbox -->
						<button
							onclick={() => dismiss(task)}
							class="mt-0.5 w-4 h-4 rounded border border-task/50 shrink-0 flex items-center justify-center hover:border-task hover:bg-task/20 transition-colors"
							title="Mark as done"
							aria-label="Mark as done"
						>
							<svg class="w-2.5 h-2.5 text-task opacity-0 group-hover:opacity-60 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
							</svg>
						</button>

						<button
							onclick={() => onSelectThought(task)}
							class="flex-1 min-w-0 text-left"
						>
							<p class="text-sm text-text leading-snug group-hover:text-white transition-colors line-clamp-2">
								{task.content}
							</p>
							<div class="flex items-center gap-2 mt-1.5 flex-wrap">
								<span class="text-xs text-text-muted font-mono">{formatDate(task.created_at)}</span>
								{#each (task.metadata.topics ?? []).slice(0, 3) as topic}
									<span class="text-xs px-1.5 py-0.5 bg-white/5 text-text-muted rounded">#{topic}</span>
								{/each}
							</div>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<!-- Done / dismissed tasks -->
		{#if showDismissed && doneTasks.length > 0}
			<div class="border-t border-white/5">
				<div class="px-5 py-2 text-xs text-text-muted font-medium uppercase tracking-wide">Done</div>
				<ul class="divide-y divide-white/5 max-h-48 overflow-y-auto">
					{#each doneTasks as task}
						<li class="flex items-start gap-3 px-5 py-3 group opacity-50 hover:opacity-75 transition-opacity">
							<!-- Restore checkbox (checked state) -->
							<button
								onclick={() => restore(task)}
								class="mt-0.5 w-4 h-4 rounded border border-task/50 bg-task/20 shrink-0 flex items-center justify-center hover:bg-task/10 transition-colors"
								title="Restore task"
								aria-label="Restore task"
							>
								<svg class="w-2.5 h-2.5 text-task" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
								</svg>
							</button>
							<p class="text-sm text-text-muted line-through line-clamp-1 flex-1 min-w-0">{task.content}</p>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/if}
</div>
