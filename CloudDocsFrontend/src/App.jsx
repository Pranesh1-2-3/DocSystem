import React, { useState } from "react";
import Login from "./login";
import Signup from "./signup";
import Dashboard from "./Dashboard";
import Toast from "./Toast";
import "./Auth.css"; // Import the new auth styles
import AuthVector from "./assets/auth-vector.svg"; // Import the new SVG

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [showSignup, setShowSignup] = useState(false);
  const [toast, setToast] = useState(null); // { message: '', type: 'success' | 'error' }

  const showToast = (message, type) => {
    setToast({ message, type });
  };

  if (!token) {
    return (
      <>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
        <div className="auth-page-wrapper">
          <div className="auth-left-panel">
            <div className="auth-form-window">
              {showSignup ? (
                <Signup
                  onSignupSuccess={() => setShowSignup(false)}
                  setToast={showToast}
                />
              ) : (
                <Login setToken={setToken} setToast={showToast} />
              )}
              <button
                onClick={() => setShowSignup((prev) => !prev)}
                className="auth-switch-button"
              >
                {showSignup
                  ? "Already have an account? Log in"
                  : "New user? Sign up"}
              </button>
            </div>
          </div>
          <div className="auth-right-panel">
            <div className="auth-right-panel-content">
              <h1 className="auth-title">Welcome to CloudDocs</h1>
              <p className="auth-subtitle">
                Your secure and simple solution for cloud document storage.
                Access your files anywhere, anytime.
              </p>
              <img
                src={AuthVector}
                alt="Cloud document illustration"
                className="auth-vector-art"
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  // Once logged in
  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <Dashboard token={token} setToken={setToken} setToast={showToast} />
    </>
  );
}