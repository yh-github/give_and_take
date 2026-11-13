/**
 * 1,000-seed headless procedural generation benchmark & fuzz test for `deep_cave`.
 * Asserts all v2.0 production benchmarks from `docs/procedural_underground_design.md`:
 *   - 250 seeds per standard preset (easy, normal, hard, expert) = 1,000 seeds total
 *   - First-pass mission graph solve rate >= 85%
 *   - Generation latency: median < 150ms, p95 < 500ms
 *   - Timeout fallback (> 3000ms) rate < 0.5%
 *   - 100% step accuracy within [targetSteps, targetSteps + 1]
 *
 * Usage: node scripts/fuzz_deep_cave.mjs [seedsPerPreset]
 */

import { generateDeepCavePuzzle } from '../src/levels/deep_cave/generator.js';
import { DEEP_CAVE_PRESETS } from '../src/levels/deep_cave/presets.js';
import { DEEP_CAVE_SEED_BANK } from '../src/levels/deep_cave/seedBank.js';

const SEEDS_PER_PRESET = Number(process.argv[2]) || 250;
const PRESETS = ['easy', 'normal', 'hard', 'expert'];

const allLatencies = [];
let totalSeeds = 0;
let totalFirstPass = 0;
let totalSlowOver3s = 0;
const failures = [];

for (const presetId of PRESETS) {
  const settings = DEEP_CAVE_PRESETS[presetId];
  const latencies = [];
  let firstPassCount = 0;
  let passed = 0;

  for (let i = 0; i < SEEDS_PER_PRESET; i++) {
    totalSeeds++;
    const seed = `fuzz_${presetId}_${i}`;
    const t0 = performance.now();
    try {
      const res = generateDeepCavePuzzle(null, settings, null, seed);
      const dt = performance.now() - t0;
      latencies.push(dt);
      allLatencies.push(dt);
      if (dt > 3000) totalSlowOver3s++;
      passed++;
      if (res.diagnostics?.firstPassMissionSolved) {
        firstPassCount++;
        totalFirstPass++;
      }
      if (res.steps < settings.targetSteps || res.steps > settings.targetSteps + 1) {
        failures.push(`${seed}: steps=${res.steps}, expected [${settings.targetSteps}, ${settings.targetSteps + 1}]`);
      }
      if (!Array.isArray(res.solution) || res.solution.length === 0) {
        failures.push(`${seed}: missing solution path`);
      }
    } catch (err) {
      failures.push(`${seed}: ${err.message}`);
    }
  }

  latencies.sort((a, b) => a - b);
  const med = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const max = latencies[latencies.length - 1] || 0;
  console.log(
    `[fuzz] ${presetId.padEnd(6)}: ${passed}/${SEEDS_PER_PRESET} pass | ` +
    `firstPass=${firstPassCount}/${SEEDS_PER_PRESET} (${((firstPassCount / SEEDS_PER_PRESET) * 100).toFixed(1)}%) | ` +
    `med=${med.toFixed(1)}ms | p95=${p95.toFixed(1)}ms | max=${max.toFixed(1)}ms`
  );
}

// Also sanity check CI Seed Bank completeness
for (const presetId of PRESETS) {
  const entries = DEEP_CAVE_SEED_BANK[presetId];
  if (!Array.isArray(entries) || entries.length === 0) {
    failures.push(`Seed bank missing entries for preset ${presetId}`);
  }
}

allLatencies.sort((a, b) => a - b);
const aggMed = allLatencies[Math.floor(allLatencies.length * 0.5)] || 0;
const aggP95 = allLatencies[Math.floor(allLatencies.length * 0.95)] || 0;
const firstPassPct = (totalFirstPass / totalSeeds) * 100;
const slowPct = (totalSlowOver3s / totalSeeds) * 100;

console.log(
  `\n[fuzz] AGGREGATE (${totalSeeds} seeds): ` +
  `firstPass=${totalFirstPass}/${totalSeeds} (${firstPassPct.toFixed(1)}%) | ` +
  `med=${aggMed.toFixed(1)}ms | p95=${aggP95.toFixed(1)}ms | >3000ms=${slowPct.toFixed(2)}% | failures=${failures.length}`
);

if (failures.length > 0) {
  console.error('First 10 failures:', failures.slice(0, 10));
  process.exit(1);
}
if (firstPassPct < 85) {
  console.error(`First-pass solve rate ${firstPassPct.toFixed(1)}% < 85% target`);
  process.exit(1);
}
if (aggMed >= 150 || aggP95 >= 500) {
  console.error(`Latency exceeded target (med=${aggMed.toFixed(1)}ms, p95=${aggP95.toFixed(1)}ms)`);
  process.exit(1);
}
if (slowPct >= 0.5) {
  console.error(`>3000ms rate ${slowPct.toFixed(2)}% >= 0.5% target`);
  process.exit(1);
}
console.log('✅ All 1,000-seed v2.0 benchmark targets PASSED!');
