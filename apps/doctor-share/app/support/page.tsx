import type { CSSProperties } from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Support',
  description: 'Support information for the HealthFolio personal health record app.',
};

const SUPPORT_EMAIL = 'starklabs2026@gmail.com';

export default function SupportPage() {
  return (
    <main style={s.main}>
      <nav style={s.nav} aria-label="HealthFolio support navigation">
        <Link href="/" style={s.brand}>
          HealthFolio
        </Link>
        <div style={s.navLinks}>
          <Link href="/privacy" style={s.navLink}>
            Privacy
          </Link>
        </div>
      </nav>

      <section style={s.hero}>
        <p style={s.kicker}>Support</p>
        <h1 style={s.h1}>HealthFolio Support</h1>
        <p style={s.lead}>
          Get help with account access, document uploads, health readings, family profiles, and
          doctor-share links.
        </p>
      </section>

      <section style={s.contactCard}>
        <div>
          <h2 style={s.contactTitle}>Contact Support</h2>
          <p style={s.p}>
            Email us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={s.link}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </div>
        <a href={`mailto:${SUPPORT_EMAIL}`} style={s.button}>
          Email Support
        </a>
      </section>

      <section style={s.grid}>
        <article style={s.card}>
          <h2 style={s.h2}>Account Access</h2>
          <p style={s.p}>
            If you cannot sign in, include the email address or phone number used for your
            HealthFolio account and describe what happens after requesting your sign-in code.
          </p>
        </article>

        <article style={s.card}>
          <h2 style={s.h2}>Documents And OCR</h2>
          <p style={s.p}>
            For upload or extraction issues, include the document type, file format, approximate
            upload time, and whether the issue happened with camera, photo library, or file upload.
          </p>
        </article>

        <article style={s.card}>
          <h2 style={s.h2}>Health Readings</h2>
          <p style={s.p}>
            For incorrect or missing readings, include the parameter name, date, unit, and a short
            description of the expected result.
          </p>
        </article>

        <article style={s.card}>
          <h2 style={s.h2}>Family And Sharing</h2>
          <p style={s.p}>
            For family profile or doctor-share link issues, include the invite or share flow you
            used, but do not send sensitive health details unless support asks for them.
          </p>
        </article>
      </section>

      <section style={s.card}>
        <h2 style={s.h2}>Privacy And Data Requests</h2>
        <p style={s.p}>
          To request account deletion, data export, correction, or privacy help, contact{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={s.link}>
            {SUPPORT_EMAIL}
          </a>
          . Use the subject line “HealthFolio Privacy Request” so we can route it correctly.
        </p>
      </section>

      <section style={s.card}>
        <h2 style={s.h2}>Emergency Notice</h2>
        <p style={s.p}>
          HealthFolio does not provide emergency services, diagnosis, treatment advice, or clinical
          decision support. If you are experiencing a medical emergency, contact local emergency
          services or a qualified healthcare professional immediately.
        </p>
      </section>
    </main>
  );
}

const s: Record<string, CSSProperties> = {
  main: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '2rem 1.25rem 4rem',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: '1.25rem',
    borderBottom: '1px solid #DEE5EC',
  },
  brand: {
    color: '#0A5C68',
    fontSize: 20,
    fontWeight: 800,
    textDecoration: 'none',
  },
  navLinks: {
    display: 'flex',
    gap: 16,
  },
  navLink: {
    color: '#1F4E79',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
  },
  hero: {
    padding: '3rem 0 1.25rem',
  },
  kicker: {
    margin: '0 0 0.5rem',
    color: '#0A5C68',
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  h1: {
    margin: 0,
    color: '#102A43',
    fontSize: 38,
    lineHeight: 1.12,
    letterSpacing: 0,
  },
  lead: {
    maxWidth: 720,
    margin: '1rem 0 0',
    color: '#415466',
    fontSize: 17,
    lineHeight: 1.65,
  },
  contactCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    background: '#FFFFFF',
    border: '1px solid #BFD7D9',
    borderRadius: 8,
    padding: '1.35rem',
    marginTop: '1rem',
  },
  contactTitle: {
    margin: 0,
    color: '#0A5C68',
    fontSize: 20,
    letterSpacing: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 16,
    marginTop: '1rem',
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #DEE5EC',
    borderRadius: 8,
    padding: '1.25rem',
    marginTop: '1rem',
  },
  h2: {
    margin: '0 0 0.75rem',
    color: '#1F4E79',
    fontSize: 18,
    lineHeight: 1.3,
    letterSpacing: 0,
  },
  p: {
    margin: '0.65rem 0 0',
    color: '#2F3F4F',
    fontSize: 15,
    lineHeight: 1.7,
  },
  link: {
    color: '#0A5C68',
    fontWeight: 700,
  },
  button: {
    flex: '0 0 auto',
    borderRadius: 8,
    background: '#0A5C68',
    color: '#FFFFFF',
    padding: '0.78rem 1rem',
    fontSize: 14,
    fontWeight: 800,
    textDecoration: 'none',
  },
};
