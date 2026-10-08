import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** WCAG 2.2 AA, plus axe's best-practice rules (landmarks, heading order, and so on). */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/**
 * Fails with a readable list when axe finds a violation on the page as it is now (including
 * anything opened or expanded by the test). Contrast is only trustworthy once entrance animations
 * are over, so callers run with reduced motion.
 */
export async function expectAccessible(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const report = results.violations.map((violation) => {
    const targets = violation.nodes
      .slice(0, 4)
      .map(
        (node) =>
          `    ${node.target.join(' ')}\n      ${node.failureSummary?.split('\n').slice(1, 3).join(' ')}`,
      )
      .join('\n');
    return `${violation.id} (${violation.impact}): ${violation.help}\n${targets}`;
  });
  expect(report, `${label}\n${report.join('\n')}`).toEqual([]);
}
