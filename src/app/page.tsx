import { SkyDebugPanel } from "@/components/SkyDebugPanel";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-10 px-4 py-12 sm:px-8 lg:py-24">
      <div className="max-w-2xl text-sky-ink">
        <h1 className="text-4xl leading-[1.05] font-normal tracking-tight text-balance sm:text-6xl">
          Check your own weather before you plan the day.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty sm:text-xl">
          A few quick questions about sleep, food and how your head feels. Back
          comes a forecast for your energy, focus and mood, with plain advice
          for the hours ahead.
        </p>
      </div>
      <SkyDebugPanel />
    </div>
  );
}
