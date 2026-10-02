"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { BASELINE_SKY, type SkyState } from "@/lib/sky";
import { Sky } from "./Sky";

type SkyContextValue = {
  sky: SkyState;
  setSky: (next: SkyState) => void;
};

const SkyContext = createContext<SkyContextValue | null>(null);

/** Owns the current sky state and renders the full-page sky behind every page. */
export function SkyProvider({ children }: { children: ReactNode }) {
  const [sky, setSky] = useState<SkyState>(BASELINE_SKY);
  return (
    <SkyContext.Provider value={{ sky, setSky }}>
      <Sky state={sky} />
      {children}
    </SkyContext.Provider>
  );
}

export function useSky() {
  const ctx = useContext(SkyContext);
  if (!ctx) throw new Error("useSky must be used inside <SkyProvider>");
  return ctx;
}
