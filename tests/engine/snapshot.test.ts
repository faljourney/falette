import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, render } from '../../src/lib/engine/render';
import { representativePresets } from '../fixtures/presets';
import {
	snapshotBackground,
	snapshotExtraCases,
	snapshotPalette,
	snapshotPatterns,
	snapshotSeeds,
	snapshotVariants
} from '../fixtures/snapshot-patterns';

// ENG-08: fixed seeds must produce identical SVG strings on every build.
// Snapshots are .svg files so they can be opened for the PAT-10 visual check.
describe.each(snapshotPatterns)('snapshot: $id', (pattern) => {
	const runs = [
		...snapshotSeeds.map((seed) => ({ seed, params: {} })),
		...(snapshotExtraCases[pattern.id] ?? [])
	].map(({ seed, params }) => {
		const label = Object.entries(params)
			.map(([key, value]) => `${key}-${value}`)
			.join('_');
		return { seed, params, name: label === '' ? seed : `${seed}_${label}` };
	});
	const cases = snapshotVariants.flatMap((variant) =>
		Object.entries(representativePresets).flatMap(([preset, size]) =>
			runs.map((run) => ({ variant, preset, size, ...run }))
		)
	);

	it.each(cases)(
		'$variant $preset seed $name',
		async ({ variant, preset, size, seed, params, name }) => {
			const svg = render(
				{
					version: ENGINE_VERSION,
					pattern: pattern.id,
					seed,
					palette: snapshotPalette,
					background: snapshotBackground,
					size,
					params,
					variant
				},
				pattern
			);
			await expect(svg).toMatchFileSnapshot(
				`./__snapshots__/${pattern.id}/${variant}/${preset}-${name}.svg`
			);
		}
	);
});
