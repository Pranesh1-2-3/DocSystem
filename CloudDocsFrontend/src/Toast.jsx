import React, { useEffect } from 'react';
import './Toast.css';

export default function Toast({ message, type, onClose }) {
  useEffect(() => {
    // Set a timer to auto-close the toast after 5 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    // Cleanup function to clear the timer if the component unmounts
    return () => {
      clearTimeout(timer);
    };
  }, [onClose]);

  return (
    <div className={`toast ${type}`}>
      <span className="toast-message">{message}</span>
      <button className="toast-close-btn" onClick={onClose}>
        &times;
      </button>
    </div>
  );
}