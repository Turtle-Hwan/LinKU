import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
          background:
            "linear-gradient(180deg, #132a22 0%, #1f4338 50%, #d8f279 160%)",
          color: "#f7f2e8",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 8, textTransform: "uppercase" }}>
          LinKU
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 82, lineHeight: 0.95 }}>Campus work, opened faster.</div>
          <div style={{ fontSize: 30, color: "rgba(247,242,232,0.78)" }}>
            Install guides, service landing pages, and path-based account routes on one canonical domain.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
