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
const isShort = (o: Option) => !o.hint && o.label.length <= 16;

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
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      // Short answers sit two to a row on a phone so a question fits on one screen.
      className={`grid gap-2 sm:gap-3 sm:grid-cols-2 ${options.every(isShort) ? "grid-cols-2" : ""}`}
    >
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
            className={`min-h-12 border px-4 py-2.5 text-left text-base leading-snug sm:min-h-14 sm:px-5 sm:py-3 sm:text-lg transition-colors ${
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
