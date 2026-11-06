import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { fontVariables } from '@/design-system/fonts';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: { default: 'Diwali House', template: '%s · Diwali House' },
  description:
    'A private, illustrated house party for Diwali. Invite your people, play together, and light the house.',
};

export const viewport: Viewport = {
  themeColor: '#0a0d27',
  colorScheme: 'dark',
};

/** Runs before first paint so CSS can tell "JS is coming" from "no JS". */
const MARK_JS = "document.documentElement.setAttribute('data-js','')";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MARK_JS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
