#!/usr/bin/env bash
set -euo pipefail
python3 -m pip install --upgrade pip
if [ -f requirements.txt ]; then pip3 install -r requirements.txt; fi
node server.js
