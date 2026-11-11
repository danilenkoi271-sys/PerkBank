import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { requireUnlocked } from './auth.server';
import { maskName, tradeInput, tradeStats } from './investing';
import { hasActiveTrade } from './live-trade';
import { buildTradeFeed } from './trade-feed';
export const placeTrade = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>tradeInput.parse(d)).handler(async({data,context})=>{
 await requireUnlocked(context.userId);
 // One trade at a time: refuse while a trade is pending or still playing out its result.
 const {data:existing,error:existingError} = await context.supabase.from('trade_orders').select('status,settled_at').eq('user_id',context.userId);
 if(existingError) throw new Error('Trading is unavailable right now');
 if(hasActiveTrade(existing,Date.now(),2000)) throw new Error('You already have a trade running. You can place another once it finishes.');
 const {data:id,error} = await context.supabase.rpc('place_demo_trade',{_amount:data.amount,_multiplier:data.multiplier});
 if(error) throw new Error(error.message); return {id};
});
export const getLeaderboard = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 await requireUnlocked(context.userId);
 const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
 const [profiles,accounts,orders,roles] = await Promise.all([supabaseAdmin.from('profiles').select('id,full_name,iban,avatar_url'),supabaseAdmin.from('accounts').select('user_id,balance'),supabaseAdmin.from('trade_orders').select('*'),supabaseAdmin.from('user_roles').select('user_id').eq('role','admin')]);
 if(profiles.error || accounts.error || orders.error || roles.error) throw new Error('Leaderboard unavailable');
 const adminIds = new Set(roles.data.map(r=>r.user_id));
 profiles.data = profiles.data.filter(p=>!adminIds.has(p.id));
 const { resolveProfilePhoto } = await import('./profile-photo.server');
 await Promise.all(profiles.data.map(async p => { p.avatar_url = await resolveProfilePhoto(p.avatar_url, supabaseAdmin.storage); }));
 return profiles.data.map(p=>({id:p.id,name:maskName(p.full_name),iban:p.iban,avatar_url:p.avatar_url,balance:Number(accounts.data.find(a=>a.user_id===p.id)?.balance??0),...tradeStats(orders.data.filter(o=>o.user_id===p.id).map(o=>({...o,amount:Number(o.amount),multiplier:Number(o.multiplier),payout:Number(o.payout)})))})).sort((a,b)=>b.pnl-a.pnl || b.balance-a.balance || a.id.localeCompare(b.id));
});

/**
 * Everyone's recent trades, live, with no names: just the trade, its times and its receipts. The administrator's own
 * trades are left out. All the filtering and anonymising happens here on the server (see buildTradeFeed).
 */
export const getTradeFeed = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 await requireUnlocked(context.userId);
 const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
 const roles = await supabaseAdmin.from('user_roles').select('user_id').eq('role','admin');
 if(roles.error) throw new Error('Trades unavailable');
 const adminIds = new Set(roles.data.map(r=>r.user_id));
 const orders = await supabaseAdmin.from('trade_orders').select('id,user_id,amount,multiplier,status,payout,created_at,settled_at').order('created_at',{ascending:false}).limit(150);
 if(orders.error) throw new Error('Trades unavailable');
 const rows = orders.data.filter(o=>!adminIds.has(o.user_id)).slice(0,60).map(o=>({...o,amount:Number(o.amount),multiplier:Number(o.multiplier),payout:Number(o.payout)}));
 const txns = rows.length ? await supabaseAdmin.from('transactions').select('order_id,category,reference,created_at,amount,title').in('order_id',rows.map(o=>o.id)) : {data:[],error:null};
 if(txns.error) throw new Error('Trades unavailable');
 return buildTradeFeed({orders:rows,txns:(txns.data ?? []).map(t=>({...t,amount:Number(t.amount)})),adminIds,now:Date.now(),limit:50});
});
