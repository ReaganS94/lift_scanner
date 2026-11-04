/** One value per frame. Null marks a frame where the value couldn't be measured. */
export type Series = readonly (number | null)[];

/**
 * Fills runs of up to `maxGap` missing values by drawing a straight line between the values
 * on either side. Longer gaps, and gaps at the very start or end, stay missing: guessing across
 * them would invent movement that never happened.
 */
export function fillGaps(series: Series, maxGap: number): (number | null)[] {
  const result = [...series];
  let index = 0;

  while (index < result.length) {
    if (result[index] !== null) {
      index++;
      continue;
    }

    const gapStart = index;
    while (index < result.length && result[index] === null) index++;
    const gapEnd = index; // first index after the gap

    const before = result[gapStart - 1];
    const after = result[gapEnd];
    const gapLength = gapEnd - gapStart;
    if (before === undefined || before === null || after === undefined || after === null) continue;
    if (gapLength > maxGap) continue;

    for (let offset = 1; offset <= gapLength; offset++) {
      result[gapStart + offset - 1] = before + ((after - before) * offset) / (gapLength + 1);
    }
  }

  return result;
}

/**
 * Smooths jitter with a centred moving average over `radius` frames on each side. Because the
 * window is centred, peaks stay at the same frame instead of lagging behind, which matters for
 * finding the bottom of a rep. Missing values stay missing and are left out of the average.
 */
export function smooth(series: Series, radius: number): (number | null)[] {
  return series.map((value, index) => {
    if (value === null) return null;

    let sum = 0;
    let count = 0;
    const from = Math.max(0, index - radius);
    const to = Math.min(series.length - 1, index + radius);
    for (let i = from; i <= to; i++) {
      const neighbour = series[i];
      if (neighbour !== null && neighbour !== undefined) {
        sum += neighbour;
        count++;
      }
    }
    return sum / count;
  });
}
