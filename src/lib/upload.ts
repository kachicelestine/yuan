"use client";

/**
 * PUTs a file to a signed upload URL (storage, not our server, in production), reporting
 * progress as a fraction. fetch() can't report upload progress; XHR can.
 */
export function uploadFile(url: string, headers: Record<string, string>, file: Blob, onProgress?: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("The connection dropped during the upload."));
    xhr.send(file);
  });
}
