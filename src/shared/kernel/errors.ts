/**
 * An expected business failure. Plain data (not an Error subclass) so it can cross the
 * server/client boundary in a server action's return value.
 */
export type DomainError<Code extends string = string> = {
  readonly code: Code;
  readonly message: string;
};

export const domainError = <Code extends string>(code: Code, message: string): DomainError<Code> => ({ code, message });

/** Shared codes; each module adds its own alongside these. */
export type CommonErrorCode = "not_found" | "invalid_input" | "conflict" | "forbidden";
