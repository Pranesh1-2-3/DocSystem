import React, { useState } from "react";
import { loginUser } from "./lib/cognito";

export default function Login({ setToken, setToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      setToast("Please enter both email and password.", "error");
      return;
    }
    await loginUser(
      email,
      password,
      (token) => {
        localStorage.setItem("token", token);
        setToken(token);
        // No toast on success, the page will just change
      },
      (err) => setToast(err.message, "error") // Use toast for error
    );
  };

  return (
    // Remove the old wrapper div, just return the form elements
    <>
      <h2>Login to CloudDocs</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleLogin}>Login</button>
    </>
  );
}