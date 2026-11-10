import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Crown, X } from 'lucide-react';
import { getLeaderboard } from '@/lib/investing.functions';
import { formatMoney } from '@/lib/categories';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'motion/react';
import { Overlay, PageHeading } from './AppShell';
import { EASE } from './motion';
type Member=Awaited<ReturnType<typeof getLeaderboard>>[number];
export function MemberAvatar({name,url,className='h-12 w-12'}:{name:string;url:string|null;className?:string}) {return url?<img src={url} alt={`${name} profile`} referrerPolicy="no-referrer" className={`${className} rounded-full object-cover bg-muted`} onError={e=>{e.currentTarget.style.display='none';}}/>:<span className={`${className} flex shrink-0 items-center justify-center rounded-full bg-ink text-bone font-medium`}>{name.slice(0,1)}</span>;}
export function Leaderboard(){const fetch=useServerFn(getLeaderboard);const{data,isLoading,error}=useQuery({queryKey:['leaderboard'],queryFn:()=>fetch(),refetchInterval:15000});const[selected,setSelected]=useState<Member|null>(null);const members=data??[];
 const heights=['h-[168px] sm:h-[200px]','h-[124px] sm:h-[148px]','h-[96px] sm:h-[112px]'];
 return <section className="mx-auto max-w-[760px]">
  <PageHeading eyebrow="The Perk League" title="Top of the" accent="league."><p className="mt-4 text-[15px] text-muted-foreground">Ranked by total trading PNL.</p></PageHeading>
  {isLoading?<p className="mt-10 text-muted-foreground">Loading members…</p>:error?<p className="mt-10 text-muted-foreground">Leaderboard unavailable.</p>:<>
  <div className="podium">{[1,0,2].map((i,col)=>{const m=members[i];return m?<button key={m.id} type="button" onClick={()=>setSelected(m)} className={`podium-${i+1} group flex flex-col items-center text-center`}>
    <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:.7,ease:EASE,delay:.35+col*.08}} className="flex flex-col items-center px-1">
      <span className="relative">{i===0&&<Crown className="absolute -top-5 left-1/2 h-4 w-4 -translate-x-1/2 text-hoop"/>}<MemberAvatar name={m.name} url={m.avatar_url} className={`${i===0?'h-20 w-20':'h-16 w-16'} ring-4 ring-bone transition-transform duration-500 group-hover:-translate-y-1`}/></span>
      <span className="mt-3 max-w-full truncate text-sm font-medium">{m.name}</span>
      <span className={`mt-0.5 text-sm tabular-nums ${m.pnl>=0?'text-success':'text-destructive'}`}>{formatMoney(m.pnl,true)}</span>
    </motion.div>
    <motion.div initial={{scaleY:0}} animate={{scaleY:1}} transition={{duration:1,ease:EASE,delay:.1+col*.08}} className={`podium-bar mt-4 flex w-full items-start justify-center pt-4 ${heights[i]}`}><span className="font-mono text-xs">{i+1}{i===0?'st':i===1?'nd':'rd'}</span></motion.div>
  </button>:<div key={`empty-${i}`}/>;})}</div>
  {members.length>3&&<div className="panel mt-3 p-2">{members.slice(3).map((m,i)=><motion.button key={m.id} type="button" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:.5,ease:EASE,delay:.5+i*.04}} onClick={()=>setSelected(m)} className="flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-bone"><span className="w-6 font-mono text-xs text-muted-foreground">{String(i+4).padStart(2,'0')}</span><MemberAvatar name={m.name} url={m.avatar_url} className="h-10 w-10"/><span className="min-w-0 flex-1 truncate font-medium">{m.name}</span><span className={`text-sm tabular-nums ${m.pnl>=0?'text-success':'text-destructive'}`}>{formatMoney(m.pnl,true)}</span></motion.button>)}</div>}
  {!members.length&&<p className="mt-8 text-muted-foreground">No members yet.</p>}</>}
  <Overlay><AnimatePresence>{selected&&<motion.div role="dialog" aria-label="Member stats" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 backdrop-blur-md sm:items-center sm:p-5" onClick={()=>setSelected(null)} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
   <motion.div className="w-full max-w-sm rounded-[28px] bg-card p-6 text-card-foreground shadow-[0_40px_80px_-30px_rgb(11_12_14/.5)]" onClick={e=>e.stopPropagation()} initial={{y:40,scale:.96}} animate={{y:0,scale:1}} exit={{y:30,opacity:0}} transition={{duration:.5,ease:EASE}}>
    <div className="flex justify-end"><Button variant="ghost" size="icon" aria-label="Close stats" className="rounded-full" onClick={()=>setSelected(null)}><X className="h-4 w-4"/></Button></div>
    <div className="flex flex-col items-center gap-2"><MemberAvatar name={selected.name} url={selected.avatar_url} className="h-20 w-20"/><h2 className="mt-2 text-2xl font-medium">{selected.name}</h2><p className="font-mono text-xs text-muted-foreground">IBAN {selected.iban}</p></div>
    <dl className="mt-6 grid grid-cols-2 gap-2">{[['Balance',formatMoney(selected.balance)],['Wagered',formatMoney(selected.wagered)],['Total PNL',formatMoney(selected.pnl,true)],['Today (UTC)',`${selected.dailyPercent.toFixed(2)}%`],['All-time profits',`${selected.allTimePercent.toFixed(2)}%`]].map(([k,v],i)=><div key={k} className={`rounded-2xl bg-bone p-4 ${i===4?'col-span-2':''}`}><dt className="mono-label text-muted-foreground">{k}</dt><dd className="mt-1.5 text-lg font-medium tabular-nums">{v}</dd></div>)}</dl>
   </motion.div></motion.div>}</AnimatePresence></Overlay>
 </section>;
}
