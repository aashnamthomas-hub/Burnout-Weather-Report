"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import {
  BASELINE_SKY,
  DARK_SKY_STORM,
  deriveSky,
  type SkyParams,
  type SkyState,
} from "@/lib/sky";

/* ---------- Static scenery (deterministic, so server and client match) ---------- */

type Shape = {
  circles: [cx: number, cy: number, r: number][];
  base: [x: number, y: number, w: number, h: number];
};

const SHAPES: Shape[] = [
  { circles: [[0, 10, 38], [48, -12, 52], [104, -2, 44], [146, 16, 30]], base: [-24, 10, 200, 38] },
  { circles: [[0, 8, 30], [40, -18, 46], [92, -30, 58], [150, -6, 42], [190, 12, 28]], base: [-20, 8, 236, 34] },
  { circles: [[0, 6, 26], [34, -10, 38], [76, 0, 30]], base: [-18, 6, 118, 28] },
];

const SHAPE_WIDTH = SHAPES.map((s) => {
  const right = Math.max(...s.circles.map(([cx, , r]) => cx + r), s.base[0] + s.base[2]);
  const left = Math.min(...s.circles.map(([cx, , r]) => cx - r), s.base[0]);
  return right - left;
});

type CloudSpec = {
  shape: number;
  y: number; // fraction of viewport height
  x: number; // starting fraction of viewport width
  scale: number;
  speed: number; // parallax factor
  threshold: number; // cover level at which this cloud fades in
};

// Ordered by threshold: more cloud cover reveals more (and bigger, nearer) clouds.
const CLOUDS: CloudSpec[] = [
  { shape: 0, y: 0.16, x: 0.08, scale: 1.0, speed: 0.6, threshold: 0 },
  { shape: 2, y: 0.3, x: 0.55, scale: 0.9, speed: 0.5, threshold: 0 },
  { shape: 1, y: 0.1, x: 0.38, scale: 1.2, speed: 0.8, threshold: 0.2 },
  { shape: 0, y: 0.42, x: 0.82, scale: 0.8, speed: 0.45, threshold: 0.3 },
  { shape: 2, y: 0.22, x: 0.68, scale: 1.3, speed: 0.9, threshold: 0.4 },
  { shape: 1, y: 0.34, x: 0.2, scale: 1.5, speed: 1.1, threshold: 0.5 },
  { shape: 0, y: 0.06, x: 0.9, scale: 1.6, speed: 1.2, threshold: 0.6 },
  { shape: 1, y: 0.48, x: 0.48, scale: 1.1, speed: 0.7, threshold: 0.7 },
  { shape: 2, y: 0.14, x: 0.02, scale: 1.8, speed: 1.3, threshold: 0.8 },
  { shape: 0, y: 0.28, x: 0.6, scale: 1.9, speed: 1.4, threshold: 0.88 },
];

const STORM_CLOUDS: CloudSpec[] = [
  { shape: 1, y: 0.02, x: 0.0, scale: 3.2, speed: 0.5, threshold: 0 },
  { shape: 0, y: 0.07, x: 0.36, scale: 3.4, speed: 0.55, threshold: 0.2 },
  { shape: 1, y: 0.03, x: 0.7, scale: 3.0, speed: 0.5, threshold: 0.4 },
  { shape: 0, y: 0.15, x: 0.14, scale: 2.6, speed: 0.6, threshold: 0.6 },
  { shape: 1, y: 0.13, x: 0.56, scale: 2.8, speed: 0.65, threshold: 0.75 },
];

const STREAKS = [0.12, 0.2, 0.31, 0.38, 0.47, 0.56, 0.64].map((y, i) => ({
  y,
  x: (i * 0.37) % 1,
  length: 90 + ((i * 53) % 70),
}));

// Small seeded PRNG so the star field is identical on every render.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(7);
const STARS = Array.from({ length: 80 }, (_, i) => ({
  x: (rand() * 100).toFixed(2),
  y: (rand() * 62).toFixed(2),
  r: (0.5 + rand() * 1.1).toFixed(2),
  twinkle: i % 3 === 0,
  delay: (rand() * 4).toFixed(2),
}));

/* ---------- Helpers ---------- */

const PARAM_KEYS: (keyof SkyParams)[] = ["sun", "fog", "wind", "storm", "rain", "gloom", "cover", "stars"];

// The sky starts at the baseline; the animation loop takes over after mount.
const INITIAL_PARAMS = deriveSky(BASELINE_SKY);
const INITIAL_VARS = Object.fromEntries(
  PARAM_KEYS.map((k) => [`--${k}`, INITIAL_PARAMS[k].toFixed(3)]),
) as CSSProperties;

