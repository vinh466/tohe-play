/** Where "Góp ý / báo lỗi" goes: the operator's address (Email Routing on the platform's domain). */
export const FEEDBACK_ADDRESS = 'hello@toheplay.io.vn';

/**
 * A mail to the operator with the subject filled in and, below room to write, the app's version and the browser: what
 * a bug report needs, and nothing about the person.
 */
export function feedbackLink({
  version,
  userAgent,
  text,
}: {
  version: string;
  userAgent: string;
  text: { subject: string; intro: string; version: string; browser: string };
}): string {
  const body = `${text.intro}\n\n\n--\n${text.version}: ${version}\n${text.browser}: ${userAgent}\n`;
  return `mailto:${FEEDBACK_ADDRESS}?subject=${encodeURIComponent(text.subject)}&body=${encodeURIComponent(body)}`;
}
