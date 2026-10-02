import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#6f9fd8" }}>
        <div style={{ position: "absolute", left: 84, top: 22, width: 72, height: 72, borderRadius: 36, background: "#f2a541" }} />
        <div style={{ position: "absolute", left: 18, top: 96, width: 112, height: 46, borderRadius: 23, background: "#ffffff" }} />
        <div style={{ position: "absolute", left: 46, top: 72, width: 56, height: 56, borderRadius: 28, background: "#ffffff" }} />
      </div>
    ),
    { ...size },
  );
}
