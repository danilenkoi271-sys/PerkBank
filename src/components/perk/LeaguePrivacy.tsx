import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { motion } from 'motion/react';
import { Globe, Lock } from 'lucide-react';
import { getMyLeaderboardPrivacy, setLeaderboardPrivacy } from '@/lib/investing.functions';
import { maskName } from '@/lib/investing';
import { useConfirm } from './ConfirmDialog';
import { perkFeedback } from './PerkFeedback';

type Privacy = { available: boolean; public: boolean };
const KEY = ['league-privacy'];

/**
 * Private or public: whether other members see your full name on the league or a censored version of it.
 * Everyone starts private. Making your name public asks first, because everyone will see it.
 */
export function LeaguePrivacy({ name }: { name: string }) {
  const qc = useQueryClient();
  const fetchPrivacy = useServerFn(getMyLeaderboardPrivacy);
  const save = useServerFn(setLeaderboardPrivacy);
  const { confirm, dialog } = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: KEY, queryFn: () => fetchPrivacy(), retry: false });
  const state: Privacy = data ?? { available: false, public: false };
  const ready = !isLoading && state.available;
  const isPublic = state.public;

  async function choose(next: boolean) {
    if (!ready || next === isPublic) return;
    if (next && !(await confirm({
      title: 'Show your name on the league?',
      body: 'Everyone on Perk will see your full name instead of a censored one. You can switch back to private at any time.',
      rows: [['Others see', name]],
      confirmLabel: 'Make it public', cancelLabel: 'Keep private', tone: 'neutral', icon: <Globe className="h-5 w-5"/>,
    }))) return;
    const before = qc.getQueryData<Privacy>(KEY);
    qc.setQueryData<Privacy>(KEY, { available: true, public: next }); // update straight away, undo if it fails
    try {
      await save({ data: { public: next } });
      perkFeedback(next ? 'Your name is now public' : 'Your name is now private');
      void qc.invalidateQueries({ queryKey: ['leaderboard'] });
    } catch (e) {
      if (before) qc.setQueryData(KEY, before);
      perkFeedback(e instanceof Error ? e.message : 'Could not change that', 'error');
    }
  }

  const options = [{ value: false, label: 'Private', Icon: Lock }, { value: true, label: 'Public', Icon: Globe }] as const;
  return <section aria-label="Name privacy" className="panel mt-6 flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
    <div className="min-w-0">
      <p className="text-[15px] font-medium">Your name on the league</p>
      <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
        {!state.available && !isLoading ? 'Name privacy settings are coming soon.'
          : isPublic ? <>Everyone sees <span className="font-medium text-foreground">{name}</span></>
          : <>Others see you as <span className="font-medium text-foreground">{maskName(name)}</span></>}
      </p>
    </div>
    <div role="radiogroup" aria-label="Name visibility" className="relative flex rounded-full bg-muted p-1">
      {options.map(({ value, label, Icon }) => {
        const on = isPublic === value;
        return <button key={label} type="button" role="radio" aria-checked={on} disabled={!ready} onClick={() => void choose(value)} className={`relative z-10 flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 ${on ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          {on && <motion.span layoutId="league-privacy-pill" className="absolute inset-0 -z-10 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 420, damping: 36 }}/>}
          <Icon className="h-3.5 w-3.5"/>{label}
        </button>;
      })}
    </div>
    {dialog}
  </section>;
}
