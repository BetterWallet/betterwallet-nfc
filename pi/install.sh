#!/usr/bin/env bash
set -e

VENV=~/betterwallet/.venv
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== BetterWallet Pi Setup ==="

# Enable I2C
sudo raspi-config nonint do_i2c 0
echo "I2C enabled"

# Install system deps
sudo apt-get install -y python3-pip python3-venv i2c-tools

# Create venv at ~/betterwallet/.venv if it doesn't exist
if [ ! -d "$VENV" ]; then
  python3 -m venv "$VENV"
fi

# Install Python deps
"$VENV/bin/pip" install --upgrade pip
"$VENV/bin/pip" install -r "$SCRIPT_DIR/requirements.txt"

# Apply pn532pi I2C patch (fixes errno 121 / EREMOTEIO on Linux 5.3+, removes
# invalid wakeup write, and handles early-response frames on Pi 5)
PATCH_DST="$VENV/lib/python3.*/site-packages/pn532pi/interfaces/pn532i2c.py"
cp "$SCRIPT_DIR/pn532i2c_patch.py" $(ls $PATCH_DST)
echo "pn532i2c patch applied"

echo ""
echo "Done. Run with:"
echo "  source $VENV/bin/activate"
echo "  cd $SCRIPT_DIR && python wallet.py"
