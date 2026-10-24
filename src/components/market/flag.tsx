import Image from "next/image";

/** A round country flag. Windows has no flag emoji, so flags are images (flagcdn.com for now). */
export function Flag({ code, className = "size-5" }: { code: string; className?: string }) {
  return (
    <Image
      src={`https://flagcdn.com/${code.toLowerCase()}.svg`}
      alt=""
      width={40}
      height={40}
      unoptimized
      className={`inline-block shrink-0 rounded-full object-cover ring-1 ring-white/20 ${className}`}
    />
  );
}
