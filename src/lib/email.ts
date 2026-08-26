import 'server-only'

import { deliveryEmail, type DeliveryEmailInput } from './email-templates'
import {
  isMailConfigured,
  mailSetupHint,
  sendMail,
  type OutgoingEmail,
  type SendResult,
} from './mailer'

/**
 * Sending, one layer above the transport.
 *
 * ./mailer owns *how* a message leaves (SMTP or Resend), ./email-templates owns
 * what it looks like, and this file owns neither — it exists so call sites have
 * one import and do not care which transport is configured.
 */

export type { OutgoingEmail } from './mailer'

export async function isEmailConfigured(): Promise<boolean> {
  return isMailConfigured()
}

/**
 * Kept as a value rather than a function for the call sites that read it as one.
 * The hint is dynamic now — it names whichever piece is actually missing — so
 * prefer emailSetupHint() in new code.
 */
export const EMAIL_SETUP_HINT =
  'Set EMAIL_FROM, plus either SMTP_HOST/SMTP_USER/SMTP_PASS or RESEND_API_KEY, to send email.'

export function emailSetupHint() {
  return mailSetupHint()
}

export async function sendEmail(message: OutgoingEmail): Promise<SendResult> {
  return sendMail(message)
}

/** Sends the fulfilment email for one order. */
export async function sendDeliveryEmail(
  input: DeliveryEmailInput & { to: string }
): Promise<SendResult> {
  const { to, ...rest } = input
  return sendEmail({ to, ...deliveryEmail(rest) })
}
