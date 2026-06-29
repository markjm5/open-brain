import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	login: async ({ request, locals }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '').trim();
		const password = String(data.get('password') ?? '');

		const { error } = await locals.supabase.auth.signInWithPassword({ email, password });

		if (error) {
			return fail(400, { error: error.message });
		}

		throw redirect(303, '/');
	},
};
