import { receiveUpload } from "@/server/media";

/**
 * PUT /api/media/upload?key=…&bytes=…&type=…&exp=…&sig=… — where browsers send uploads
 * when files live on this server's disk (STORAGE=local). The signed ticket fixes the key,
 * type and exact size; production uploads go straight to R2 instead.
 */
export async function PUT(request: Request) {
  return receiveUpload(request);
}
