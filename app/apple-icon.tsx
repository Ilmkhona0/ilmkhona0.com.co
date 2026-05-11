import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 110,
          fontFamily: "Inter, Segoe UI, Arial, sans-serif",
          borderRadius: 36,
          position: "relative",
        }}
      >
        i
        <div
          style={{
            position: "absolute",
            top: 28,
            right: 28,
            width: 28,
            height: 28,
            borderRadius: 999,
            background: "linear-gradient(135deg, #ff6b6b, #ee5a52)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
