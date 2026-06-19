<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';

	let {
		children,
		data,
	}: {
		children: Snippet;
		data: { user: { email?: string | null } | null };
	} = $props();
	const user = $derived(data.user);
</script>

<div class="min-h-screen flex flex-col">
	<header class="border-b border-white/10 bg-bg-elevated/50 backdrop-blur-sm sticky top-0 z-50">
		<div class="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
			<a href="/" class="flex items-center gap-2 sm:gap-3 shrink-0">
				<span class="text-xl sm:text-2xl">🧠</span>
				<h1 class="text-base sm:text-xl font-bold">Open Brain</h1>
			</a>
			<div class="flex items-center gap-2 sm:gap-3 text-sm min-w-0">
				{#if user}
					<span class="text-text-muted hidden sm:block truncate max-w-[180px]">{user.email ?? 'Signed in'}</span>
					<a href="/signout" class="text-text-muted hover:text-text transition-colors shrink-0 text-xs sm:text-sm">Sign out</a>
				{:else}
					<a href="/signin" class="text-text-muted hover:text-text transition-colors text-xs sm:text-sm">Sign in</a>
				{/if}
			</div>
		</div>
	</header>
	
	<main class="flex-1">
		{@render children()}
	</main>
	
	<footer class="border-t border-white/10 py-4 sm:py-6 text-center text-text-muted text-xs sm:text-sm">
		<p>Open Brain • Capture and search your thoughts</p>
	</footer>
</div>
