"""Compatibility wrapper; country enrichment is persisted by the canonical pipeline."""
import subprocess
import sys
from pathlib import Path

if len(sys.argv) < 2:
    sys.exit('Usage: python scripts/update_from_excel.py <workbook.xlsx> [--dry-run]')
entry = Path(__file__).resolve().parents[1] / 'data' / 'update.mjs'
sys.exit(subprocess.call(['node', str(entry), '--excel', sys.argv[1], '--python', sys.executable, *sys.argv[2:]]))
