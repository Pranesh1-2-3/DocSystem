import React, { useState } from "react";
import { signUpUser, confirmUser } from "./lib/cognito";

export default function Signup({ onSignupSuccess, setToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("signup");

  const handleSignup = () => {
    if (!email || !password || !phone) {
      setToast("Please fill in all fields.", "error");
      return;
    }
    signUpUser(
      email,
      password,
      phone,
      () => {
        setToast("Verification code sent to your email!", "success");
        setStep("confirm");
      },
      (err) => setToast(err.message, "error")
    );
  };

  const handleConfirm = () => {
    if (!code) {
      setToast("Please enter the verification code.", "error");
      return;
    }
    confirmUser(
      email,
      code,
      () => {
        setToast("Signup confirmed! You can now log in.", "success");
        onSignupSuccess();
      },
      (err) => setToast(err.message, "error")
    );
  };

  return (
    // Remove the old wrapper div, just return the form elements
    <>
      {step === "signup" ? (
        <>
          <h2>Create a CloudDocs Account</h2>
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
          <input
            type="text"
            placeholder="Phone Number (+911234567890)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
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
          />
          <button onClick={handleConfirm}>Confirm</button>
        </>
      )}
    </>
  );
}