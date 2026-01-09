import { PrivyProvider } from "@privy-io/react-auth";

export function AppPrivyProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID}
      config={{
        loginMethods: ["wallet", "email"],
        appearance: {
          theme: "light",
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}