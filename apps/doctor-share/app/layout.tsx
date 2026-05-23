import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Medical Tracker — Doctor Share',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          margin: 0,
          background: '#F7F9FC',
          color: '#1A1A1A',
        }}
      >
        {children}
      </body>
    </html>
  );
}
