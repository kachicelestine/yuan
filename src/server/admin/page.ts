import { notFound } from "next/navigation";
import { connection } from "next/server";
import { services } from "../container";
import { currentAdmin } from "../session";

/** For an admin page body: the signed-in admin and the app, or the page doesn't exist. */
export async function adminContext() {
  await connection();
  const admin = await currentAdmin();
  if (!admin) notFound();
  return { admin, app: await services() };
}

/** One search param as a string. */
export const param = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
