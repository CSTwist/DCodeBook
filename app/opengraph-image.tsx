import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "DCodeBook — Code Snippet Knowledge Base";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 64,
          background: "linear-gradient(to bottom right, #1a1a2e, #16213e)",
          color: "#e0e0e0",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui",
          padding: 80,
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 700, marginBottom: 20 }}>DCodeBook</div>
        <div style={{ fontSize: 32, opacity: 0.8 }}>Save. Share. Ship snippets faster.</div>
      </div>
    ),
    { ...size }
  );
}
