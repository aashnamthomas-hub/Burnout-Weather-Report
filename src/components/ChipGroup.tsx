"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import type { Option } from "@/lib/questions";

type Props = {
  /** Id of the element that names this group (for screen readers). */
  labelledBy: string;
  options: Option[];
  value: string | undefined;
  onSelect: (value: string) => void;
  /** Focus the selected (or first) chip when the group appears. */
  autoFocus?: boolean;
};

/**
 * Large tap-to-select chips, built as a radio group. Arrow keys move between
 * chips, Enter or Space picks the focused one. Moving does not pick, because
 * picking a chip can advance the check-in.
 */
export function ChipGroup({ labelledBy, options, value, onSelect, autoFocus }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const tabStop = selectedIndex >= 0 ? selectedIndex : 0;

  // The check-in remounts this group for each question, so this runs once per question.
  useEffect(() => {
    if (autoFocus) refs.current[tabStop]?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  const move = (from: number, step: number) => {
    const to = (from + step + options.length) % options.length;
    refs.current[to]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        move(index, 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        move(index, -1);
        break;
      case "Home":
        e.preventDefault();
        refs.current[0]?.focus();
        break;
      case "End":
        e.preventDefault();
        refs.current[options.length - 1]?.focus();
        break;
    }
  };

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-3 sm:grid-cols-2">
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === tabStop ? 0 : -1}
            onClick={() => onSelect(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`min-h-14 border px-5 py-3 text-left text-lg leading-snug transition-colors ${
              checked
                ? "border-isobar bg-low-sun text-isobar"
                : "border-hairline bg-ground text-ink hover:border-ink"
            }`}
          >
            <span className="block">{option.label}</span>
            {option.hint && (
              <span className={`mt-0.5 block text-sm ${checked ? "text-isobar" : "text-ink-soft"}`}>
                {option.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
