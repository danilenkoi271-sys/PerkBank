import { isAdminIdentity } from './investing';
import { requireUnlocked } from './auth.server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
export async function requireAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
 await requireUnlocked(context.userId);
 const { data: { user }, error } = await context.supabase.auth.getUser();
 if (error || !user || user.id !== context.userId || !isAdminIdentity(user.email,user.app_metadata['providers'],Boolean(user.email_confirmed_at))) throw new Error('Not authorized');
 const { data: allowed, error: roleError } = await context.supabase.rpc('has_role',{ _user_id: context.userId, _role: 'admin' });
 if (roleError || !allowed) throw new Error('Not authorized');
}
