import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Overlay } from "./AppShell";
import loading from "@/assets/face-id-loading.mp4.asset.json";
import failed from "@/assets/face-id-failed.mp4.asset.json";
import success from "@/assets/face-id-success.mp4.asset.json";

type Props = { open: boolean; onSuccess: () => void; onCancel: () => void; successOnly?: boolean };
export function FaceId({ open, ...props }: Props) {
  return open ? <Overlay><FaceIdAttempt {...props} /></Overlay> : null;
}

function FaceIdAttempt({ onSuccess, onCancel, successOnly = false }: Omit<Props, "open">) {
  const [phase, setPhase] = useState<"loading" | "failed" | "success">(() => successOnly || Math.random() >= 0.2 ? "success" : "loading");
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const clips = { loading, failed, success };
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const endedRef = useRef(false);

  const advance = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (phase === "loading") setPhase("failed");
    else if (phase === "success") onSuccess();
    else setFinished(true);
  }, [phase, onSuccess]);

  // iOS Safari only autoplays when muted is set on the element itself before
  // play is attempted; if playback still stalls, the timer acts as a stand-in
  // for the clip ending so the flow can never get stuck.
  useEffect(() => {
    endedRef.current = false;
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    try { void v.play()?.catch(() => {}); } catch { /* playback not supported */ }
    let t: number | undefined;
    const arm = () => { if (!successOnly) t = window.setTimeout(advance, v.duration * 1000 + 1200); };
    if (v.readyState >= 1 && Number.isFinite(v.duration)) arm();
    else v.addEventListener("loadedmetadata", arm, { once: true });
    return () => { v.removeEventListener("loadedmetadata", arm); if (t !== undefined) clearTimeout(t); };
  }, [attempt, phase, advance, successOnly]);

  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onCancel]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div role="dialog" aria-label="Face ID" className="face-id-hud pointer-events-auto relative flex w-[156px] flex-col items-center rounded-3xl p-4 shadow-soft motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95">
        <Button variant="ghost" size="icon" aria-label="Cancel Face ID" title="Cancel Face ID" onClick={onCancel} className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-card text-card-foreground"><X /></Button>
        <div className="relative h-[88px] w-[88px] overflow-hidden rounded-xl">
            <video key={`${attempt}-${phase}`} ref={videoRef} src={clips[phase].url} preload="auto" muted playsInline autoPlay
              aria-label={`Face ID ${phase}`} className="absolute inset-0 h-full w-full object-contain"
              onError={() => setError(true)} onEnded={advance} />
        </div>
        <p role="status" className="mt-2 text-xs font-semibold">{error ? "Playback unavailable" : finished ? "Not Recognised" : "Face ID"}</p>
        {(finished || error) && <Button variant="ghost" onClick={() => { setAttempt(a => a + 1); setError(false); setFinished(false); setPhase("success"); }} className="mt-3 h-auto whitespace-normal rounded-full text-center text-xs text-white hover:bg-white/10 hover:text-white">Try Face ID Again</Button>}
      </div>
    </div>
  );
}
