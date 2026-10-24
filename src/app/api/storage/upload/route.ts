import { receiveUpload } from "@/server/media";

/** PUT /api/storage/upload?… — identity and business documents (private), with STORAGE=local. */
export async function PUT(request: Request) {
  return receiveUpload(request, "private");
}
