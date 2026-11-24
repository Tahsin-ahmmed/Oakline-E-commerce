import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env, integrations } from "@/lib/env";

let transporter: Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const e = env();
  transporter = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_SECURE,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send an email. Without SMTP configuration the message is logged instead (development fallback).
 * Failures are logged and reported via the return value — callers decide whether they are fatal.
 */
export async function sendMail(input: MailInput): Promise<{ delivered: boolean }> {
  if (!integrations.smtp()) {
    console.info(`[email:dev] To: ${input.to}\n  Subject: ${input.subject}\n  ${input.text.replace(/\n/g, "\n  ")}`);
    return { delivered: false };
  }
  try {
    await getTransporter().sendMail({ from: env().EMAIL_FROM, ...input });
    return { delivered: true };
  } catch (error) {
    console.error("[email] failed to send", { to: input.to, subject: input.subject, error });
    return { delivered: false };
  }
}
