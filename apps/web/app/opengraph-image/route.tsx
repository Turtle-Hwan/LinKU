import { ImageResponse } from "next/og";

const size = {
  width: 1200,
  height: 630,
};

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "#f5f8f4",
          color: "#17231b",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            alignSelf: "flex-start",
            borderRadius: 12,
            padding: "12px 20px",
            background: "#2c7f3e",
            color: "#ffffff",
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          LinKU
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ maxWidth: 980, fontSize: 76, lineHeight: 1.08, fontWeight: 700 }}>
            학교 사이트 찾는 시간은 줄이고.
          </div>
          <div style={{ maxWidth: 920, fontSize: 30, lineHeight: 1.4, color: "#667269" }}>
            eCampus, 학사정보, 도서관 좌석, 공지와 Todo를 한곳에서 시작하세요.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
