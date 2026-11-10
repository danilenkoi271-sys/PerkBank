import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { requireAdmin } from './access.server';
const ICON = z.string().max(150000).refine(v=>/^(brand|cat):[a-z]+$/.test(v)||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),'Invalid icon');
export const getAdminData = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 await requireAdmin(context); const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const [p,a,t,o]=await Promise.all([supabaseAdmin.from('profiles').select('id,full_name,iban,avatar_url'),supabaseAdmin.from('accounts').select('id,user_id,balance'),supabaseAdmin.from('transactions').select('*').order('created_at',{ascending:false}).limit(500),supabaseAdmin.from('trade_orders').select('*').order('created_at',{ascending:false})]);
 if(p.error||a.error||t.error||o.error) throw new Error('Admin data unavailable');
 const owner=(id:string)=>p.data.find(x=>x.id===id)?.full_name??'Legacy account';
 return {users:p.data.map(x=>({...x,accountId:a.data.find(y=>y.user_id===x.id)?.id??null,balance:Number(a.data.find(y=>y.user_id===x.id)?.balance??0)})),txns:t.data.map(x=>({...x,amount:Number(x.amount),owner:owner(a.data.find(y=>y.id===x.account_id)?.user_id??'')})),orders:o.data.map(x=>({...x,amount:Number(x.amount),multiplier:Number(x.multiplier),payout:Number(x.payout),owner:owner(x.user_id)}))};
});
export const settleTrade = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({id:z.string().uuid(),success:z.boolean()}).parse(d)).handler(async({data,context})=>{
 await requireAdmin(context); const {supabaseAdmin}=await import('@/integrations/supabase/client.server'); const {error}=await supabaseAdmin.rpc('settle_demo_trade',{_id:data.id,_success:data.success}); if(error) throw new Error(error.message); return {ok:true};
});
export const setBalance = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({accountId:z.string().uuid(),balance:z.number().finite().refine(n=>Math.abs(n)<1e9 && Math.abs(n*100-Math.round(n*100))<1e-6)}).parse(d)).handler(async({data,context})=>{
 await requireAdmin(context); const {supabaseAdmin}=await import('@/integrations/supabase/client.server'); const {error}=await supabaseAdmin.from('accounts').update({balance:data.balance}).eq('id',data.accountId); if(error) throw new Error('Balance update failed'); return {ok:true};
});
export const addTransaction = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({accountId:z.string().uuid(),title:z.string().trim().min(1).max(80),category:z.string().max(30),amount:z.number().finite().refine(n=>n!==0&&Math.abs(n)<1e9),note:z.string().max(200).optional(),icon:ICON.optional(),created_at:z.string().datetime().optional()}).parse(d)).handler(async({data,context})=>{
 await requireAdmin(context); const {supabaseAdmin}=await import('@/integrations/supabase/client.server'); const {error}=await supabaseAdmin.from('transactions').insert({account_id:data.accountId,title:data.title,category:data.category,amount:data.amount,note:data.note??null,icon:data.icon??null,...(data.created_at?{created_at:data.created_at}:{})}); if(error) throw new Error('Transaction failed'); return {ok:true};
});
export const deleteTransaction = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({id:z.string().uuid()}).parse(d)).handler(async({data,context})=>{
 await requireAdmin(context); const {supabaseAdmin}=await import('@/integrations/supabase/client.server'); const {error}=await supabaseAdmin.from('transactions').delete().eq('id',data.id).is('order_id',null); if(error) throw new Error('Delete failed'); return {ok:true};
});
export const setTransactionIcon = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({id:z.string().uuid(),icon:ICON.nullable()}).parse(d)).handler(async({data,context})=>{
 await requireAdmin(context); const {supabaseAdmin}=await import('@/integrations/supabase/client.server'); const {error}=await supabaseAdmin.from('transactions').update({icon:data.icon}).eq('id',data.id); if(error) throw new Error('Icon update failed'); return {ok:true};
});
