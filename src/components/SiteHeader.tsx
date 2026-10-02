import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-base font-medium tracking-tight whitespace-nowrap text-sky-ink sm:text-xl"
      >
        Burnout Weather Report
      </Link>
      <div className="flex items-center gap-3 sm:gap-6">
        <Link
          href="/week"
          className="inline-flex min-h-11 items-center px-1 font-mono text-sm whitespace-nowrap text-sky-ink underline-offset-4 hover:underline"
        >
          Your week
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
