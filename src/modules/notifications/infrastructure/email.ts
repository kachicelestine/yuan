import type { EmailSender } from "../application/notify";

/** Email through Resend (resend.com). */
export class ResendEmail implements EmailSender {
  constructor(private readonly opts: { apiKey: string; from: string; fetch?: typeof fetch }) {}

  async send(to: string, subject: string, text: string) {
    const res = await (this.opts.fetch ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${this.opts.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: this.opts.from, to: [to], subject, text }),
    });
    if (!res.ok) throw new Error(`Email failed: HTTP ${res.status}`);
  }
}

/** Development: emails are printed instead of sent. */
export class ConsoleEmail implements EmailSender {
  async send(to: string, subject: string) {
    console.info(`[mail] to ${to}: ${subject}`);
  }
}
