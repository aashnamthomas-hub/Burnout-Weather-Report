"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Achievement } from "@/lib/achievements";
import { dayCurve, type Report } from "@/lib/report";
import { CARD_HEIGHT, CARD_WIDTH, drawShareCard } from "@/lib/shareCard";
import { shareText } from "@/lib/share";
import type { Scores } from "@/lib/types";

type Props = {
  report: Report;
  scores: Scores;
  crash: number;
  racing: boolean;
  now: Date;
  streak: number;
  achievements: Achievement[];
};

const textButton = "inline-flex min-h-11 items-center px-1 text-base text-ink underline underline-offset-4 decoration-from-font hover:no-underline";
const primaryButton =
  "border border-isobar bg-low-sun px-6 py-3 text-lg text-isobar transition-opacity hover:opacity-90";
const secondaryButton =
  "border border-hairline bg-ground px-6 py-3 text-lg text-ink transition-colors hover:border-ink";

const isNight = () => {
  const theme = document.documentElement.dataset.theme;
  if (theme === "night") return true;
  if (theme === "day") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
};

/** "Share my forecast": a card drawn on a canvas, plus the text to go with it. */
export function ShareCard({ report, scores, crash, racing, now, streak, achievements }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("");
  // This only renders after the check-in is finished, so the browser is always available here.
  const [canShareFiles] = useState(() => {
    try {
      if (typeof navigator === "undefined") return false;
      const probe = new File([""], "probe.png", { type: "image/png" });
      return Boolean(navigator.canShare?.({ files: [probe] }));
    } catch {
      return false;
    }
  });
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));

  const text = shareText(report.headline, scores, achievements, origin || undefined);

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const serif = getComputedStyle(document.body).fontFamily || "Georgia, serif";
    const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-plex-mono").trim() || "ui-monospace, monospace";
    try {
      await Promise.all([document.fonts.load(`400 40px ${serif}`), document.fonts.load(`400 26px ${mono}`)]);
    } catch {
      // Fonts fall back to Georgia and a monospace face.
    }
    drawShareCard(ctx, {
      headline: report.headline,
      dateLine: now.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
      scores,
      racing,
      energyCurve: dayCurve(report.blocks, "energy"),
      focusCurve: dayCurve(report.blocks, "focus"),
      dipHour: report.blocks.find((b) => b.dipHour !== undefined)?.dipHour ?? null,
      crash,
      pressureLine: `Pressure ${report.pressure.value} · ${report.pressure.zone}`,
      streak,
      achievements,
      night: isNight(),
      host: window.location.host,
      fonts: { serif, mono },
    });
  }, [report, scores, crash, racing, now, streak, achievements]);

  // Draw on mount and whenever the day/night theme changes.
  useEffect(() => {
    void draw();
    const observer = new MutationObserver(() => void draw());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [draw]);

  const toBlob = () =>
    new Promise<Blob | null>((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      try {
        canvas.toBlob((blob) => resolve(blob), "image/png");
      } catch {
        resolve(null);
      }
    });

  const download = async () => {
    const blob = await toBlob();
    if (!blob) return setStatus("Couldn't make the image. Try copying the text instead.");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `burnout-weather-${now.toISOString().slice(0, 10)}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Image saved.");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Text copied.");
    } catch {
      setStatus("Couldn't copy. Select the text and copy it by hand.");
    }
  };

  const share = async () => {
    const blob = await toBlob();
    if (!blob) return setStatus("Couldn't make the image. Try downloading it instead.");
    try {
      await navigator.share({ files: [new File([blob], "my-forecast.png", { type: "image/png" })], text });
    } catch {
      // Closing the share sheet is not an error.
    }
  };

  const encoded = encodeURIComponent(text);

  return (
    <section aria-labelledby="share-title">
      <h3 id="share-title" className="text-2xl font-normal">Share my forecast</h3>
      <p className="mt-2 max-w-2xl text-base text-ink-soft text-pretty">
        A picture of today&apos;s sky and your four readings. It never includes your answers.
      </p>

      <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-12">
        <canvas
          ref={canvasRef}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          role="img"
          aria-label={`Forecast card. ${report.headline}`}
          className="h-auto w-full max-w-xs border border-hairline"
        />

        <div>
          {achievements.length > 0 && (
            <ul className="mb-6 divide-y divide-hairline border-y border-hairline">
              {achievements.map((a) => (
                <li key={a.id} className="flex items-baseline gap-3 py-3">
                  <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-full bg-low-sun" />
                  <span className="text-lg">{a.label}</span>
                  <span className="text-base text-ink-soft">{a.detail}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-3">
            {canShareFiles && (
              <button type="button" onClick={share} className={primaryButton}>
                Share
              </button>
            )}
            <button type="button" onClick={download} className={canShareFiles ? secondaryButton : primaryButton}>
              Download PNG
            </button>
            <button type="button" onClick={copy} className={secondaryButton}>
              Copy text
            </button>
          </div>

          <p className="mt-5 text-base text-ink-soft text-pretty">
            Post it where you like: save the image, then attach it.{" "}
            <a className={textButton} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encoded}`}>
              WhatsApp
            </a>
            {" · "}
            <a className={textButton} target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?text=${encoded}`}>
              X
            </a>
            <span className="block mt-1">These open with the text filled in. Nothing is posted until you do it.</span>
          </p>

          <p role="status" aria-live="polite" className="mt-3 min-h-6 font-mono text-sm">
            {status}
          </p>
        </div>
      </div>
    </section>
  );
}
