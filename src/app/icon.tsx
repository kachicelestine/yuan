import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

const sizes = [192, 512];

export function generateImageMetadata() {
  return sizes.map((s) => ({ id: String(s), size: { width: s, height: s }, contentType: "image/png" }));
}

// The app mark: a red seal with the brand's initial. Kept inside the maskable safe zone (80%).
export default async function Icon({ id }: { id: Promise<string | number> }) {
  const s = Number(await id);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 30% 20%, #ff7a52, #cc3a17 55%, #7a1f0b)" }}>
        <div
          style={{
            width: s * 0.56,
            height: s * 0.56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `${Math.round(s * 0.035)}px solid rgba(255,255,255,0.92)`,
            borderRadius: s * 0.14,
            color: "white",
            fontSize: s * 0.38,
            fontWeight: 700,
            letterSpacing: -s * 0.01,
          }}
        >
          {brand.name[0]}
        </div>
      </div>
    ),
    { width: s, height: s },
  );
}
