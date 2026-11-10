import { useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Camera, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MemberAvatar } from './Leaderboard';
import { perkFeedback } from './PerkFeedback';
import { supabase } from '@/integrations/supabase/client';
import { updateProfilePhoto } from '@/lib/account.functions';
async function preparePhoto(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url; });
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Unable to prepare photo');
    const size = Math.min(image.width, image.height);
    ctx.drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 512, 512);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to prepare photo')), 'image/webp', 0.85));
  } finally { URL.revokeObjectURL(url); }
}
export function ProfilePhoto({ name, url, onSaved }: { name: string; url: string | null; onSaved: () => void }) {
  const input = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const save = useServerFn(updateProfilePhoto);
  async function upload(file: File) {
    if (busy) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10_000_000) { perkFeedback('Choose a JPG, PNG or WebP under 10 MB', 'error'); return; }
    setBusy(true); let uploaded: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Please sign in again');
      const blob = await preparePhoto(file); const path = `${user.id}/${crypto.randomUUID()}.webp`;
      const result = await supabase.storage.from('profile-photos').upload(path, blob, { contentType: 'image/webp', upsert: false });
      if (result.error) throw new Error('Your photo could not be uploaded'); uploaded = path;
      await save({ data: { path } }); uploaded = null; onSaved(); perkFeedback('Looking good. Photo updated');
    } catch (e) { if (uploaded) await supabase.storage.from('profile-photos').remove([uploaded]); perkFeedback(e instanceof Error ? e.message : 'Photo update failed', 'error'); }
    finally { setBusy(false); }
  }
  return <><Button variant="ghost" size="icon" aria-label="Change profile picture" title="Change profile picture" disabled={busy} onClick={() => input.current?.click()} className="profile-photo-control">
    {busy ? <LoaderCircle className="h-5 w-5 animate-spin"/> : <MemberAvatar name={name} url={url} className="h-10 w-10"/>}<span className="profile-photo-camera"><Camera className="h-2.5 w-2.5"/></span>
  </Button><input ref={input} aria-label="Profile photo file" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file); }}/></>;
}