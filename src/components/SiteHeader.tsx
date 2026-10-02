import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-lg font-medium tracking-tight text-sky-ink sm:text-xl"
      >
        Burnout Weather Report
      </Link>
      <ThemeToggle />
    </header>
  );
}
