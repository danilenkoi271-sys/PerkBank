import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { requireUnlocked } from './auth.server';
import { displayName, tradeInput, tradeStats } from './investing';
import { z } from 'zod';
import { asDisplayed, hasActiveTrade, heldWinnings } from './live-trade';
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
 // public_name is newer than the generated types, and may not exist until the database change is applied. Until then
 // everyone is private, exactly as before.
 type Player = { id: string; full_name: string; iban: string | null; avatar_url: string | null; public_name?: boolean | null };
 type Pick = { select: (c: string) => Promise<{ data: Player[] | null; error: { message: string } | null }> };
 const players = () => (supabaseAdmin as unknown as { from: (t: string) => Pick }).from('profiles');
 const withChoice = await players().select('id,full_name,iban,avatar_url,public_name');
 const everyone = withChoice.error ? await players().select('id,full_name,iban,avatar_url') : withChoice;
 const [accounts,orders,roles] = await Promise.all([supabaseAdmin.from('accounts').select('user_id,balance'),supabaseAdmin.from('trade_orders').select('*'),supabaseAdmin.from('user_roles').select('user_id').eq('role','admin')]);
 if(everyone.error || !everyone.data || accounts.error || orders.error || roles.error) throw new Error('Leaderboard unavailable');
 const adminIds = new Set(roles.data.map(r=>r.user_id));
 const members = everyone.data.filter(p=>!adminIds.has(p.id));
 const { resolveProfilePhoto } = await import('./profile-photo.server');
 await Promise.all(members.map(async p => { p.avatar_url = await resolveProfilePhoto(p.avatar_url, supabaseAdmin.storage); }));
 // A result is not allowed to move anyone up or down the league, or into their balance, until the owner's chart has finished playing it.
 const now = Date.now();
 return members.map(p=>{const mine=orders.data.filter(o=>o.user_id===p.id).map(o=>({...o,amount:Number(o.amount),multiplier:Number(o.multiplier),payout:Number(o.payout)}));return {id:p.id,name:displayName(p.full_name,p.public_name===true),public:p.public_name===true,iban:p.iban,avatar_url:p.avatar_url,balance:Math.max(0,Number(accounts.data.find(a=>a.user_id===p.id)?.balance??0)-heldWinnings(mine,now)),...tradeStats(mine.map(o=>asDisplayed(o,now)))};}).sort((a,b)=>b.pnl-a.pnl || b.balance-a.balance || a.id.localeCompare(b.id));
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

/** Whether the signed-in member shows their full name on the league. Private unless they chose otherwise. */
export const getMyLeaderboardPrivacy = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 await requireUnlocked(context.userId);
 type Row = { public_name: boolean | null };
 const res = await (context.supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: Row | null; error: { message: string } | null }> } } } }).from('profiles').select('public_name').eq('id',context.userId).maybeSingle();
 // No column yet (the database change has not been applied): report it as unavailable instead of failing.
 if(res.error) return {available:false,public:false};
 return {available:true,public:res.data?.public_name===true};
});

/** Lets a member make their name public or private. It only ever touches the member's own row. */
export const setLeaderboardPrivacy = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({public:z.boolean()}).parse(d)).handler(async({data,context})=>{
 await requireUnlocked(context.userId);
 const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
 const { error } = await (supabaseAdmin as unknown as { from: (t: string) => { update: (v: object) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } } }).from('profiles').update({public_name:data.public}).eq('id',context.userId);
 if(error) throw new Error('Your name privacy could not be changed right now');
 return {public:data.public};
});
