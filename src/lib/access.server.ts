import { isAdminIdentity } from './investing';
import { requireUnlocked } from './auth.server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
export async function requireAdmin(context: { supabase: SupabaseClient<Database>; userId: string; claims?: Record<string, unknown> }) {
 await requireUnlocked(context.userId);
 const { data: { user }, error } = await context.supabase.auth.getUser();
 // The manager must be signed in through Google. A password, magic-link or recovery session never counts.
 const amr = context.claims?.['amr'];
 const methods = Array.isArray(amr) ? (amr as Array<{ method?: unknown }>).map(a => String(a?.method)) : [];
 if (methods.some(m => ['password','otp','magiclink','recovery','email','email_change','invite'].includes(m))) throw new Error('Not authorized');
 if (error || !user || user.id !== context.userId || !isAdminIdentity(user.email,user.app_metadata['providers'],Boolean(user.email_confirmed_at))) throw new Error('Not authorized');
 const { data: allowed, error: roleError } = await context.supabase.rpc('has_role',{ _user_id: context.userId, _role: 'admin' });
 if (roleError || !allowed) throw new Error('Not authorized');
}
