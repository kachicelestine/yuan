import { ok, type ObjectStorage, type Result } from "@/shared/kernel";
import type { EncodeError, VideoEncoder } from "../application/uploads";
import type { VideoEncoded } from "../domain/video";

/**
 * For development machines without ffmpeg: the upload itself becomes the only rendition
 * and the product photo stands in for a poster. Browsers play MP4 and WebM as they are.
 */
export class CopyEncoder implements VideoEncoder {
  constructor(private readonly storage: Pick<ObjectStorage, "publicUrl">) {}

  async encode(input: { videoId: string; sourceKey: string }): Promise<Result<VideoEncoded, EncodeError>> {
    return ok({
      posterUrl: "",
      renditions: [{ height: 720, url: this.storage.publicUrl(input.sourceKey), bitrateKbps: 0 }],
      durationMs: 0,
      tone: "dark",
    });
  }
}
