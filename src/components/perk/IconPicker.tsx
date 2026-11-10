import { useRef } from "react";
import { Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { BRAND_OPTIONS, CATEGORY_ICON_OPTIONS, TxnIcon } from "./TxnIcon";
import { cn } from "@/lib/utils";

/** Resize an uploaded image to a 96px square webp data URL. */
async function toIconDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const size = 96, c = document.createElement("canvas"); c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    return c.toDataURL("image/webp", 0.85);
  } finally { URL.revokeObjectURL(url); }
}

export function IconPicker({ value, onChange, title = "" }: { value: string | null; onChange: (v: string | null) => void; title?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const opts = [...BRAND_OPTIONS, ...CATEGORY_ICON_OPTIONS];
  const tile = (active: boolean) => cn("flex flex-col items-center gap-1 rounded-xl p-1.5 text-[10px] transition hover:bg-muted", active && "bg-muted ring-2 ring-sky");

  return (
    <div className="grid grid-cols-5 gap-1">
      <button type="button" onClick={() => onChange(null)} className={tile(value === null)} title="Auto (detect from name)">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky text-primary-foreground"><Wand2 className="h-4 w-4" /></span>Auto
      </button>
      <button type="button" onClick={() => fileRef.current?.click()} className={tile(!!value?.startsWith("data:"))}>
        {value?.startsWith("data:") ? <TxnIcon icon={value} title={title} category="other" className="h-9 w-9" />
          : <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed"><Upload className="h-4 w-4" /></span>}
        Upload
      </button>
      {opts.map((o) => (
        <button type="button" key={o.value} onClick={() => onChange(o.value)} className={tile(value === o.value)}>
          <TxnIcon icon={o.value} title="" category="other" className="h-9 w-9" />
          <span className="w-full truncate text-center">{o.label}</span>
        </button>
      ))}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = "";
        if (!f) return;
        if (f.size > 5_000_000) { toast.error("Image is too large (max 5MB)"); return; }
        try { onChange(await toIconDataUrl(f)); } catch { toast.error("Couldn't read that image"); }
      }} />
    </div>
  );
}
