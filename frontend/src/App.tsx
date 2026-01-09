export default function App() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Predix Debug</h1>
      <p>ENV VALUE:</p>
      <pre>
        {String(import.meta.env.VITE_PRIVY_APP_ID)}
      </pre>
    </div>
  );
}