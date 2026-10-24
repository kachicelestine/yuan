import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 30% 20%, #ff7a52, #cc3a17 55%, #7a1f0b)" }}>
        <div style={{ width: 104, height: 104, display: "flex", alignItems: "center", justifyContent: "center", border: "6px solid rgba(255,255,255,0.92)", borderRadius: 26, color: "white", fontSize: 70, fontWeight: 700 }}>{brand.name[0]}</div>
      </div>
    ),
    size,
  );
}
