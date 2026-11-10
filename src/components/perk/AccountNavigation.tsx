import { Link } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { ArrowUpRight, Gift, House, TrendingUp, Trophy, type LucideIcon } from 'lucide-react';

export type AccountView = 'home' | 'invest' | 'leaderboard' | 'perks';

function Indicator() {
  return <motion.span layoutId="nav-indicator" className="nav-indicator" transition={{ type: 'spring', stiffness: 420, damping: 36 }}/>;
}
function Item({ active, icon: Icon, label }: { active: boolean; icon: LucideIcon; label: string }) {
  return <>{active && <Indicator/>}<Icon/><span>{label}</span></>;
}

export function AccountNavigation({ active }: { active: AccountView | 'send' }) {
  return <motion.nav aria-label="Account navigation" className="bank-navigation" initial={{ y: 40, opacity: 0, x: '-50%' }} animate={{ y: 0, opacity: 1, x: '-50%' }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}>
    <Link to="/account" search={{ view: 'home' }} className={active === 'home' ? 'nav-active' : ''}><Item active={active === 'home'} icon={House} label="Home"/></Link>
    <Link to="/send" className={active === 'send' ? 'nav-active' : ''}><Item active={active === 'send'} icon={ArrowUpRight} label="Send"/></Link>
    <Link to="/account" search={{ view: 'invest' }} className={active === 'invest' ? 'nav-active' : ''}><Item active={active === 'invest'} icon={TrendingUp} label="Invest"/></Link>
    <Link to="/account" search={{ view: 'leaderboard' }} className={active === 'leaderboard' ? 'nav-active' : ''}><Item active={active === 'leaderboard'} icon={Trophy} label="League"/></Link>
    <Link to="/account" search={{ view: 'perks' }} className={active === 'perks' ? 'nav-active' : ''}><Item active={active === 'perks'} icon={Gift} label="Perks"/></Link>
  </motion.nav>;
}
