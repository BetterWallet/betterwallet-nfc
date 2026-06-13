#!/usr/bin/env bash
# Launches the BetterWallet pygame demo directly via SDL KMS (no X server needed).
# The Pi 5 LCD (Waveshare 3.5" F) appears as /dev/dri/card1.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

export SDL_VIDEODRIVER=kmsdrm
export SDL_VIDEO_KMSDRM_DEVICE_INDEX=1
export SDL_MOUSE_RELATIVE=0

exec /usr/bin/python3 "$SCRIPT_DIR/demo.py" "$@"
