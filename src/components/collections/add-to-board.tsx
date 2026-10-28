"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import type { BoardView } from "@/modules/engagement";
import { createBoardAction, setBoardItemAction } from "@/server/actions/boards";

/**
 * Right after saving something: put it on one of your boards, or start a new one with it.
 * Folded to one line until opened, so the sheet stays about the product.
 */
export function AddToBoard({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<BoardView[] | null>(null);
  const [signedIn, setSignedIn] = useState(true);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    if (!open || boards) return;
    let live = true;
    void fetch("/api/boards")
      .then((r) => (r.ok ? (r.json() as Promise<{ signedIn: boolean; boards: BoardView[] }>) : { signedIn: false, boards: [] }))
      .then((r) => {
        if (!live) return;
        setSignedIn(r.signedIn);
        setBoards(r.boards);
      })
      .catch(() => live && setBoards([]));
    return () => {
      live = false;
    };
  }, [open, boards]);

  const update = (b: BoardView) => setBoards((list) => [b, ...(list ?? []).filter((x) => x.id !== b.id)]);
  const run = (work: () => Promise<{ ok: true; board: BoardView } | { ok: false; message: string }>, after?: () => void) =>
    start(async () => {
      const r = await work();
      if (!r.ok) return setError(r.message);
      setError(null);
      update(r.board);
      after?.();
    });

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="glass-inset flex h-10 items-center justify-between rounded-full px-4 text-[13px] font-semibold">
        <span className="flex items-center gap-2">
          <Icon name="check" className="size-4 text-save" />
          Saved
        </span>
        <span className="flex items-center gap-1 text-ink-2">
          Add to a board
          <Icon name="forward" className="size-3.5" />
        </span>
      </button>
    );

  return (
    <section aria-label="Add to a board" className="glass-inset flex flex-col gap-2 rounded-[20px] p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold">Add to a board</h3>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-full text-ink-2">
          <Icon name="close" className="size-4" />
        </button>
      </div>
      {!signedIn ? (
        <p className="text-[13px] text-ink-2">
          <Link href="/signin?next=/" className="font-semibold text-ink underline underline-offset-2">
            Sign in
          </Link>{" "}
          to make boards and share them.
        </p>
      ) : boards === null ? (
        <span aria-hidden="true" className="skeleton h-10 rounded-2xl" />
      ) : (
        <>
          {boards.length > 0 && (
            <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {boards.map((b) => {
                const on = b.slugs.includes(slug);
                return (
                  <li key={b.id}>
                    <button type="button" aria-pressed={on} disabled={busy} onClick={() => run(() => setBoardItemAction(b.id, slug, !on))} className="flex w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left hover:bg-white/5 disabled:opacity-70">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{b.name}</span>
                        <span className="block text-xs text-ink-2">
                          {b.slugs.length} items{b.public ? "" : " · only you"}
                        </span>
                      </span>
                      <span className={`grid size-8 place-items-center rounded-full ${on ? "bg-white text-black" : "glass text-ink-2"}`}>
                        <Icon name={on ? "check" : "plus"} className="size-4" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) run(() => createBoardAction(name, true, slug), () => setName(""));
            }}
            className="flex items-center gap-2"
          >
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={boards.length ? "New board" : "Name your first board"} aria-label="New board name" className="glass h-10 min-w-0 flex-1 rounded-full px-4 text-sm outline-none placeholder:text-ink-3" />
            <button type="submit" disabled={busy || !name.trim()} className="h-10 shrink-0 rounded-full bg-white px-4 text-sm font-bold text-black disabled:opacity-50">
              Create
            </button>
          </form>
        </>
      )}
      {error && (
        <p role="alert" className="text-xs text-like">
          {error}
        </p>
      )}
    </section>
  );
}
