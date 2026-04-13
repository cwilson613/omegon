#!/usr/bin/env bash
# Record an asciinema demo of Omegon fixing a bug in the sample project.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEMO_DIR="/tmp/omegon-demo-rec"
CAST_FILE="$SCRIPT_DIR/omegon-demo.cast"

if [ ! -d "$DEMO_DIR/.git" ]; then
    echo "Run ./setup.sh first."
    exit 1
fi

echo "Recording to: $CAST_FILE"
echo "You'll be dropped into a shell at $DEMO_DIR."
echo "Launch 'om', follow the script beats, then /quit and 'exit'."
echo ""

asciinema rec "$CAST_FILE" \
    --cols 160 \
    --rows 50 \
    --overwrite \
    -c "cd $DEMO_DIR && exec $SHELL"
