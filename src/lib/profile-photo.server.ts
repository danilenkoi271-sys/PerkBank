export async function resolveProfilePhoto(url: string | null, storage: { from: (bucket: string) => { createSignedUrl: (path: string, duration: number) => Promise<{ data: { signedUrl: string } | null; error: unknown }> } }) {
  if (!url?.startsWith('perk-photo:')) return url;
  const { data, error } = await storage.from('profile-photos').createSignedUrl(url.slice('perk-photo:'.length), 3600);
  if (error || !data) return null;
  return data.signedUrl;
}