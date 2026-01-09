import { usePrivy } from "@privy-io/react-auth";

export default function App() {
  const { login, authenticated, user } = usePrivy();

  return (
    <div style={{ padding: 24 }}>
      {!authenticated ? (
        <button onClick={login}>Login to Predix</button>
      ) : (
        <>
          <h1>Welcome to Predix 🎉</h1>
          <p>User ID: {user?.id}</p>
        </>
      )}
    </div>
  );
}