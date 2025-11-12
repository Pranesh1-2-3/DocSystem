import React, { useState } from "react";
import Login from "./login";
import Signup from "./signup";
import Dashboard from "./Dashboard";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [showSignup, setShowSignup] = useState(false);

  if (!token) {
    return (
      <div className="auth-container" style={{ textAlign: "center", marginTop: 80 }}>
        {showSignup ? (
          <Signup onSignupSuccess={() => setShowSignup(false)} />
        ) : (
          <Login setToken={setToken} />
        )}
        <button
          onClick={() => setShowSignup((prev) => !prev)}
          style={{
            marginTop: 20,
            background: "transparent",
            border: "none",
            color: "#0078d4",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {showSignup ? "Already have an account? Log in" : "New user? Sign up"}
        </button>
      </div>
    );
  }

  // Once logged in
  return <Dashboard token={token} setToken={setToken} />;
}
