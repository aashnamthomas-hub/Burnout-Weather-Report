import { ImageResponse } from "next/og";

export const alt = "Burnout Weather Report: check your own weather before you plan the day";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The link preview: a clear sky, a low sun and the name, with no external images. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          background: "linear-gradient(to bottom, #6f9fd8, #d6e3f0)",
          color: "#17203a",
        }}
      >
        <div style={{ position: "absolute", left: 820, top: 70, width: 220, height: 220, borderRadius: 110, background: "#f2a541" }} />
        <div style={{ position: "absolute", left: 90, top: 90, width: 260, height: 90, borderRadius: 45, background: "rgba(255,255,255,0.85)" }} />
        <div style={{ position: "absolute", left: 150, top: 50, width: 120, height: 120, borderRadius: 60, background: "rgba(255,255,255,0.85)" }} />
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", padding: "0 80px 70px 80px" }}>
          <div style={{ fontSize: 80, lineHeight: 1.02, display: "flex" }}>Check your own weather</div>
          <div style={{ fontSize: 80, lineHeight: 1.02, display: "flex" }}>before you plan the day.</div>
          <div style={{ fontSize: 32, marginTop: 28, display: "flex" }}>Burnout Weather Report</div>
        </div>
        <div style={{ display: "flex", height: 70, padding: "0 80px", alignItems: "center", background: "#e9edf2", borderTop: "2px solid #17203a", fontSize: 24, color: "#4a5470" }}>
          A reflection tool, not medical advice. Your check-ins never leave this browser.
        </div>
      </div>
    ),
    { ...size },
  );
}
