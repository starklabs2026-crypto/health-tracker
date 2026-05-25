/**
 * OTP delivery interface (the SMS/email channel). In the prototype this is the
 * console substitute; in production it's swapped for Twilio/SES behind this same
 * interface (playbook substitution map) — a config change, not a rewrite.
 */
export interface OtpDelivery {
  send(identifier: string, code: string): Promise<void>;
}

/** DI token for the OtpDelivery implementation. */
export const OTP_DELIVERY = Symbol('OTP_DELIVERY');
