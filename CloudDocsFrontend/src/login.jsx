import React, { useState } from "react";
import { loginUser } from "./lib/cognito";

export default function Login({ setToken }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    await loginUser(
      email,
      password,
      (token) => {
        localStorage.setItem("token", token);
        setToken(token);
      },
      (err) => alert(err.message)
    );
  };

  return (
    <div className="login-container">
      <h2>Login to CloudDocs</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      /><br />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      /><br />
      <button onClick={handleLogin}>Login</button>
    </div>
  );
}
