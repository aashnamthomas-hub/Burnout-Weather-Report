import type { Metadata, Viewport } from "next";
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

const TITLE = "Burnout Weather Report";
const DESCRIPTION =
  "Check your own weather before you plan the day. A few quick questions, then a personal forecast for your energy, focus and mood, with plain advice. Free, no sign-up, and your answers never leave your browser.";

// Vercel provides the production domain at build time; locally it falls back to localhost.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: TITLE,
  openGraph: {
    type: "website",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9edf2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1428" },
  ],
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
          <a href="#main" className="skip-link">
            Skip to the check-in
          </a>
          <div className="relative z-10 flex min-h-svh flex-col">
            <SiteHeader />
            <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
              {children}
            </main>
            <SiteFooter />
          </div>
        </SkyProvider>
      </body>
    </html>
  );
}
