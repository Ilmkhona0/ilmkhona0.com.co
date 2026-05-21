import { ImageResponse } from "next/og";

// 512x512 PNG icon — used by Android home-screen shortcuts, splash screens,
// and PWA install prompts via site.webmanifest. Served at /icon2.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon512() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1d4ed8 0%, #0d47a1 100%)",
          color: "#ffffff",
          fontWeight: 800,
          fontSize: 320,
          fontFamily: "Inter, Segoe UI, Arial, sans-serif",
          position: "relative",
        }}
      >
        i
        <div
          style={{
            position: "absolute",
            top: 80,
            right: 80,
            width: 80,
            height: 80,
            borderRadius: 999,
            background: "linear-gradient(135deg, #ff6b6b, #ee5a52)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
