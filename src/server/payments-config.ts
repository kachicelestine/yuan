import "server-only";
import { serverEnv } from "@/config/server-env";
import { RAILS, type RailId } from "@/modules/payments";

/**
 * Rails the configured network accepts: all of them in simulated mode, and in on-chain
 * mode only those with a verifier and a treasury address (Base, for now).
 */
export function availableRails(): RailId[] {
  if (serverEnv.PAYMENTS_MODE === "simulated") return RAILS.map((r) => r.id);
  return serverEnv.PAYMENTS_BASE_ADDRESS ? ["usdc-base"] : [];
}
