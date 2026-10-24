import { encode } from "uqr";

/** A QR code drawn as one SVG path: crisp at any size, no image request. */
export function QrCode({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const { data, size } = encode(value, { ecc: "M", border: 2 });
  let d = "";
  data.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x} ${y}h1v1h-1z`)));
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" className={`rounded-2xl bg-white ${className}`}>
      <path d={d} fill="#0b0b0e" />
    </svg>
  );
}
