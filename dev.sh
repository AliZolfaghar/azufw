#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

export PYTHONPATH="${PWD}/src${PYTHONPATH:+:$PYTHONPATH}"
export AZUFW_DEV=1

echo "====================================="
echo " 🔥 azufw - Development Mode"
echo " (mock data, no UFW required)"
echo "====================================="
echo

python -m azufw || {
    echo
    echo "⚠️  Try installing dependencies first:"
    echo "   pip install textual"
}
