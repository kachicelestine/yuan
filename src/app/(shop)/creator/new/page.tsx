import type { Metadata } from "next";
import { VideoComposer } from "@/components/creator/video-composer";

export const metadata: Metadata = { title: "Post a video" };

export default function NewVideoPage() {
  return <VideoComposer />;
}
