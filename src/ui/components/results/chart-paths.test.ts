import { describe, expect, it } from 'vitest';
import { signalPaths } from './chart-paths';

const x = (frame: number) => frame * 10;
const y = (value: number) => 100 - value;

describe('signalPaths', () => {
  it('draws one line and one closed area for an unbroken signal', () => {
    const { line, area } = signalPaths([0, 10, 0], x, y, 100);
    expect(line).toBe('M0.0,100.0 L10.0,90.0 L20.0,100.0');
    expect(area).toBe(`${line} L20.0,100.0 L0.0,100.0 Z`);
  });

  it('breaks the line and the area at gaps', () => {
    const { line, area } = signalPaths([5, null, 5, 5], x, y, 100);
    expect(line).toBe('M0.0,95.0 M20.0,95.0 L30.0,95.0');
    expect(area.match(/Z/g)).toHaveLength(2);
  });

  it('draws nothing for an empty signal', () => {
    expect(signalPaths([null, null], x, y, 100)).toEqual({ line: '', area: '' });
  });
});
