// The build's rule for a child's way out (ADR 0046): every link that leaves Tò He — an address on another origin, a
// `mailto:` — carries `data-out`, because the stylesheet hides exactly those links on a visit that came from the app
// (src/scripts/from-app.js). A link without the mark would stay in sight. Pure, so a test can break a page on purpose.

const attribute = (tag: string, name: string) => new RegExp(`\\s${name}(?:="([^"]*)")?(?=[\\s>/])`).exec(tag);

/** Whether an `href` leaves Tò He: it names another origin or another scheme (mailto:, tel:), and is no path or anchor. */
export const leavesToheHref = (href: string): boolean =>
  !(href.startsWith('/') && !href.startsWith('//')) && !href.startsWith('#') && href !== '';

/** The links of `html` that leave Tò He and carry no `data-out`. */
export function outboundProblems(page: string, html: string): string[] {
  const problems: string[] = [];
  for (const [tag] of html.matchAll(/<a\b[^>]*>/g)) {
    const href = /\shref="([^"]*)"/.exec(tag)?.[1] ?? '';
    if (leavesToheHref(href) && attribute(tag, 'data-out') === null) {
      problems.push(`${page}: a link out of Tò He, ${href}, without data-out`);
    }
  }
  return problems;
}
