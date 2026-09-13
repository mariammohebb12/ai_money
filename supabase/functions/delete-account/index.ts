// Supabase Edge Function: delete-account
// Permanently deletes the caller's own account and all of their data. This
// can ONLY run server-side: deleting an auth user requires the service role
// key, which must never be shipped in the app itself.
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
  }

  // First, identify the caller using their own token (never trust a
  // client-supplied user id for a destructive operation like this).
  const callerClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await callerClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { status: 401 });
  }

  // Then use the service role client for the actual deletion — this key has
  // full database access, so it's scoped to only ever act on `user.id` below.
  const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Delete owned rows explicitly rather than relying on FK cascade behavior
  // we can't fully verify from here. `categories` is shared/global data, not
  // per-user, so it's untouched.
  const tables = ['transactions', 'bills', 'saving_goals', 'profiles'] as const;
  for (const table of tables) {
    const column = table === 'profiles' ? 'id' : 'user_id';
    const { error } = await adminClient.from(table).delete().eq(column, user.id);
    if (error) {
      console.error(`Failed to delete ${table} for user ${user.id}:`, error.message);
      return new Response(JSON.stringify({ error: `Failed to delete account data (${table})` }), { status: 500 });
    }
  }

  const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    console.error('Failed to delete auth user:', deleteUserError.message);
    return new Response(JSON.stringify({ error: 'Failed to delete account' }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
