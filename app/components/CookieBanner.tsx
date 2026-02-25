"use client";

import { useState, useEffect } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(true);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("cookieConsent");
    if (stored === "all" || stored === "necessary") {
      setAccepted(true);
      setVisible(false);
    }
  }, []);

  function acceptAll() {
    localStorage.setItem("cookieConsent", "all");
    setAccepted(true);
    setVisible(false);
  }
  function acceptNecessary() {
    localStorage.setItem("cookieConsent", "necessary");
    setAccepted(true);
    setVisible(false);
  }
  function closeBanner() {
    setVisible(false);
  }

  if (!visible || accepted) return null;

  return (
    <div className="cookie-banner">
      <span className="cookie-close" onClick={closeBanner} title="Close">&times;</span>
      <p>We use cookies to improve your experience. You can choose which cookies to accept.</p>
      <div style={{ display: 'flex', gap: '10px', marginTop: 8 }}>
        <button onClick={acceptAll}>Accept all cookies</button>
        <button onClick={acceptNecessary}>Accept only necessary</button>
      </div>
    </div>
  );
}
