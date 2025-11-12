import React, { useState } from "react";
import { signUpUser, confirmUser } from "./lib/cognito";

export default function Signup({ onSignupSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("signup");

  const handleSignup = () => {
    signUpUser(
      email,
      password,
      phone,
      () => {
        alert("Verification code sent to your email!");
        setStep("confirm");
      },
      (err) => alert(err.message)
    );
  };

  const handleConfirm = () => {
    confirmUser(
      email,
      code,
      () => {
        alert("Signup confirmed! You can now log in.");
        onSignupSuccess();
      },
      (err) => alert(err.message)
    );
  };

  return (
    <div className="signup-container" style={{ textAlign: "center", marginTop: 50 }}>
      {step === "signup" ? (
        <>
          <h2>Create a CloudDocs Account</h2>
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
          <input
            type="text"
            placeholder="Phone Number (+911234567890)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          /><br />
          <button onClick={handleSignup}>Sign Up</button>
        </>
      ) : (
        <>
          <h2>Confirm Your Account</h2>
          <input
            type="text"
            placeholder="Verification Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          /><br />
          <button onClick={handleConfirm}>Confirm</button>
        </>
      )}
    </div>
  );
}
