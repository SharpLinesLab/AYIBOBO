/**
 * Password-reset delivery. There's no email service yet, so the link is written to the server
 * log, and an operator can also print one with `manage reset-link <email>`.
 *
 * To send real email later, give createApp a `sendResetLink` that calls your provider (SMTP,
 * Postmark, Amazon SES…). Nothing else needs to change.
 */
export type ResetLinkSender = (email: string, link: string) => void | Promise<void>;

export const logResetLink: ResetLinkSender = (email, link) => {
  console.log(`[password reset] ${email}: ${link} (valid for 1 hour)`);
};

/** The page that finishes the reset. The token is in the #fragment, so it never reaches server logs or Referer headers. */
export const resetLink = (publicUrl: string, token: string) => `${publicUrl.replace(/\/$/, '')}/#/reset/${token}`;
