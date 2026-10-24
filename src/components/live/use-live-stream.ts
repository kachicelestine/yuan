"use client";

import { useEffect, useRef, useState } from "react";
import type { LotView, MessageView, ShowView } from "@/modules/live";

export type LiveState = {
  show: ShowView;
  messages: MessageView[];
  lots: LotView[];
  /** People watching on this server right now; null until the first count arrives. */
  viewers: number | null;
  /** Bumps on every heart, so the UI can float one. */
  hearts: number;
  connected: boolean;
};

const MAX_MESSAGES = 40;

/**
 * A live room's state, kept current over Server-Sent Events. The browser reconnects on its
 * own after a drop, and each connection starts with a fresh snapshot, so nothing is missed
 * for long.
 */
export function useLiveStream(initial: { show: ShowView; messages: MessageView[]; lots: LotView[] }): LiveState & { addMessage: (m: MessageView) => void; setLot: (l: LotView) => void } {
  const [state, setState] = useState<LiveState>({ ...initial, viewers: null, hearts: 0, connected: false });
  const id = initial.show.id;
  const seen = useRef(new Set(initial.messages.map((m) => m.id)));

  useEffect(() => {
    const source = new EventSource(`/api/live/${encodeURIComponent(id)}/stream`);
    source.onopen = () => setState((s) => ({ ...s, connected: true }));
    source.onerror = () => setState((s) => ({ ...s, connected: false }));
    source.onmessage = (e) => {
      const signal = JSON.parse(e.data) as { type: string } & Record<string, unknown>;
      setState((s) => {
        switch (signal.type) {
          case "snapshot": {
            const snap = signal as unknown as { show: ShowView; messages: MessageView[]; lots: LotView[] };
            for (const m of snap.messages) seen.current.add(m.id);
            return { ...s, show: snap.show, messages: snap.messages, lots: snap.lots };
          }
          case "show":
            return { ...s, show: signal.show as ShowView };
          case "message": {
            const m = signal.message as MessageView;
            if (seen.current.has(m.id)) return s;
            seen.current.add(m.id);
            return { ...s, messages: [...s.messages, m].slice(-MAX_MESSAGES) };
          }
          case "lot": {
            const lot = signal.lot as LotView;
            const has = s.lots.some((l) => l.id === lot.id);
            return { ...s, lots: has ? s.lots.map((l) => (l.id === lot.id ? lot : l)) : [...s.lots, lot] };
          }
          case "viewers":
            return { ...s, viewers: signal.count as number };
          case "heart":
            return { ...s, hearts: s.hearts + 1 };
          default:
            return s;
        }
      });
    };
    return () => source.close();
  }, [id]);

  return {
    ...state,
    addMessage: (m) => {
      if (seen.current.has(m.id)) return;
      seen.current.add(m.id);
      setState((s) => ({ ...s, messages: [...s.messages, m].slice(-MAX_MESSAGES) }));
    },
    setLot: (lot) => setState((s) => ({ ...s, lots: s.lots.map((l) => (l.id === lot.id ? lot : l)) })),
  };
}
