import type { Step } from '../types';

/**
 * All other steps form single-item batches (sequential).
 */
export function buildBatches(steps: Step[]): Step[][] {
  const batches: Step[][] = [];
  const seen = new Set<string>();
  let i = 0;

  while (i < steps.length) {
    const step = steps[i];
    const pg = step.parallelGroup;

    if (pg && !seen.has(pg)) {
      const group = steps.filter((s) => s.parallelGroup === pg);
      group.forEach((s) => seen.add(s.id));
      seen.add(pg);
      batches.push(group);
      while (i < steps.length && steps[i].parallelGroup === pg) i++;
    } else if (seen.has(step.id)) {
      i++;
    } else {
      batches.push([step]);
      i++;
    }
  }

  return batches;
}
