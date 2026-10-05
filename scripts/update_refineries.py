"""Compatibility wrapper; explicitly replaces the represented countries' registries."""
import subprocess
import sys
from pathlib import Path

if len(sys.argv) < 2:
    sys.exit('Usage: python scripts/update_refineries.py <workbook.xlsx> [--dry-run]')
entry = Path(__file__).resolve().parents[1] / 'data' / 'update.mjs'
sys.exit(subprocess.call(['node', str(entry), '--excel', sys.argv[1], '--refineries-only', '--python', sys.executable, *sys.argv[2:]]))
