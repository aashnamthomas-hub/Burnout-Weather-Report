import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Favicon: a low sun behind a small cloud, on the clear-sky blue. */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#6f9fd8", borderRadius: 14 }}>
        <div style={{ position: "absolute", left: 30, top: 8, width: 26, height: 26, borderRadius: 13, background: "#f2a541" }} />
        <div style={{ position: "absolute", left: 6, top: 34, width: 40, height: 16, borderRadius: 8, background: "#ffffff" }} />
        <div style={{ position: "absolute", left: 16, top: 26, width: 20, height: 20, borderRadius: 10, background: "#ffffff" }} />
      </div>
    ),
    { ...size },
  );
}
