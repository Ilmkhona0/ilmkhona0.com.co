"use client";

import { useState, useEffect } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// Tells Google (Analytics, Ads, AdSense) what the visitor agreed to.
// Safe to call even if no Google tag is loaded.
function updateConsent(granted: boolean) {
  const value = granted ? "granted" : "denied";
  window.gtag?.("consent", "update", {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  });
}

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
    updateConsent(true);
    setAccepted(true);
    setVisible(false);
  }
  function acceptNecessary() {
    localStorage.setItem("cookieConsent", "necessary");
    updateConsent(false);
    setAccepted(true);
    setVisible(false);
  }
  function closeBanner() {
    setVisible(false);
  }

  if (!visible || accepted) return null;

  return (
    <div className="cookie-banner">
      <span className="cookie-close" onClick={closeBanner} title="Close">
        &times;
      </span>
      <p>We use cookies to improve your experience. You can choose which cookies to accept.</p>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button onClick={acceptAll}>Accept all cookies</button>
        <button onClick={acceptNecessary}>Accept only necessary</button>
      </div>
    </div>
  );
}
