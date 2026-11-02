const SALE_ENDS_AT = new Date('2026-12-01T00:00:00Z');

export function App() {
  return (
    <main>
      <h1>Winter sale</h1>
      <p>Ends {SALE_ENDS_AT.toLocaleDateString()}</p>
    </main>
  );
}
