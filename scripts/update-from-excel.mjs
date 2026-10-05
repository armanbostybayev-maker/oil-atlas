// Compatibility entry point for country enrichment; no direct runtime writes.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const [workbook, ...args] = process.argv.slice(2);
if (!workbook || workbook.startsWith('--')) {
  console.error('Usage: node scripts/update-from-excel.mjs <workbook.xlsx> [--dry-run] [--python <executable>]');
  process.exitCode = 1;
} else {
  console.warn('Compatibility wrapper: prefer npm run data:update -- --excel <workbook.xlsx>.');
  const result = spawnSync(process.execPath,[fileURLToPath(new URL('../data/update.mjs',import.meta.url)),'--excel',workbook,...args],{stdio:'inherit'});
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
