import type { Metadata } from "next";
import { PostComposer } from "@/components/creator/post-composer";

export const metadata: Metadata = { title: "New post" };

export default function NewPostPage() {
  return <PostComposer />;
}
