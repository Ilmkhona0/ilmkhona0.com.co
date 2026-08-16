"use client";

// Reusable Google AdSense ad unit.
//
// Usage (after creating an ad unit in your AdSense dashboard, which gives you a
// numeric slot id):
//   <AdSlot slot="1234567890" />
//
// Renders nothing until NEXT_PUBLIC_ADSENSE_CLIENT is set, so the site stays
// clean while AdSense is still under review.

import { useEffect } from "react";

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT; // e.g. "ca-pub-1234567890123456"

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export default function AdSlot({
  slot,
  format = "auto",
  responsive = true,
  style,
  className,
}: {
  slot: string;
  format?: string;
  responsive?: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  useEffect(() => {
    if (!CLIENT) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense script not ready / blocked — ignore.
    }
  }, []);

  if (!CLIENT) return null;

  return (
    <ins
      className={`adsbygoogle${className ? ` ${className}` : ""}`}
      style={style || { display: "block" }}
      data-ad-client={CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? "true" : "false"}
    />
  );
}
