"use client";

/**
 * Publishes a camera stream to a WHIP endpoint (the media server) from the browser: one
 * HTTP POST of an SDP offer, then WebRTC carries the video. OBS can publish to the same URL.
 */
export async function publishWhip(url: string, stream: MediaStream) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  for (const track of stream.getTracks()) {
    const transceiver = pc.addTransceiver(track, { direction: "sendonly", streams: [stream] });
    // Viewers watch HLS, which carries H.264 but not VP8: ask the browser for H.264 first.
    if (track.kind === "video") {
      const codecs = RTCRtpSender.getCapabilities?.("video")?.codecs ?? [];
      const h264 = codecs.filter((c) => c.mimeType.toLowerCase() === "video/h264");
      if (h264.length) transceiver.setCodecPreferences([...h264, ...codecs.filter((c) => c.mimeType.toLowerCase() !== "video/h264")]);
    }
  }
  await pc.setLocalDescription(await pc.createOffer());
  // Send the offer once candidates are gathered (or after a moment, whichever comes first).
  await new Promise<void>((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const done = () => {
      if (pc.iceGatheringState === "complete") resolve();
    };
    pc.addEventListener("icegatheringstatechange", done);
    setTimeout(resolve, 2000);
  });
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/sdp" }, body: pc.localDescription?.sdp ?? "" });
  if (!res.ok) {
    pc.close();
    throw new Error(res.status === 401 ? "The media server refused the stream key." : `The media server answered ${res.status}.`);
  }
  await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
  const location = res.headers.get("location");
  const resource = location ? new URL(location, url).toString() : null;
  return {
    pc,
    async stop() {
      pc.close();
      if (resource) await fetch(resource, { method: "DELETE" }).catch(() => {});
    },
  };
}
