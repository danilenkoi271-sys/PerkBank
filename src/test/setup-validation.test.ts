import { describe,expect,it } from 'vitest';
import { pinSchema,setupInput,sendInput } from '@/lib/validation';
import { ibanSchema,tradeInput,tradePayout,isAdminIdentity,tradeStats } from '@/lib/investing';
describe('Account rules',()=>{
 it('requires a five digit PIN',()=>{expect(pinSchema.safeParse('12345').success).toBe(true);for(const p of ['1234','123456','1234a'])expect(pinSchema.safeParse(p).success).toBe(false);});
 it('uses exactly five numeric IBAN digits',()=>{expect(ibanSchema.safeParse('01234').success).toBe(true);for(const p of ['1234','123456','abcde'])expect(ibanSchema.safeParse(p).success).toBe(false);});
 it('requires a name at setup',()=>{expect(setupInput.safeParse({full_name:' ',pin:'12345'}).success).toBe(false);expect(setupInput.safeParse({full_name:'Alex',pin:'12345'}).success).toBe(true);});
 it('requires positive transfer amounts and at most two decimals',()=>{expect(sendInput.safeParse({iban:'12345',amount:25.5}).success).toBe(true);for(const amount of [-5,0,10.255])expect(sendInput.safeParse({iban:'12345',amount}).success).toBe(false);});
});
describe('Demo investing rules',()=>{
 it('supports 1.1 through 4 in exact 0.1 intervals (the database decides who may go above 3)',()=>{for(let i=11;i<=40;i++)expect(tradeInput.safeParse({amount:100,multiplier:i/10}).success).toBe(true);for(const multiplier of [1,4.1,1.15])expect(tradeInput.safeParse({amount:100,multiplier}).success).toBe(false);});
 it('success returns $200 total for a $100 stake at 2x',()=>{expect(tradePayout(100,2,true)).toBe(200);});
 it('failure returns none of the stake',()=>{expect(tradePayout(100,2,false)).toBe(0);});
 it('only permits the specified verified Google administrator',()=>{expect(isAdminIdentity('danilenkoi271@gmail.com',['google'],true)).toBe(true);expect(isAdminIdentity('other@gmail.com',['google'],true)).toBe(false);expect(isAdminIdentity('danilenkoi271@gmail.com',['email'],true)).toBe(false);expect(isAdminIdentity('danilenkoi271@gmail.com',['google'],false)).toBe(false);});
 it('counts pending stakes as wagered but not realized PNL',()=>{const stats=tradeStats([{id:'1',amount:100,multiplier:2,status:'success',payout:200,created_at:'2026-11-08',settled_at:'2026-11-08T10:00:00Z'},{id:'2',amount:50,multiplier:2,status:'pending',payout:0,created_at:'2026-11-08',settled_at:null}],new Date('2026-11-08T12:00:00Z'));expect(stats).toEqual({wagered:150,pnl:100,allTimePercent:100,dailyPercent:100});});
});
