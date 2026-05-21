import { ImageResponse } from "next/og";

// 192x192 PNG icon — used by Android home-screen shortcuts via site.webmanifest.
// Next.js serves this at /icon1 because of its filename.
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon192() {
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
          fontSize: 120,
          fontFamily: "Inter, Segoe UI, Arial, sans-serif",
          // No border-radius — Android will mask this itself for adaptive icons.
          position: "relative",
        }}
      >
        i
        <div
          style={{
            position: "absolute",
            top: 30,
            right: 30,
            width: 30,
            height: 30,
            borderRadius: 999,
            background: "linear-gradient(135deg, #ff6b6b, #ee5a52)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
