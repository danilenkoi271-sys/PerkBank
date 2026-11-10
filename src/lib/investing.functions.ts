import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { requireUnlocked } from './auth.server';
import { maskName, tradeInput, tradeStats } from './investing';
export const placeTrade = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>tradeInput.parse(d)).handler(async({data,context})=>{
 await requireUnlocked(context.userId);
 const {data:id,error} = await context.supabase.rpc('place_demo_trade',{_amount:data.amount,_multiplier:data.multiplier});
 if(error) throw new Error(error.message); return {id};
});
export const getLeaderboard = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 await requireUnlocked(context.userId);
 const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
 const [profiles,accounts,orders] = await Promise.all([supabaseAdmin.from('profiles').select('id,full_name,iban,avatar_url'),supabaseAdmin.from('accounts').select('user_id,balance'),supabaseAdmin.from('trade_orders').select('*')]);
 if(profiles.error || accounts.error || orders.error) throw new Error('Leaderboard unavailable');
 const { resolveProfilePhoto } = await import('./profile-photo.server');
 await Promise.all(profiles.data.map(async p => { p.avatar_url = await resolveProfilePhoto(p.avatar_url, supabaseAdmin.storage); }));
 return profiles.data.map(p=>({id:p.id,name:maskName(p.full_name),iban:p.iban,avatar_url:p.avatar_url,balance:Number(accounts.data.find(a=>a.user_id===p.id)?.balance??0),...tradeStats(orders.data.filter(o=>o.user_id===p.id).map(o=>({...o,amount:Number(o.amount),multiplier:Number(o.multiplier),payout:Number(o.payout)})))})).sort((a,b)=>b.pnl-a.pnl || b.balance-a.balance || a.id.localeCompare(b.id));
});
