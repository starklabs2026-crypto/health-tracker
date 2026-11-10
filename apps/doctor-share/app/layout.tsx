import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    default: 'HealthFolio',
    template: '%s | HealthFolio',
  },
  description: 'HealthFolio personal health record support and privacy information.',
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
