import type { CSSProperties } from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for the HealthFolio personal health record app.',
};

const SUPPORT_EMAIL = 'starklabs2026@gmail.com';

export default function PrivacyPage() {
  return (
    <main style={s.main}>
      <nav style={s.nav} aria-label="HealthFolio legal navigation">
        <Link href="/" style={s.brand}>
          HealthFolio
        </Link>
        <div style={s.navLinks}>
          <Link href="/support" style={s.navLink}>
            Support
          </Link>
        </div>
      </nav>

      <section style={s.hero}>
        <p style={s.kicker}>Privacy Policy</p>
        <h1 style={s.h1}>HealthFolio Privacy Policy</h1>
        <p style={s.lead}>
          HealthFolio is a personal health record app for storing, organizing, and sharing
          user-provided health documents and readings.
        </p>
        <p style={s.updated}>Last updated: May 31, 2026</p>
      </section>

      <section style={s.card}>
        <h2 style={s.h2}>Information We Collect</h2>
        <p style={s.p}>
          We collect information you provide or generate while using HealthFolio, including account
          identifiers, contact details, authentication information, health profile details, uploaded
          health documents, document metadata, extracted readings, manually entered readings, family
          profile information, doctor-share links, and support messages.
        </p>
        <p style={s.p}>
          If you use camera, photo library, document picker, biometric unlock, Apple sign-in, or
          Google sign-in features, HealthFolio uses those permissions only to provide the requested
          app functionality.
        </p>
      </section>

      <section style={s.card}>
        <h2 style={s.h2}>How We Use Information</h2>
        <p style={s.p}>
          We use information to create and secure your account, store and display your health
          records, process uploaded documents, extract health readings, show trends, manage family
          access, create limited doctor-share views, provide support, maintain app reliability, and
          protect against misuse.
        </p>
        <p style={s.p}>
          HealthFolio does not use your health data for advertising, and we do not sell your
          personal information.
        </p>
      </section>

      <section style={s.card}>
        <h2 style={s.h2}>Sharing And Disclosure</h2>
        <p style={s.p}>
          We share information only as needed to operate HealthFolio, including with service
          providers that host the app, store data, process authentication, store files, send
          messages, run OCR, or help us maintain security and reliability.
        </p>
        <p style={s.p}>
          Doctor-share links and family access are controlled by users inside the app. Anyone with a
          valid doctor-share link may be able to view the health summary included in that link until
          it expires, is revoked, or reaches its configured use limit.
        </p>
      </section>

      <section style={s.card}>
        <h2 style={s.h2}>Health Data And Medical Disclaimer</h2>
        <p style={s.p}>
          HealthFolio is for personal record keeping and organization. It is not a medical device,
          diagnostic tool, treatment recommendation system, emergency service, or substitute for
          professional medical advice. Always consult a qualified healthcare professional before
          making medical decisions.
        </p>
      </section>

      <section style={s.card}>
        <h2 style={s.h2}>Data Retention And Deletion</h2>
        <p style={s.p}>
          We retain account and health record information for as long as your account remains active
          or as needed to provide HealthFolio, comply with legal obligations, resolve disputes, and
          enforce agreements.
        </p>
        <p style={s.p}>
          You can delete your account from inside the HealthFolio app. Account deletion permanently
          removes your HealthFolio account and associated user data, including profile details,
          health documents, readings, family profiles you manage, doctor-share links, exports, and
          stored files. After deletion, HealthFolio does not store or retain your user data.
        </p>
        <p style={s.p}>
          You can also request data export, correction, or privacy help by contacting{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={s.link}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>

      <section style={s.card}>
        <h2 style={s.h2}>Security</h2>
        <p style={s.p}>
          We use administrative, technical, and organizational safeguards designed to protect
          personal and health information. No system can be guaranteed completely secure, so you
          should use a strong account sign-in method and keep your device protected.
        </p>
      </section>

      <section style={s.card}>
        <h2 style={s.h2}>Children</h2>
        <p style={s.p}>
          HealthFolio is not directed to children under 13. Family profile features are intended to
          be managed by a parent, guardian, or authorized caregiver where applicable.
        </p>
      </section>

      <section style={s.card}>
        <h2 style={s.h2}>Changes To This Policy</h2>
        <p style={s.p}>
          We may update this policy as HealthFolio changes. If we make material changes, we will
          update the effective date and may provide additional notice inside the app or through
          other appropriate channels.
        </p>
      </section>

      <section style={s.card}>
        <h2 style={s.h2}>Contact</h2>
        <p style={s.p}>
          For privacy questions or requests, contact{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={s.link}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>
    </main>
  );
}

const s: Record<string, CSSProperties> = {
  main: {
    maxWidth: 880,
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
  updated: {
    margin: '0.75rem 0 0',
    color: '#6B7C8F',
    fontSize: 14,
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
    margin: '0.7rem 0 0',
    color: '#2F3F4F',
    fontSize: 15,
    lineHeight: 1.7,
  },
  link: {
    color: '#0A5C68',
    fontWeight: 700,
  },
};
