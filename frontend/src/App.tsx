import { BrowserRouter, Routes, Route } from "react-router-dom";

function Home() {
  return <h1>🏠 Predix Home</h1>;
}

function Login() {
  return <h1>🔐 Login</h1>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}