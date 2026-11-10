import { Check, X, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
export function perkFeedback(message: string, kind: 'success' | 'error' = 'success', detail?: string) {
  toast.custom(id => <div role={kind === 'error' ? 'alert' : 'status'} className={`perk-feedback perk-feedback-${kind}`}>
    <span className="perk-feedback-mark">{kind === 'error' ? <X/> : detail ? <ArrowUpRight/> : <Check/>}</span>
    <div className="min-w-0 flex-1"><p className="font-semibold">{message}</p>{detail && <p className="mt-1 text-xs opacity-75">{detail}</p>}</div>
    <Button variant="ghost" size="icon" onClick={() => toast.dismiss(id)} aria-label="Dismiss notification" className="perk-feedback-close"><X className="h-4 w-4"/></Button>
  </div>, { duration: 4000, className: 'perk-feedback-shell', unstyled: true });
}