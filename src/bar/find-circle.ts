import type { GrayImage } from '../core';
import { percentile } from '../signal';

/** A circle found in a picture, in that picture's pixels. */
export interface Circle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** How much of the circle's edge was found in the picture, 0 to 1. */
  readonly score: number;
}

/** The sizes of circle to look for, as radii in pixels. */
export interface CircleSearch {
  readonly minRadius: number;
  readonly maxRadius: number;
  /**
   * When set, the largest circle with at least this score is taken instead of the clearest. Two
   * plates of the same size look different sizes: the nearer one bigger. Its edge can be less
   * clear than the far plate's (hands and legs cross it), but it is the one wanted.
   */
  readonly largestWithScore?: number;
}

/**
 * Pixels whose brightness changes by less than this (Sobel magnitude, 0 to about 1,000) are
 * never edges, however flat the rest of the picture is. Keeps sensor noise from voting.
 */
const MIN_EDGE_STRENGTH = 40;
/** Edges also have to be at least this share as strong as the strongest edges in the picture. */
const EDGE_SHARE_OF_STRONGEST = 0.3;
/** Points sampled around a candidate circle to measure how much of its edge is there. */
const COVERAGE_SAMPLES = 72;
/** How far from the circle, in pixels, an edge may be and still count for it. */
const COVERAGE_TOLERANCE_PX = 2;
/**
 * How closely an edge must face the circle's centre to count for it: the cosine of the largest
 * angle between its brightness gradient and the line to the centre.
 */
const MIN_RADIAL_ALIGNMENT = 0.8;

interface Edges {
  readonly width: number;
  readonly height: number;
  /** Gradient strength per pixel; 0 where it isn't an edge. */
  readonly strength: Float32Array;
  /** Unit gradient direction per pixel. */
  readonly ux: Float32Array;
  readonly uy: Float32Array;
  /** Indices of the edge pixels. */
  readonly pixels: readonly number[];
}

/**
 * The clearest circle of the given sizes in a picture (or the largest clear one, see
 * CircleSearch.largestWithScore), or null if there are no edges at all.
 *
 * Every edge pixel votes for the points one radius away along its brightness gradient, on both
 * sides, since a plate can be darker or lighter than what's behind it. The point with the most
 * votes per unit of circumference is the centre. The score is then measured directly, as the
 * share of the circle's edge with a matching edge in the picture, so it reads the same at any
 * size.
 */
export function findCircle(image: GrayImage, search: CircleSearch): Circle | null {
  const edges = findEdges(image);
  if (edges.pixels.length === 0) return null;

  const minRadius = Math.max(2, Math.ceil(search.minRadius));
  const maxRadius = Math.max(minRadius, Math.floor(search.maxRadius));
  const peaks: Peak[] = [];
  for (let radius = minRadius; radius <= maxRadius; radius++) {
    const peak = strongestCentre(edges, radius);
    if (peak) peaks.push({ ...peak, radius, votes: peak.votes / radius });
  }
  const clearest = mostVoted(peaks);
  if (!clearest) return null;

  if (search.largestWithScore !== undefined) {
    const largest = largestClear(edges, peaks, search.largestWithScore);
    if (largest) return largest;
  }
  return { ...clearest, score: coverage(edges, clearest) };
}

/** A candidate centre for one radius, with its votes per unit of circumference. */
interface Peak {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly votes: number;
}

/** Peaks this close together, as a share of the radius, are taken as the same circle. */
const SAME_CIRCLE_SHARE = 0.25;

function mostVoted<T extends Peak>(peaks: readonly T[]): T | null {
  let best: T | null = null;
  for (const peak of peaks) if (!best || peak.votes > best.votes) best = peak;
  return best;
}

/**
 * The largest circle with at least `minScore` of its edge found. Radii a pixel or two off the
 * true one still score well, so once the largest is known, the clearest peak around the same
 * centre gives its size.
 */
