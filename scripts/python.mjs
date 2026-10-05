import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Optional explicit interpreter, bundled desktop runtime, then standard PATH.
const bundled = path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const candidates = process.env.OIL_ATLAS_PYTHON
  ? [process.env.OIL_ATLAS_PYTHON]
  : [...(existsSync(bundled) ? [bundled] : []),'python3','python'];
const executable = candidates.find(candidate => {
  const result = spawnSync(candidate,['--version'],{encoding:'utf8',timeout:5000,windowsHide:true});
  return result.status === 0 && /^Python 3\./.test((result.stdout || result.stderr || '').trim());
});
if (!executable) {
  console.error('Python 3 is required. Install it or set OIL_ATLAS_PYTHON to its executable path.');
  process.exit(1);
}
const result = spawnSync(executable,process.argv.slice(2),{
  stdio:'inherit',windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'},
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
