import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SkyProvider } from "@/components/SkyProvider";
import { storageKeyFor } from "@/lib/storage";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  fallback: ["ui-monospace", "Consolas", "monospace"],
});

export const metadata: Metadata = {
  title: "Burnout Weather Report",
  description:
    "Check your internal weather before you plan the day. A few quick questions, a personal forecast for energy, focus and mood.",
};

// Applies a saved day/night choice before first paint so the page never flashes
// the wrong sky. Storage may be blocked, so it fails silently.
const themeScript = `try{var t=JSON.parse(localStorage.getItem(${JSON.stringify(
  storageKeyFor("theme"),
)}));if(t==="day"||t==="night")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${plexMono.variable}`}
      // data-theme may be set by themeScript before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-svh">
        <SkyProvider>
          <div className="relative z-10 flex min-h-svh flex-col">
            <SiteHeader />
            <main className="flex flex-1 flex-col">{children}</main>
            <SiteFooter />
          </div>
        </SkyProvider>
      </body>
    </html>
  );
}
