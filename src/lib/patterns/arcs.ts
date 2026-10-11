import { el, num } from '../engine/svg';
import type { NumberParamDef, Params, PatternModule } from '../engine/types';

const LAYERS: NumberParamDef = { type: 'number', min: 3, max: 12, step: 1, default: 5 };
const CURVE: NumberParamDef = { type: 'number', min: 0, max: 1, step: 0.05, default: 0.6 };
const FOCUS: NumberParamDef = { type: 'number', min: 0, max: 1, step: 0.05, default: 0.5 };

// Tuning constants. Changing any of them changes outputs and needs an engine version bump (SHR-03).

/** Largest arch by height: at curve 1 it rises at most this share of the height (70% at the default curve). */
const HEADROOM = 0.8;
/** Largest arch by width: at the default curve its feet stay about 8% of the width inside each side edge. */
const FIT = 0.36;
/** Narrowest screen sized as landscape (4:3, a tablet on its side); narrower screens crop the arch instead of shrinking it. */
const LANDSCAPE_MIN = 4 / 3;
/** Tallest screen sized by its height (9:20, the tallest phone preset); taller screens only get more sky. */
const PORTRAIT_MIN = 9 / 20;
/** Smallest arch the seed can pick, as a share of the largest: a 2.5x range, the strongest seed axis. */
const SIZE_MIN = 0.4;
/** Height / half-width of the arch at curve 0 (curve 1 is a semicircle, ratio 1): flat, but still a dome on a phone. */
const FLAT = 0.4;
/** Largest opening under the innermost band, as a share of the arch height; when present it is at least half of this. */
const HOLE_MAX = 0.5;
/** Largest background share of each band: from fine keylines up to thin line art like the wireframe thumbnail. */
const GAP_MAX = 0.8;
/** Thinnest stripe (band, gap or pinched side) at LAYERS.max and curve 0, as a share of the arch unit. */
const MIN_LINE = 0.005;
/** Share of seeds without an opening, and share of seeds without gaps. */
const STYLE_SPLIT = 0.5;

