import { usePrivy } from "@privy-io/react-auth";

export default function App() {
  const { login, logout, authenticated, user } = usePrivy();

  return (
    <div style={{ padding: 24 }}>
      {!authenticated ? (
        <button onClick={login}>Login to Predix</button>
      ) : (
        <>
          <p>Logged in as: {user?.id}</p>
          <button onClick={logout}>Logout</button>
        </>
      )}
    </div>
  );
}