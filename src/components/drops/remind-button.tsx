"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

export function RemindButton({ label = "Remind me" }: { label?: string }) {
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => setOn((v) => !v)}
      className={`flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold transition-colors ${on ? "bg-positive/15 text-positive" : "bg-white text-black"}`}
    >
      <Icon name={on ? "check" : "bell"} className="size-4" strokeWidth={2.2} />
      {on ? "We'll ping you" : label}
    </button>
  );
}

