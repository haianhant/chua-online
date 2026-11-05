import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Noto_Serif, Be_Vietnam_Pro } from 'next/font/google';
import './globals.css';
import { SpeedInsights } from '@vercel/speed-insights/next';

// Vietnamese-subset fonts, loaded by Next itself: proper precomposed
// diacritics, no fallback-font breakage, no letter-spacing hacks.
const notoSerif = Noto_Serif({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '600', '700'],
  variable: '--font-noto-serif',
  display: 'swap',
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-be-vietnam',
  display: 'swap',
});

// viewport-fit=cover lets the HUD sit inside the iPhone / Messenger
// in-app browser notch and home-indicator areas, where the page then
// reads env(safe-area-inset-*) itself instead of being letterboxed.
// Zoom is deliberately NOT disabled, so users can still pinch-zoom text.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Chùa Hải An',
  description:
    'Chùa Hải An — không gian chùa 3D: đi dạo trong sân chùa, dâng hương cầu bình an, niệm Phật và hồi hướng.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${notoSerif.variable} ${beVietnamPro.variable}`}>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
