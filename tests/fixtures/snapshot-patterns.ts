import type { Params, PatternModule, Variant } from '../../src/lib/engine/types';
import arcs from '../../src/lib/patterns/arcs';
import { mockPattern } from './mock-pattern';

/** Patterns covered by the ENG-08 snapshot test. */
export const snapshotPatterns: PatternModule[] = [mockPattern, arcs];

/** Fixed seeds: numeric and word seeds take the same text-hash path. */
export const snapshotSeeds = ['1', '42', 'senja-teduh-42'];

/** A fixed seed with param overrides; params left out use their schema defaults. */
export interface SnapshotCase {
	seed: string;
	params: Params;
}

/** Extra cases per pattern ID, for branches the shared seeds at default params never reach. */
export const snapshotExtraCases: Record<string, SnapshotCase[]> = {
	arcs: [
		// The shared seeds all draw a solid arch: '1234' has an opening, '106' an opening and gaps.
		{ seed: '1234', params: {} },
		{ seed: '106', params: {} },
		{ seed: '42', params: { layers: 3 } },
		{ seed: '42', params: { layers: 12 } },
		{ seed: '42', params: { curve: 0 } },
		{ seed: '42', params: { curve: 1 } },
		{ seed: '42', params: { focus: 0 } },
		{ seed: '42', params: { focus: 1 } },
		{ seed: '42', params: { layers: 12, curve: 1, focus: 1 } }
	]
};

/** Both wallpaper variants are checked for every case (PAT-10). */
export const snapshotVariants: Variant[] = ['light', 'dark'];

/** Palette and background from the PRD Appendix B example link. */
export const snapshotPalette = ['e07a5f', '3d405b', '81b29a'];
export const snapshotBackground = 'f4efe6';
