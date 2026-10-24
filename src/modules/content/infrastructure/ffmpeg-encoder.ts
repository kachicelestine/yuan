import { execFile } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { domainError, err, ok, type ObjectStorage, type Result } from "@/shared/kernel";
import type { EncodeError, VideoEncoder } from "../application/uploads";
import { MAX_DURATION_MS, type Rendition, type VideoEncoded } from "../domain/video";

const run = promisify(execFile);

/** Sizes we encode, by the short side (a 9:16 phone clip at "720" is 720×1280), and their bitrate caps. */
const LADDER = [
  { size: 720, maxKbps: 2500 },
  { size: 480, maxKbps: 1200 },
] as const;
/** Bright footage (average luma above this, 0–255) gets darker glass over it. */
const LIGHT_LUMA = 150;

type Probe = { width: number; height: number; durationMs: number };

/**
 * Encodes uploads with ffmpeg: H.264/AAC MP4 renditions with the index at the front
 * (so playback starts before the whole file arrives), a JPEG poster from the first
 * second, and whether the footage is bright. MP4 rather than HLS keeps the player a
 * plain <video> element with no streaming library to download.
 */
export class FfmpegEncoder implements VideoEncoder {
  constructor(private readonly options: { storage: ObjectStorage; ffmpeg?: string; ffprobe?: string; threads?: number }) {}

  private get ffmpeg() {
    return this.options.ffmpeg ?? "ffmpeg";
  }

  async encode(input: { videoId: string; sourceKey: string; contentType: string }): Promise<Result<VideoEncoded, EncodeError>> {
    const { storage } = this.options;
    const dir = await mkdtemp(join(tmpdir(), "lychee-encode-"));
    try {
      const source = join(dir, "source");
      await storage.download(input.sourceKey, source);

      const probed = await this.probe(source);
      if (!probed.ok) return probed;
      const { width, height, durationMs } = probed.value;
      if (durationMs > MAX_DURATION_MS) return err(domainError("too_long", `Videos can be up to ${MAX_DURATION_MS / 60_000} minutes.`));

      // Never upscale: a 540p upload gets a 480 rendition, plus itself if nothing fits.
      const short = Math.min(width, height);
      const sizes = LADDER.filter((r) => r.size <= short);
      const ladder = sizes.length ? sizes : [{ size: short - (short % 2), maxKbps: 1200 }];

      const renditions: Rendition[] = [];
      for (const r of ladder) {
        const out = join(dir, `${r.size}.mp4`);
        await this.transcode(source, out, r.size, r.maxKbps, width > height);
        const key = `videos/${input.videoId}/${r.size}.mp4`;
        await storage.upload(key, out, "video/mp4");
        const bytes = (await stat(out)).size;
        renditions.push({ height: r.size, url: storage.publicUrl(key), bitrateKbps: Math.round((bytes * 8) / Math.max(1, durationMs)) });
      }

      const poster = join(dir, "poster.jpg");
      await run(this.ffmpeg, ["-v", "error", "-ss", durationMs > 1500 ? "1" : "0", "-i", source, "-frames:v", "1", "-vf", this.scale(720, width > height), "-q:v", "4", "-y", poster]);
      const posterKey = `videos/${input.videoId}/poster.jpg`;
      await storage.upload(posterKey, poster, "image/jpeg");

      return ok({ posterUrl: storage.publicUrl(posterKey), renditions, durationMs, tone: (await this.luma(poster)) > LIGHT_LUMA ? "light" : "dark" });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /** Scale so the short side is `size`, keeping the aspect (and even dimensions). */
  private scale(size: number, landscape: boolean) {
    return landscape ? `scale=-2:${size}` : `scale=${size}:-2`;
  }

  private async probe(file: string): Promise<Result<Probe, EncodeError>> {
    let out: string;
    try {
      ({ stdout: out } = await run(this.options.ffprobe ?? "ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file]));
    } catch {
      return err(domainError("unreadable", "That file couldn't be read as a video."));
    }
    const info = JSON.parse(out) as { streams?: { width?: number; height?: number }[]; format?: { duration?: string } };
    const stream = info.streams?.[0];
    if (!stream?.width || !stream.height) return err(domainError("no_video", "That file has no video in it."));
    return ok({ width: stream.width, height: stream.height, durationMs: Math.round(Number(info.format?.duration ?? 0) * 1000) });
  }

  private async transcode(source: string, out: string, size: number, maxKbps: number, landscape: boolean) {
    await run(
      this.ffmpeg,
      [
        "-v", "error",
        "-i", source,
        "-vf", this.scale(size, landscape),
        "-fpsmax", "30",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-maxrate", `${maxKbps}k`, "-bufsize", `${maxKbps * 2}k`,
        "-c:a", "aac", "-b:a", "96k", "-ac", "2",
        "-movflags", "+faststart",
        "-threads", String(this.options.threads ?? 1),
        "-y", out,
      ],
      { timeout: 15 * 60_000, maxBuffer: 1024 * 1024 },
    );
  }

  /** Average brightness of an image, 0–255, by shrinking it to one grey pixel. */
  private async luma(image: string) {
    const { stdout } = await run(this.ffmpeg, ["-v", "error", "-i", image, "-vf", "scale=1:1,format=gray", "-f", "rawvideo", "-"], { encoding: "buffer" });
    return (stdout as Buffer)[0] ?? 0;
  }
}
