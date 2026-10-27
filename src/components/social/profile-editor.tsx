"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { uploadFile } from "@/lib/upload";
import { startAvatarAction, updateProfileAction } from "@/server/actions/social";

const MAX_NAME = 40;
const MAX_BIO = 160;

/** Name, handle, bio and photo: everything people see on your profile. */
export function ProfileEditor({ initial }: { initial: { handle: string; name: string; bio: string; avatar: string } }) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [handle, setHandle] = useState(initial.handle);
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [avatar, setAvatar] = useState(initial.avatar);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();

  async function pick(f: File | undefined) {
    if (!f) return;
    setError(null);
    setUploading(true);
    try {
      const ticket = await startAvatarAction({ contentType: f.type, bytes: f.size });
      if (!ticket.ok) return setError(ticket.message);
      await uploadFile(ticket.url, ticket.headers, f, () => {});
      setAvatar(ticket.photo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload didn't finish.");
    } finally {
      setUploading(false);
    }
  }

  const field = "glass-inset w-full rounded-2xl px-4 text-[15px] outline-none placeholder:text-ink-3";
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await updateProfileAction({ handle, name, bio, avatar });
          if (!r.ok) return setError(r.message);
          router.push(`/u/${r.handle}`);
        });
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <button type="button" onClick={() => file.current?.click()} disabled={uploading} aria-label="Change photo" className="relative size-24 overflow-hidden rounded-full ring-2 ring-white/15">
          {avatar ? (
            <Image src={avatar} alt="" fill sizes="96px" className="object-cover" />
          ) : (
            <span className="glass grid size-full place-items-center font-display text-4xl font-extrabold uppercase">{name.slice(0, 1) || "?"}</span>
          )}
          <span className="absolute inset-x-0 bottom-0 grid h-7 place-items-center bg-black/55 text-white">
            <Icon name="camera" className="size-4" />
          </span>
        </button>
        <span className="text-xs text-ink-2">{uploading ? "Uploading…" : "Tap to change your photo"}</span>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
        {avatar && (
          <button type="button" onClick={() => setAvatar("")} className="text-xs font-semibold text-ink-3">
            Remove photo
          </button>
        )}
      </div>

      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} required className={`${field} h-12`} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
        Handle
        <span className="relative">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[15px] text-ink-3">@</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
            maxLength={24}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            className={`${field} h-12 pl-8`}
          />
        </span>
        <span className="text-xs font-normal text-ink-3">Your page: /u/{handle || "…"}</span>
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
        Bio
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={MAX_BIO} rows={3} placeholder="What you post about, in a line or two" className={`${field} resize-none py-3`} />
        <span className="self-end text-xs font-normal text-ink-3">
          {bio.length}/{MAX_BIO}
        </span>
      </label>

      {error && (
        <p role="alert" className="text-sm text-like">
          {error}
        </p>
      )}
      <button type="submit" disabled={saving || uploading} className="h-12 rounded-full bg-accent text-[15px] font-bold text-white disabled:opacity-60">
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
