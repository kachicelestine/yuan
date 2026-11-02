// Photos the browser shrinks before sending: a JPEG no bigger than `maxSide` on its longest side.

export type ShrunkPhoto = { url: string; data: string };

/** A camera frame or decoded image as a shrunk JPEG: a data URL to preview, and its base64 (no prefix). */
export function shrinkPhoto(source: CanvasImageSource, width: number, height: number, maxSide = 1024): ShrunkPhoto {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.8);
  return { url, data: url.slice(url.indexOf(",") + 1) };
}

/** A picked file as a shrunk JPEG; throws when the browser can't read it as an image. */
export async function photoFromFile(file: File, maxSide = 1024): Promise<ShrunkPhoto> {
  const bitmap = await createImageBitmap(file);
  try {
    return shrinkPhoto(bitmap, bitmap.width, bitmap.height, maxSide);
  } finally {
    bitmap.close();
  }
}

/** The JPEG's bytes, for uploading. */
export const photoBlob = (photo: ShrunkPhoto) => new Blob([Uint8Array.from(atob(photo.data), (c) => c.charCodeAt(0))], { type: "image/jpeg" });
