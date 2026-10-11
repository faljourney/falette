// Writes the PAT-10 preview SVGs of one pattern: the 6 representative presets in light and dark,
// with a fixed seed, the palette and background of the PRD Appendix B example, and default
// params. Also reports file sizes and the median render time at desk-5k for default and
// maximum params (ENG-07).
// Usage: npm run preview:pattern -- <pattern-id>
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runnerImport } from 'vite';

const id = process.argv[2];
if (id === undefined) {
	process.stderr.write('Usage: npm run preview:pattern -- <pattern-id>\n');
	process.exit(1);
}
const seed = '42';
const palette = ['e07a5f', '3d405b', '81b29a'];
const background = 'f4efe6';
const timedRuns = 50;

// Loads TypeScript sources through Vite, without the project config and its SvelteKit plugin.
async function load(path) {
	const { module } = await runnerImport(resolve(path), { configFile: false, logLevel: 'silent' });
	return module;
}

const { ENGINE_VERSION, render } = await load('src/lib/engine/render.ts');
const { representativePresets } = await load('tests/fixtures/presets.ts');
const pattern = (await load(`src/lib/patterns/${id}.ts`)).default;

const config = (size, variant, params) => ({
	version: ENGINE_VERSION,
	pattern: id,
	seed,
	palette,
	background,
	size,
	params,
	variant
});
const print = (line) => process.stdout.write(`${line}\n`);

for (const variant of ['light', 'dark']) {
	const dir = `previews/${id}/${variant}`;
	await mkdir(dir, { recursive: true });
	for (const [preset, size] of Object.entries(representativePresets)) {
		const svg = render(config(size, variant, {}), pattern);
		await writeFile(`${dir}/${preset}.svg`, svg);
		print(`${dir}/${preset}.svg  ${Buffer.byteLength(svg)} B`);
	}
}

const maxParams = Object.fromEntries(
	Object.entries(pattern.params).map(([key, def]) => [
		key,
		def.type === 'number' ? def.max : def.default
	])
);
for (const [label, params] of [
	['default', {}],
	['max', maxParams]
]) {
	const run = config(representativePresets['desk-5k'], 'light', params);
	for (let i = 0; i < timedRuns; i++) render(run, pattern);
	const times = Array.from({ length: timedRuns }, () => {
		const start = performance.now();
		render(run, pattern);
		return performance.now() - start;
	}).sort((a, b) => a - b);
	const median = times[Math.floor(timedRuns / 2)];
	const bytes = Buffer.byteLength(render(run, pattern));
	print(
		`desk-5k ${label} ${JSON.stringify(params)}: median ${median.toFixed(3)} ms, ` +
			`slowest ${times[timedRuns - 1].toFixed(3)} ms of ${timedRuns}, ${bytes} B (ENG-07: 50 ms)`
	);
}
