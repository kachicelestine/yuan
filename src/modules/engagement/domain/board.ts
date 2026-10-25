import { domainError, err, ok, type DomainError, type Result } from "@/shared/kernel";

// Collections: named boards of products ("Van build", "Dorm setup"). A public board can be
// shared and followed; a private one only its owner sees. "All saved" is the saved list,
// not a board.

export const MAX_BOARD_ITEMS = 200;
export const MAX_BOARDS = 50;

export type Board = Readonly<{
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  slugs: readonly string[];
  public: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

export type BoardError = DomainError<"invalid_name" | "too_many" | "full" | "not_found" | "forbidden">;

const cleanName = (name: string) => name.trim().replace(/\s+/g, " ");

export function createBoard(props: { id: string; owner: { accountId: string; name: string }; name: string; isPublic: boolean; existing: number; at: Date }): Result<Board, BoardError> {
  const name = cleanName(props.name);
  if (name.length < 1 || name.length > 60) return err(domainError("invalid_name", "Give the board a name (up to 60 characters)."));
  if (props.existing >= MAX_BOARDS) return err(domainError("too_many", `You can have up to ${MAX_BOARDS} boards.`));
  return ok({ id: props.id, ownerId: props.owner.accountId, ownerName: props.owner.name, name, slugs: [], public: props.isPublic, createdAt: props.at, updatedAt: props.at });
}

export function editBoard(b: Board, patch: { name?: string; isPublic?: boolean }, at: Date): Result<Board, BoardError> {
  const name = patch.name === undefined ? b.name : cleanName(patch.name);
  if (name.length < 1 || name.length > 60) return err(domainError("invalid_name", "Give the board a name (up to 60 characters)."));
  return ok({ ...b, name, public: patch.isPublic ?? b.public, updatedAt: at });
}

/** Adds (to the front) or removes a product. */
export function toggleItem(b: Board, slug: string, on: boolean, at: Date): Result<Board, BoardError> {
  const has = b.slugs.includes(slug);
  if (on === has) return ok(b);
  if (on && b.slugs.length >= MAX_BOARD_ITEMS) return err(domainError("full", `A board holds up to ${MAX_BOARD_ITEMS} items.`));
  return ok({ ...b, slugs: on ? [slug, ...b.slugs] : b.slugs.filter((s) => s !== slug), updatedAt: at });
}

export const canSee = (b: Board, viewer: string | null) => b.public || b.ownerId === viewer;
