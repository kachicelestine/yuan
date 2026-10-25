import { domainError, err, ok, type Clock, type Result } from "@/shared/kernel";
import { canSee, createBoard, editBoard, toggleItem, type Board, type BoardError } from "../domain/board";
import type { BoardRepository } from "../domain/repositories";

export type BoardView = { id: string; name: string; ownerName: string; slugs: string[]; public: boolean; yours: boolean; followers: number; following: boolean };

export type BoardsDeps = { boards: BoardRepository; clock: Clock; newCode: () => string };

export function makeBoards({ boards, clock, newCode }: BoardsDeps) {
  async function views(list: readonly Board[], viewer: string | null): Promise<BoardView[]> {
    const ids = list.map((b) => b.id);
    const [followers, mine] = await Promise.all([boards.followers(ids), viewer ? boards.following(viewer, ids) : Promise.resolve(new Set<string>())]);
    return list.map((b) => ({ id: b.id, name: b.name, ownerName: b.ownerName, slugs: [...b.slugs], public: b.public, yours: b.ownerId === viewer, followers: followers.get(b.id) ?? 0, following: mine.has(b.id) }));
  }

  async function owned(id: string, accountId: string): Promise<Board | null> {
    const b = await boards.find(id);
    return b && b.ownerId === accountId ? b : null;
  }

  return {
    async mine(accountId: string): Promise<BoardView[]> {
      return views(await boards.forOwner(accountId), accountId);
    },

    /** Public boards with the most followers (and at least a few items). */
    async popular(viewer: string | null, limit = 12): Promise<BoardView[]> {
      return views(await boards.popular(limit), viewer);
    },

    async followed(accountId: string): Promise<BoardView[]> {
      return views(await boards.followedBy(accountId), accountId);
    },

    async view(id: string, viewer: string | null): Promise<BoardView | null> {
      const b = /^[a-z2-9]{8}$/.test(id) ? await boards.find(id) : null;
      if (!b || !canSee(b, viewer)) return null;
      return (await views([b], viewer))[0];
    },

    async create(owner: { accountId: string; name: string }, name: string, isPublic = true, firstSlug: string | null = null): Promise<Result<BoardView, BoardError>> {
      const b = createBoard({ id: newCode(), owner, name, isPublic, existing: (await boards.forOwner(owner.accountId)).length, at: clock.now() });
      if (!b.ok) return b;
      const withItem = firstSlug ? toggleItem(b.value, firstSlug, true, clock.now()) : b;
      if (!withItem.ok) return withItem;
      await boards.save(withItem.value);
      return ok((await views([withItem.value], owner.accountId))[0]);
    },

    async edit(accountId: string, id: string, patch: { name?: string; isPublic?: boolean }): Promise<Result<BoardView, BoardError>> {
      const b = await owned(id, accountId);
      if (!b) return err(domainError("not_found", "No such board."));
      const next = editBoard(b, patch, clock.now());
      if (!next.ok) return next;
      await boards.save(next.value);
      return ok((await views([next.value], accountId))[0]);
    },

    async remove(accountId: string, id: string): Promise<Result<{ id: string }, BoardError>> {
      const b = await owned(id, accountId);
      if (!b) return err(domainError("not_found", "No such board."));
      await boards.remove(id);
      return ok({ id });
    },

    async toggle(accountId: string, id: string, slug: string, on: boolean): Promise<Result<BoardView, BoardError>> {
      const b = await owned(id, accountId);
      if (!b) return err(domainError("not_found", "No such board."));
      const next = toggleItem(b, slug, on, clock.now());
      if (!next.ok) return next;
      if (next.value !== b) await boards.save(next.value);
      return ok((await views([next.value], accountId))[0]);
    },

    /** Follow someone else's public board (or stop). */
    async follow(accountId: string, id: string, on: boolean): Promise<Result<BoardView, BoardError>> {
      const b = await boards.find(id);
      if (!b || !b.public) return err(domainError("not_found", "No such board."));
      if (b.ownerId === accountId) return err(domainError("forbidden", "It's your own board."));
      await (on ? boards.follow(id, accountId, clock.now()) : boards.unfollow(id, accountId));
      return ok((await views([b], accountId))[0]);
    },
  };
}

export type Boards = ReturnType<typeof makeBoards>;
