/** Sits on solid ground below the horizon on every page. */
export function SiteFooter() {
  return (
    <footer className="relative border-t border-hairline bg-ground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-6 text-base text-ink-soft sm:flex-row sm:justify-between sm:px-8">
        <p>A reflection tool, not medical advice.</p>
        <p>Your check-ins never leave this browser.</p>
      </div>
    </footer>
  );
}
