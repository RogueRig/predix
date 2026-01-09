import fetch from "node-fetch";

export async function verifyPrivyToken(token) {
  const res = await fetch("https://auth.privy.io/api/v1/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${Buffer.from(
        `${process.env.PRIVY_APP_ID}:${process.env.PRIVY_APP_SECRET}`
      ).toString("base64")}`,
    },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    throw new Error("Invalid Privy token");
  }

  return await res.json();
}