import adapterNode from '@sveltejs/adapter-node';
import adapterNetlify from '@sveltejs/adapter-netlify';
import adapterVercel from '@sveltejs/adapter-vercel';

// Pick the adapter based on the deploy platform so the same repo can target
// Netlify, Vercel, or a long-running Node server (Heroku, Docker, local prod).
// Netlify and Vercel set these env vars during their builds; everything else
// (Heroku, `npm run build` locally) falls back to the standalone Node server.
function resolveAdapter() {
	if (process.env.NETLIFY) return adapterNetlify();
	if (process.env.VERCEL) return adapterVercel();
	return adapterNode();
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: resolveAdapter()
	},
	vitePlugin: {
		dynamicCompileOptions: ({ filename }) =>
			filename.includes('node_modules') ? undefined : { runes: true }
	}
};

export default config;
