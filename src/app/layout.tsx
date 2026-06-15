import type { Metadata, Viewport } from "next";
import { Figtree, Chonburi, Prompt, Nanum_Pen_Script } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  preload: true,
});

const chonburi = Chonburi({
  subsets: ["latin", "thai"],
  variable: "--font-chonburi",
  weight: "400",
  display: "swap",
  preload: false,
});

const prompt = Prompt({
  subsets: ["latin", "thai"],
  variable: "--font-prompt",
  weight: ["400", "600", "700"],
  display: "swap",
  preload: false,
});

const nanumPenScript = Nanum_Pen_Script({
  subsets: ["latin"],
  variable: "--font-nanum-pen",
  weight: "400",
  display: "swap",
  preload: false,
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://doodlewish.app";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  applicationName: "DoodleWish",
  title: {
    default: "DoodleWish — Wishes you can scribble together",
    template: "%s · DoodleWish",
  },
  description:
    "A collaborative birthday-card maker. Friends doodle a frame each on a shared cake; the recipient opens it as a stop-motion surprise.",
  keywords: [
    "birthday card",
    "collaborative gift",
    "group greeting card",
    "stop motion",
    "doodle",
  ],
  authors: [{ name: "DoodleWish" }],
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "DoodleWish",
    title: "Someone made you something",
    description: "Open to see a surprise from your friends.",
    url: baseUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "DoodleWish",
    description: "Wishes you can scribble together.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${chonburi.variable} ${prompt.variable} ${nanumPenScript.variable}`}
    >
      <body className="bg-dw-bg text-dw-fg font-figtree antialiased">
        <div className="dw-container">{children}</div>
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
      </body>
    </html>
  );
}
