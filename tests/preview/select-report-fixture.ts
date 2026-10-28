/** Explicit model stand-in for delivery-mechanics tests: selects the reports in its packet.
 * This is a synthetic judgment, never a claim that the captured model verified these reports.
 * Evidence-selection tests use the real worker without this fixture. */
export function selectReportFixture(answer: string, context: string): string {
  const items = (JSON.parse(context) as { pendingReports?: { items: { key: string }[] } }).pendingReports?.items ?? [];
  if (!items.length) return answer;
  let body: { reply?: unknown };
  try { body = JSON.parse(answer) as { reply?: unknown }; } catch { body = { reply: answer }; }
  return JSON.stringify({ ...body, selectedReports: items.map(item => item.key) });
}
