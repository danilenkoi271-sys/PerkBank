import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccountSession, pinHash, requireUnlocked, safeEqual } from './auth.server';
import { sendInput, setupInput } from './validation';
import { ibanSchema, isAdminIdentity } from './investing';
import { photoPathInput, validatePhotoOwner } from './profile-photo';
export const getSetupInfo = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
 const {data} = await context.supabase.from('profiles').select('id').eq('id',context.userId).maybeSingle();
 const meta = (context.claims['user_metadata'] ?? {}) as Record<string,unknown>;
 return { hasProfile: Boolean(data), suggestedName: typeof meta['full_name']==='string' ? meta['full_name'] : '' };
});
export const setupProfile = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>setupInput.parse(d)).handler(async({data,context})=>{
 const {data:existing} = await context.supabase.from('profiles').select('id').eq('id',context.userId).maybeSingle();
 if (existing) return {ok:true};
 const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
 const meta = (context.claims['user_metadata'] ?? {}) as Record<string,unknown>;
 const {error} = await supabaseAdmin.from('profiles').insert({id:context.userId,full_name:data.full_name,tag:context.userId.replace(/-/g,'').slice(0,20),pin_hash:await pinHash(context.userId,data.pin),avatar_url:typeof meta['avatar_url']==='string' ? meta['avatar_url'] : null});
 if(error) throw new Error('Could not create your account');
 const {error:accountError} = await supabaseAdmin.from('accounts').insert({user_id:context.userId,balance:0});
 if(accountError){ await supabaseAdmin.from('profiles').delete().eq('id',context.userId); throw new Error('Setup failed — try again'); }
 await (await getAccountSession()).update({userId:context.userId}); return {ok:true};
});
export const unlockAccount = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({pin:z.string().regex(/^\d{5}$/)}).parse(d)).handler(async({data,context})=>{
 const {data:profile} = await context.supabase.from('profiles').select('pin_hash').eq('id',context.userId).maybeSingle();
 if(!profile || !(await safeEqual(await pinHash(context.userId,data.pin),profile.pin_hash))) return {ok:false};
 await (await getAccountSession()).update({userId:context.userId}); return {ok:true};
});
export const lockAccount = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async()=>{ await (await getAccountSession()).clear(); return {ok:true}; });
export const getAccountData = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const session = await getAccountSession();
 const {data:profile,error} = await context.supabase.from('profiles').select('full_name,iban,avatar_url').eq('id',context.userId).maybeSingle();
 if(error) throw new Error('Account unavailable');
 if(!profile) return {status:'no_profile' as const};
 if(session.data.userId!==context.userId) return {status:'locked' as const,profile};
 const {data:account,error:ae} = await context.supabase.from('accounts').select('id,balance').eq('user_id',context.userId).single();
 if(ae) throw new Error('Account unavailable');
 const [tx,orders,user,role] = await Promise.all([
 context.supabase.from('transactions').select('*').eq('account_id',account.id).order('created_at',{ascending:false}).limit(200),
 context.supabase.from('trade_orders').select('*').eq('user_id',context.userId).order('created_at',{ascending:false}),
 context.supabase.auth.getUser(),context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'})]);
 if(tx.error || orders.error) throw new Error('Activity unavailable');
 const { resolveProfilePhoto } = await import('./profile-photo.server');
 profile.avatar_url = await resolveProfilePhoto(profile.avatar_url, context.supabase.storage);
 return {status:'ready' as const,serverNow:Date.now(),profile,account:{id:account.id,balance:Number(account.balance)},txns:tx.data.map(t=>({...t,amount:Number(t.amount)})),orders:orders.data.map(o=>({...o,amount:Number(o.amount),multiplier:Number(o.multiplier),payout:Number(o.payout)})),isAdmin:Boolean(role.data && isAdminIdentity(user.data.user?.email,user.data.user?.app_metadata['providers'],Boolean(user.data.user?.email_confirmed_at)))};
});
export const lookupRecipient = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({iban:ibanSchema}).parse(d)).handler(async({data,context})=>{
 await requireUnlocked(context.userId);
 const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
 const {data:p,error} = await supabaseAdmin.from('profiles').select('id,full_name,iban').eq('iban',data.iban).maybeSingle();
 if(error) throw new Error('Lookup unavailable');
 return p ? {found:true as const,iban:p.iban ?? data.iban,full_name:p.full_name,self:p.id===context.userId} : {found:false as const};
});
export const sendMoney = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>sendInput.parse(d)).handler(async({data,context})=>{
 await requireUnlocked(context.userId);
 const {error} = await context.supabase.rpc('transfer_by_iban',{_iban:data.iban,_amount:data.amount,...(data.note?{_note:data.note}:{})});
 if(error) throw new Error(error.message); return {ok:true};
});
export const updateProfilePhoto = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>photoPathInput.parse(d)).handler(async({data,context})=>{
 await requireUnlocked(context.userId);
 validatePhotoOwner(data.path, context.userId);
 const { error } = await context.supabase.rpc('update_profile_photo', { _path: data.path });
 if (error) throw new Error('Photo could not be saved');
 return { ok: true };
});
