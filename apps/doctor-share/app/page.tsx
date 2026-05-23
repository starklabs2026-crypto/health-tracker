export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <h1 style={{ color: '#1F4E79' }}>Medical Tracker — Doctor Share</h1>
      <p>
        This site renders patient-shared medical summaries from a signed link. Open a valid
        <code> /share/&lt;token&gt; </code> URL provided by a patient.
      </p>
    </main>
  );
}
