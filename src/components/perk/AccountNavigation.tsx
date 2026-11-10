import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Gift, House, TrendingUp, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type AccountView = 'home' | 'invest' | 'leaderboard' | 'perks';
export function AccountNavigation({ active }: { active: AccountView | 'send' }) {
  return <nav aria-label="Account navigation" className="bank-navigation">
    <Button asChild variant="ghost" className={active === 'home' ? 'nav-active' : ''}><Link to="/account" search={{ view: 'home' }}><House/><span>Home</span></Link></Button>
    <Button asChild variant="ghost" className={active === 'send' ? 'nav-active' : ''}><Link to="/send"><ArrowUpRight/><span>Send</span></Link></Button>
    <Button asChild variant="ghost" className={active === 'invest' ? 'nav-active' : ''}><Link to="/account" search={{ view: 'invest' }}><TrendingUp/><span>Invest</span></Link></Button>
    <Button asChild variant="ghost" className={active === 'leaderboard' ? 'nav-active' : ''}><Link to="/account" search={{ view: 'leaderboard' }}><Trophy/><span>League</span></Link></Button>
    <Button asChild variant="ghost" className={active === 'perks' ? 'nav-active' : ''}><Link to="/account" search={{ view: 'perks' }}><Gift/><span>Perks</span></Link></Button>
  </nav>;
}