function largestClear(edges: Edges, peaks: readonly Peak[], minScore: number): Circle | null {
  const scored = peaks.map((peak) => ({ ...peak, score: coverage(edges, peak) }));
  const clear = scored.filter((peak) => peak.score >= minScore);
  let largest: (typeof clear)[number] | undefined;
  for (const peak of clear) if (!largest || peak.radius > largest.radius) largest = peak;
  if (!largest) return null;
  const same = clear.filter(
    (peak) =>
      Math.hypot(peak.x - largest.x, peak.y - largest.y) <= SAME_CIRCLE_SHARE * largest.radius,
  );
  const best = mostVoted(same) ?? largest;
  return { x: best.x, y: best.y, radius: best.radius, score: best.score };
}

function findEdges(image: GrayImage): Edges {
  const { width, height, data } = image;
  const size = width * height;
  const strength = new Float32Array(size);
  const ux = new Float32Array(size);
  const uy = new Float32Array(size);
  const at = (x: number, y: number) => data[y * width + x] ?? 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const gx =
        at(x + 1, y - 1) +
        2 * at(x + 1, y) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x - 1, y) -
        at(x - 1, y + 1);
      const gy =
        at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x, y - 1) -
        at(x + 1, y - 1);
      const magnitude = Math.hypot(gx, gy);
      const index = y * width + x;
      strength[index] = magnitude;
      if (magnitude > 0) {
        ux[index] = gx / magnitude;
        uy[index] = gy / magnitude;
      }
    }
  }

  const threshold = Math.max(
    MIN_EDGE_STRENGTH,
    EDGE_SHARE_OF_STRONGEST * (percentile(strongest(strength), 0.99) ?? 0),
  );
  const pixels: number[] = [];
  for (let index = 0; index < size; index++) {
    if ((strength[index] ?? 0) >= threshold) pixels.push(index);
    else strength[index] = 0;
  }
  return { width, height, strength, ux, uy, pixels };
}

/** The centre with the most votes for one radius, refined to a fraction of a pixel. */
function strongestCentre(
  edges: Edges,
  radius: number,
): { x: number; y: number; votes: number } | null {
  const { width, height, ux, uy, pixels } = edges;
  const votes = new Float32Array(width * height);
  for (const index of pixels) {
    const x = index % width;
    const y = (index - x) / width;
    const dx = (ux[index] ?? 0) * radius;
    const dy = (uy[index] ?? 0) * radius;
    for (const sign of [1, -1]) {
      const cx = Math.round(x + sign * dx);
      const cy = Math.round(y + sign * dy);
      if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
      const at = cy * width + cx;
      votes[at] = (votes[at] ?? 0) + 1;
    }
  }

  // Votes for one centre spread over neighbouring pixels, so neighbourhoods are compared.
  let best = { index: -1, votes: 0 };
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) sum += votes[(y + oy) * width + x + ox] ?? 0;
      }
      if (sum > best.votes) best = { index: y * width + x, votes: sum };
    }
  }
  if (best.index < 0) return null;

  const px = best.index % width;
  const py = (best.index - px) / width;
  let sx = 0;
  let sy = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const vote = votes[(py + oy) * width + px + ox] ?? 0;
      sx += vote * ox;
      sy += vote * oy;
    }
  }
  return { x: px + sx / best.votes, y: py + sy / best.votes, votes: best.votes };
}

/** The share of points around the circle with an edge facing its centre close by. */
function coverage(edges: Edges, circle: { x: number; y: number; radius: number }): number {
  const { width, height, strength, ux, uy } = edges;
  let found = 0;
  for (let sample = 0; sample < COVERAGE_SAMPLES; sample++) {
    const angle = (2 * Math.PI * sample) / COVERAGE_SAMPLES;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let offset = -COVERAGE_TOLERANCE_PX; offset <= COVERAGE_TOLERANCE_PX; offset++) {
      const x = Math.round(circle.x + (circle.radius + offset) * cos);
      const y = Math.round(circle.y + (circle.radius + offset) * sin);
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const index = y * width + x;
      if ((strength[index] ?? 0) === 0) continue;
      const alignment = Math.abs((ux[index] ?? 0) * cos + (uy[index] ?? 0) * sin);
      if (alignment >= MIN_RADIAL_ALIGNMENT) {
        found++;
        break;
      }
    }
  }
  return found / COVERAGE_SAMPLES;
}

/** The non-zero gradient strengths, to judge how strong the picture's edges are. */
function strongest(strength: Float32Array): number[] {
  return Array.from(strength).filter((value) => value > 0);
}
