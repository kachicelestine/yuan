import { domainError, err, ok, type DomainError, type Result } from "@/shared/kernel";

// People flag what shouldn't be here; a moderator removes it or dismisses the flags.
// Reports are kept after a decision, so repeat offenders and bad reporters show up.

export const REPORT_TARGETS = ["video", "comment", "question", "review"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = ["counterfeit", "misleading", "offensive", "spam", "unsafe", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type ReportStatus = "open" | "actioned" | "dismissed";

export type Report = Readonly<{
  id: string;
  targetType: ReportTarget;
  targetId: string;
  reporterId: string;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}>;

export type ReportError = DomainError<"invalid_report">;

export function fileReport(props: { id: string; targetType: ReportTarget; targetId: string; reporterId: string; reason: ReportReason; note: string | null; at: Date }): Result<Report, ReportError> {
  if (!REPORT_TARGETS.includes(props.targetType) || !REPORT_REASONS.includes(props.reason)) return err(domainError("invalid_report", "Pick what's wrong."));
  const note = props.note?.trim() || null;
  if (note && note.length > 500) return err(domainError("invalid_report", "Keep the note under 500 characters."));
  if (props.reason === "other" && !note) return err(domainError("invalid_report", "Tell us what's wrong."));
  return ok({ id: props.id, targetType: props.targetType, targetId: props.targetId, reporterId: props.reporterId, reason: props.reason, note, status: "open", createdAt: props.at, resolvedAt: null, resolvedBy: null });
}

export const REASON_LABELS: Record<ReportReason, string> = {
  counterfeit: "Fake or counterfeit",
  misleading: "Misleading or a scam",
  offensive: "Hateful, violent or sexual",
  spam: "Spam",
  unsafe: "Dangerous product",
  other: "Something else",
};
