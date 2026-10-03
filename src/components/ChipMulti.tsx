"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import type { Option } from "@/lib/questions";

type Props = {
  labelledBy: string;
  options: Option[];
  value: string[] | undefined;
  onChange: (next: string[]) => void;
  autoFocus?: boolean;
};

/** The id of an option that means "none of the above" and clears the others. */
const NONE = "nothing";

/** Chips you can switch on and off. Arrow keys move, Enter or Space toggles. */
export function ChipMulti({ labelledBy, options, value, onChange, autoFocus }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const chosen = value ?? [];

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus({ preventScroll: true });
  }, [autoFocus]);

  const toggle = (id: string) => {
    if (id === NONE) return onChange(chosen.includes(NONE) ? [] : [NONE]);
    const without = chosen.filter((v) => v !== NONE);
    onChange(without.includes(id) ? without.filter((v) => v !== id) : [...without, id]);
  };

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    refs.current[(index + step + options.length) % options.length]?.focus();
  };

  return (
    <div role="group" aria-labelledby={labelledBy} className="grid grid-cols-2 gap-2 sm:gap-3">
      {options.map((option, index) => {
        const on = chosen.includes(option.value);
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`min-h-12 border px-4 py-2.5 text-left text-base leading-snug transition-colors sm:min-h-14 sm:px-5 sm:py-3 sm:text-lg ${
              on ? "border-isobar bg-low-sun text-isobar" : "border-hairline bg-ground text-ink hover:border-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