/** Opacity that fades a cloud in once `variable` passes `threshold`. */
const fadeIn = (variable: string, threshold: number, max = 1) =>
  `calc(clamp(0, calc((var(${variable}) - ${threshold}) / 0.15), 1) * ${max})`;

function Cloud({ shape, fill }: { shape: Shape; fill: string }) {
  return (
    <>
      {shape.circles.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} style={{ fill }} />
      ))}
      <rect
        x={shape.base[0]}
        y={shape.base[1]}
        width={shape.base[2]}
        height={shape.base[3]}
        rx={shape.base[3] / 2}
        style={{ fill }}
      />
    </>
  );
}

const CLOUD_FILL =
  "color-mix(in oklab, color-mix(in oklab, var(--cloud), var(--cloud-grey) calc(var(--gloom) * 100%)), var(--storm-cloud) calc(var(--storm) * 45%))";

/* ---------- Component ---------- */

export function Sky({ state }: { state: SkyState }) {
  const reducedMotion = usePrefersReducedMotion();

  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const sunRef = useRef<SVGGElement>(null);
  const cloudRefs = useRef<(SVGGElement | null)[]>([]);
  const stormRefs = useRef<(SVGGElement | null)[]>([]);
  const streakRefs = useRef<(SVGPathElement | null)[]>([]);
  const fogRefs = useRef<(HTMLDivElement | null)[]>([]);

  const targetRef = useRef<SkyParams>(INITIAL_PARAMS);
  const wakeRef = useRef<() => void>(() => {});

  // New scores only move the target; the loop eases the sky toward it.
  useEffect(() => {
    targetRef.current = deriveSky(state);
    wakeRef.current();
  }, [state]);

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const onResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      wakeRef.current();
    };
    window.addEventListener("resize", onResize);

    const cloudX = CLOUDS.map((c) => c.x * width);
    const stormX = STORM_CLOUDS.map((c) => c.x * width);
    const streakX = STREAKS.map((s) => s.x * width);
    const current: SkyParams = { ...targetRef.current };
    let skyDark: boolean | null = null;
    let frame = 0;
    let last = performance.now();
    let elapsed = 0;

    const moveClouds = (
      specs: CloudSpec[],
      xs: number[],
      refs: (SVGGElement | null)[],
      distance: number,
      size: number,
    ) => {
      specs.forEach((c, i) => {
        const scale = c.scale * size;
        const w = SHAPE_WIDTH[c.shape] * scale;
        xs[i] += distance * c.speed;
        if (xs[i] > width + w) xs[i] = -w;
        refs[i]?.setAttribute(
          "transform",
          `translate(${xs[i].toFixed(1)} ${(c.y * height).toFixed(1)}) scale(${scale.toFixed(3)})`,
        );
      });
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;

      // Ease each parameter toward its target (instantly with reduced motion).
      const target = targetRef.current;
      const ease = reducedMotion ? 1 : 1 - Math.exp(-dt * 1.8);
      let settled = true;
      for (const key of PARAM_KEYS) {
        const diff = target[key] - current[key];
        if (Math.abs(diff) > 0.001) settled = false;
        current[key] += diff * ease;
        root.style.setProperty(`--${key}`, current[key].toFixed(3));
      }

      const dark = current.storm > DARK_SKY_STORM;
      if (dark !== skyDark) {
        skyDark = dark;
        document.documentElement.toggleAttribute("data-sky-dark", dark);
      }

      // Wind sets the drift speed (px per second); motion stops entirely when reduced.
      const speed = reducedMotion ? 0 : 10 + current.wind * 150;
      const distance = speed * dt;
      const size = Math.min(1.2, Math.max(0.55, width / 1400));

      moveClouds(CLOUDS, cloudX, cloudRefs.current, distance, size);
      moveClouds(STORM_CLOUDS, stormX, stormRefs.current, distance, size);

      STREAKS.forEach((s, i) => {
        streakX[i] += distance * 2.6;
        if (streakX[i] > width + s.length) streakX[i] = -s.length;
        streakRefs.current[i]?.setAttribute(
          "transform",
          `translate(${streakX[i].toFixed(1)} ${(s.y * height).toFixed(1)})`,
        );
      });

      // A tired sun sits lower in the sky.
      const sunX = width * (width < 640 ? 0.72 : 0.76);
      const sunY = height * (0.18 + 0.2 * (1 - current.sun));
      sunRef.current?.setAttribute("transform", `translate(${sunX.toFixed(1)} ${sunY.toFixed(1)})`);

      fogRefs.current.forEach((el, i) => {
        if (!el) return;
        const sway = reducedMotion ? 0 : Math.sin(elapsed * 0.05 + i * 2.1) * width * 0.06;
        el.style.transform = `translate3d(${sway.toFixed(1)}px, -50%, 0)`;
      });

      svg.dataset.ready = "true";

      // With reduced motion nothing drifts, so stop once the sky has settled.
      frame = reducedMotion && settled ? 0 : requestAnimationFrame(tick);
    };

    wakeRef.current = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    wakeRef.current();

    return () => {
      cancelAnimationFrame(frame);
      frame = 0;
      wakeRef.current = () => {};
      window.removeEventListener("resize", onResize);
      document.documentElement.removeAttribute("data-sky-dark");
    };
  }, [reducedMotion]);

  return (
    <div ref={rootRef} className="sky" style={INITIAL_VARS} aria-hidden="true">
      <svg ref={svgRef} className="sky-scene" width="100%" height="100%">
        <defs>
          <radialGradient id="sun-glow">
            <stop offset="0%" style={{ stopColor: "var(--low-sun)", stopOpacity: 0.55 }} />
            <stop offset="100%" style={{ stopColor: "var(--low-sun)", stopOpacity: 0 }} />
          </radialGradient>
          <radialGradient id="moon-glow">
            <stop offset="0%" style={{ stopColor: "var(--haze)", stopOpacity: 0.22 }} />
            <stop offset="100%" style={{ stopColor: "var(--haze)", stopOpacity: 0 }} />
          </radialGradient>
          <mask id="moon-crescent">
            <circle r="34" fill="white" />
            <circle cx="14" cy="-10" r="30" fill="black" />
          </mask>
        </defs>

        <g className="night-only" style={{ opacity: "var(--stars)" }}>
          {STARS.map((s, i) => (
            <circle
              key={i}
              cx={`${s.x}%`}
              cy={`${s.y}%`}
              r={s.r}
              className={s.twinkle ? "star star-twinkle" : "star"}
              style={s.twinkle ? { animationDelay: `${s.delay}s` } : undefined}
            />
          ))}
        </g>

        <g ref={sunRef}>
          <g className="day-only">
            <circle r="210" fill="url(#sun-glow)" style={{ opacity: "calc(var(--sun) * 0.9)" }} />
            <circle
              r="56"
              style={{
                fill: "color-mix(in oklab, var(--low-sun), var(--fog-color) calc((1 - var(--sun)) * 75%))",
                opacity: "calc(0.35 + var(--sun) * 0.65)",
              }}
            />
          </g>
          <g className="night-only" style={{ opacity: "calc(0.4 + var(--sun) * 0.6)" }}>
            <circle r="150" fill="url(#moon-glow)" />
            <circle r="34" mask="url(#moon-crescent)" style={{ fill: "var(--haze)" }} />
          </g>
        </g>

        {CLOUDS.map((c, i) => (
          <g
            key={i}
            ref={(el) => {
              cloudRefs.current[i] = el;
            }}
            style={{ opacity: fadeIn("--cover", c.threshold, 0.55 + c.speed * 0.3) }}
          >
            <Cloud shape={SHAPES[c.shape]} fill={CLOUD_FILL} />
          </g>
        ))}

        {STORM_CLOUDS.map((c, i) => (
          <g
            key={i}
            ref={(el) => {
              stormRefs.current[i] = el;
            }}
            style={{ opacity: fadeIn("--storm", c.threshold, 0.92) }}
          >
            <Cloud shape={SHAPES[c.shape]} fill="var(--storm-cloud)" />
          </g>
        ))}

        <g style={{ opacity: "calc(var(--wind) * 0.6)" }}>
          {STREAKS.map((s, i) => (
            <path
              key={i}
              ref={(el) => {
                streakRefs.current[i] = el;
              }}
              d={`M0 0 C ${s.length * 0.3} -6, ${s.length * 0.65} 6, ${s.length} 0`}
              className="wind-streak"
            />
          ))}
        </g>
      </svg>

      <div className="sky-rain" />
      {[0.28, 0.5, 0.72].map((top, i) => (
        <div
          key={i}
          ref={(el) => {
            fogRefs.current[i] = el;
          }}
          className="sky-fog-band"
          style={{ top: `${top * 100}%` }}
        />
      ))}
      <div className="sky-fog-veil" />
      <div className="sky-dim" />
    </div>
  );
}
