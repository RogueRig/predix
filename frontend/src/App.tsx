import { usePrivy } from "@privy-io/react-auth";

export default function App() {
  const { login, authenticated, user } = usePrivy();

  return (
    <div style={{ padding: 24 }}>
      <h1>Predix</h1>

      {!authenticated ? (
        <button onClick={login}>Login</button>
      ) : (
        <>
          <p>✅ Logged in</p>
          <pre>{JSON.stringify(user, null, 2)}</pre>
        </>
      )}
    </div>
  );
}