/** One disc of the arch, painted in order. `band` indexes the pattern colors; -1 is the background. */
export interface Disc {
	cx: number;
	cy: number;
	r: number;
	band: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Splits one draw: -1 when the style is off, otherwise its strength in [0, 1). */
const style = (r: number) => (r < STYLE_SPLIT ? -1 : (r - STYLE_SPLIT) / (1 - STYLE_SPLIT));

/**
 * Size of the largest arch the seed can pick. Landscape screens size it by width so it fits
 * with air at the sides, capped by height for sky on top. Screens narrower than 4:3 are sized
 * like a 4:3 screen of the same height (the arch crops at the sides), and screens taller than
 * 9:20 like a 9:20 screen of the same width.
 */
function archUnit(width: number, height: number): number {
	const h = Math.min(height, width / PORTRAIT_MIN);
	return Math.min(HEADROOM * h, FIT * Math.max(width, LANDSCAPE_MIN * h));
}

/**
 * One arch whose circle centres lie `depth` below the bottom edge (lean then shifts the inner
 * centres sideways). `ratio` is the outer arc's height / half-width; sqrt(height · half-width)
 * stays `size`, so a flatter arch gets lower as it gets wider. Returns the apex height above the
 * bottom edge and the depth.
 */
function arch(size: number, ratio: number): { apex: number; depth: number } {
	const apex = size * Math.sqrt(ratio);
	const halfWidth = apex / ratio;
	return { apex, depth: (halfWidth * halfWidth - apex * apex) / (2 * apex) };
}

/**
 * Geometry of the arch, outermost disc first. It depends only on the canvas size, the params
 * and the seed, never on colors, so light and dark variants match (MODE-01).
 */
export function layout(width: number, height: number, params: Params, rng: () => number): Disc[] {
	const n = Number(params.layers);
	const curve = Number(params.curve);
	const focus = Number(params.focus);

	// Seed: exactly five draws, in this order, before anything the params touch.
	const unit = archUnit(width, height);
	const size = unit * lerp(SIZE_MIN, 1, rng());
	const hole = style(rng());
	const holeShare = hole < 0 ? 0 : (HOLE_MAX * (1 + hole)) / 2;
	const leanDraw = 2 * rng() - 1;
	const taperDraw = 2 * rng() - 1;
	const gapDraw = style(rng());

	// Stripe budget, from the seed only: at LAYERS.max and curve 0 (the thinnest bands this
	// seed can get) every stripe, pinched side included, stays >= MIN_LINE. The gap takes
	// its share first; lean and taper split the rest, so |lean| < 1 and |taper| < 1.
	// The budget always fits while need < 0.5:
	// MIN_LINE · LAYERS.max < (1 - HOLE_MAX) · sqrt(FLAT) · SIZE_MIN / 2.
	const need = (MIN_LINE * unit * LAYERS.max) / ((1 - holeShare) * arch(size, FLAT).apex);
	const gap = gapDraw < 0 ? 0 : Math.min(1 - need, Math.max(need, GAP_MAX * gapDraw));
	const stripe = gap > 0 ? Math.min(gap, 1 - gap) : 1;
	const slack = 1 - Math.sqrt(need / stripe);
	const lean = leanDraw * slack;
	const taper = taperDraw * slack;

	const { apex, depth } = arch(size, lerp(FLAT, 1, curve));
	const holeTop = holeShare * apex;

	// n bands fill the span from the opening up to the apex. Each band but the last ends in a
	// gap; the last one borders the opening, or is a full solid core without one. The linear
	// taper sums to n, from outer-heavy (taper > 0) to inner-heavy (taper < 0).
	const weight = (i: number) => 1 + taper * (1 - (2 * i) / (n - 1));
	const bandUnit = (apex - holeTop) / (n - (holeTop > 0 ? gap * weight(n - 1) : 0));
	const tops: [number, number][] = [];
	let top = apex;
	for (let i = 0; i < n; i++) {
		tops.push([top, i]);
		if (i < n - 1) {
			const band = bandUnit * weight(i);
			if (gap > 0) tops.push([top - band * (1 - gap), -1]);
			top -= band;
		}
	}
	if (holeTop > 0) tops.push([holeTop, -1]);

	// The outer arc stands centred on focus; lean shifts each inner centre by less than its
	// radius change (|lean| < 1), so discs stay nested and the bands crowd towards one side.
	const cy = height + depth;
	return tops.map(([h, band]) => ({
		cx: width * focus + lean * (apex - h),
		cy,
		r: depth + h,
		band
	}));
}

/**
 * The part of a disc inside the canvas as a closed path: an arc over the top, cut by the bottom
 * edge and, where the disc reaches past them, by the side edges. Nothing is drawn outside the
 * viewBox, so editors show exactly what browsers show (ENG-01). The centre sits on or below the
 * bottom edge and the apex below the top edge, so the visible arc is at most a half circle. When
 * the apex is on the canvas the arc is split there: a single arc between rounded endpoints of a
 * near-diameter chord would let renderers place its centre several pixels off.
 * Returns '' when the disc lies entirely beside the canvas.
 */
function discPath({ cx, cy, r }: Disc, width: number, height: number): string {
	const depth = cy - height;
	const half = Math.sqrt((r - depth) * (r + depth));
	const left = cx - half;
	const right = cx + half;
	if (right <= 0 || left >= width) return '';
	const edgeY = (x: number) => cy - Math.sqrt((r - (x - cx)) * (r + (x - cx)));
	const bottom = num(height);
	const start = left >= 0 ? `M${num(left)} ${bottom}` : `M0 ${bottom}L0 ${num(edgeY(0))}`;
	const arc = `A${num(r)} ${num(r)} 0 0 1`;
	const apex = cx > 0 && cx < width ? `${arc} ${num(cx)} ${num(cy - r)}` : '';
	const end =
		right <= width
			? `${arc} ${num(right)} ${bottom}`
			: `${arc} ${num(width)} ${num(edgeY(width))}L${num(width)} ${bottom}`;
	return `${start}${apex}${end}Z`;
}

/** Stacked minimalist arcs standing on the bottom edge (catalog #15a). */
const arcs: PatternModule = {
	id: 'arcs',
	name: 'Arcs',
	category: 'landscape',
	params: { layers: LAYERS, curve: CURVE, focus: FOCUS },
	colorCount: (params) => Number(params.layers),
	generate({ width, height, params, rng, background, colors }) {
		let out = el('rect', { width, height, fill: background });
		for (const disc of layout(width, height, params, rng)) {
			const d = discPath(disc, width, height);
			if (d !== '') out += el('path', { d, fill: disc.band < 0 ? background : colors[disc.band] });
		}
		return out;
	}
};

export default arcs;
