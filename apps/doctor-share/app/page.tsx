import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <h1 style={{ color: '#1F4E79' }}>HealthFolio</h1>
      <p>
        This site renders patient-shared medical summaries from a signed link. Open a valid
        <code> /share/&lt;token&gt; </code> URL provided by a patient.
      </p>
      <p style={{ marginTop: '1.5rem' }}>
        <Link href="/privacy" style={{ color: '#0A5C68', fontWeight: 700 }}>
          Privacy Policy
        </Link>
        <span style={{ color: '#8A9BB0', margin: '0 0.75rem' }}>|</span>
        <Link href="/support" style={{ color: '#0A5C68', fontWeight: 700 }}>
          Support
        </Link>
      </p>
    </main>
  );
}
