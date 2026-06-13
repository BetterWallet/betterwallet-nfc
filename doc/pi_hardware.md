# BetterWallet Pi Hardware Reference

## Hardware Components

| Component | Model | Interface |
|-----------|-------|-----------|
| Single-board computer | Raspberry Pi 5 (RP1 chip, Debian Trixie 13.5, kernel 6.18) | — |
| NFC reader | PN532 breakout board | I2C bus 3 (GPIO6/7) |
| Display | Waveshare 3.5" RPi LCD (F) — ST7796S, 320×480 | SPI0 |
| Touch controller | GT911 (on LCD HAT) | I2C bus 1 (GPIO2/3) |

---

## Wiring

### PN532 NFC Reader → Pi 5

> PN532 was originally on I2C bus 1 (GPIO2/3). Moved to bus 3 to free bus 1 for the GT911 touch controller.

| PN532 Pin | Pi Pin | BCM GPIO |
|-----------|--------|----------|
| VCC | Pin 1 (3.3V) | — |
| GND | Pin 6 (GND) | — |
| SDA | **Pin 31** | **GPIO6** |
| SCL | **Pin 26** | **GPIO7** |

PN532 DIP switches: **I2C mode** (A0=1, A1=0 on most boards — verify silkscreen).

### Waveshare 3.5" LCD (F) HAT

Covers all 40 GPIO pins. Key signals on the HAT connector:

| Signal | BCM GPIO | Pi Pin |
|--------|----------|--------|
| SPI MOSI (display) | GPIO10 | Pin 19 |
| SPI MISO (display) | GPIO9 | Pin 21 |
| SPI SCLK (display) | GPIO11 | Pin 23 |
| SPI CE0 (display CS) | GPIO8 | Pin 24 |
| LCD Reset | GPIO27 | Pin 13 |
| LCD DC | GPIO22 | Pin 15 |
| Backlight | GPIO18 | Pin 12 |
| Touch SDA (GT911) | GPIO2 | Pin 3 |
| Touch SCL (GT911) | GPIO3 | Pin 5 |
| Touch INT (GT911) | GPIO17 | Pin 11 |
| Touch RST (GT911) | GPIO25 | Pin 22 |

---

## Full Software Setup (Step-by-Step)

### 1. Initial Pi setup — sync code and install dependencies

```bash
# From Mac — sync pi/ folder to Pi
rsync -av --exclude='.venv' --exclude='__pycache__' \
  -e "sshpass -p raspberry ssh -o StrictHostKeyChecking=no" \
  /path/to/betterwallet-nfc-demo/pi/ \
  pi@<PI_IP>:~/betterwallet/pi/

# SSH into Pi
ssh pi@<PI_IP>   # password: raspberry

# Create venv and install NFC library
python3 -m venv ~/betterwallet/.venv
source ~/betterwallet/.venv/bin/activate
pip install pn532pi
```

### 2. Enable I2C and SPI in config.txt

```bash
sudo nano /boot/firmware/config.txt
```

Add/ensure present:
```
dtparam=i2c_arm=on
dtparam=spi=on
```

Reboot, then install I2C tools:
```bash
sudo apt-get install -y i2c-tools
sudo /usr/sbin/i2cdetect -y 1    # verify PN532 shows at 0x24
```

### 3. Patch pn532pi for Pi 5 / RP1 (EREMOTEIO fix)

The Pi 5 RP1 chip returns `errno 121` (EREMOTEIO) instead of `errno 5` (EIO) when an I2C device NAKs. The stock `pn532pi` library only catches EIO, causing hangs and "Didn't find PN53x board" errors.

```bash
# Edit the installed library directly
nano ~/betterwallet/.venv/lib/python3.13/site-packages/pn532pi/interfaces/pn532i2c.py
```

**Fix 1 — `wakeup()`**: remove the `writing(addr, [0])` call (causes NAK → bus lockup):
```python
def wakeup(self):
    time.sleep(.05)   # PN532 wakes on first I2C transaction — no write needed
```

**Fix 2 — `_readAckFrame()`**: catch both EIO and EREMOTEIO; handle early response frames:
```python
except IOError as e:
    if e.errno not in (errno.EIO, 121):   # 121 = EREMOTEIO on Linux 5.3+ / Pi 5
        raise
# ...
payload = list(data[1:])
if payload != PN532_ACK:
    # Pi 5 is fast enough that PN532 sends the response in the ACK slot.
    # Send NACK so PN532 re-queues the frame for _getResponseLength.
    try:
        self._wire.transaction(writing(PN532_I2C_ADDRESS, PN532_NACK))
    except IOError as e:
        if e.errno not in (errno.EIO, 121):
            raise
```

**Fix 3 — `_getResponseLength()`**: wrap read in try/except:
```python
except IOError as e:
    if e.errno not in (errno.EIO, 121):
        raise
```

**Fix 4 — bus assertion**: allow bus numbers beyond 0/1:
```python
RPI_BUS3 = 3
# ...
assert isinstance(bus, int) and bus >= 0, "Bus must be a non-negative integer"
```

The patched file is saved locally at `pi/pn532i2c_patch.py`.

### 4. Configure Waveshare 3.5" LCD (F) display

```bash
sudo nano /boot/firmware/config.txt
```

Add under `[all]`:
```
dtparam=spi=on
dtoverlay=mipi-dbi-spi,speed=48000000
dtparam=compatible=st7796s\0panel-mipi-dbi-spi
dtparam=width=320,height=480,width-mm=49,height-mm=79
dtparam=reset-gpio=27,dc-gpio=22,backlight-gpio=18
```

```bash
sudo reboot
# After reboot, verify display appears as DRM card1:
ls /dev/dri/    # expect card0, card1, card2, renderD128
```

### 5. Install pygame (system-wide)

```bash
sudo apt-get install -y python3-pygame
# Also install inside venv (needed when running wallet.py with NFC):
source ~/betterwallet/.venv/bin/activate
pip install pygame
```

Verify SDL KMS works on card1:
```bash
SDL_VIDEODRIVER=kmsdrm SDL_VIDEO_KMSDRM_DEVICE_INDEX=1 \
  python3 -c "
import pygame, os
os.environ['SDL_VIDEODRIVER']='kmsdrm'
os.environ['SDL_VIDEO_KMSDRM_DEVICE_INDEX']='1'
pygame.init()
screen = pygame.display.set_mode((320,480), pygame.FULLSCREEN)
print('Driver:', pygame.display.get_driver())
pygame.quit()
"
# Expected output: Driver: KMSDRM
```

### 6. Configure GT911 touch controller

The GT911 uses I2C address **0x14** on this HAT (INT pin is LOW during reset). The kernel goodix driver probe fails on Pi 5 (EREMOTEIO bug) — touch is handled via a userspace driver instead.

```bash
sudo nano /boot/firmware/config.txt
```

Add under `[all]`:
```
dtoverlay=goodix,addr=0x14,interrupt=17,reset=25
```

Verify GT911 is on the bus (after reboot):
```bash
sudo /usr/sbin/i2cdetect -y 1   # shows 0x14
# Read firmware version to confirm chip is alive:
python3 -c "
import os, fcntl, struct
fd = os.open('/dev/i2c-1', os.O_RDWR)
fcntl.ioctl(fd, 0x0703, 0x14)
os.write(fd, bytes([0x81, 0x40]))
import time; time.sleep(0.01)
d = os.read(fd, 6)
print('Product:', d[:4].decode(errors='replace').strip())
print('FW: 0x{:04x}'.format(struct.unpack_from('<H',d,4)[0]))
os.close(fd)
"
# Expected: Product: 911   FW: 0x1060
```

### 7. Move PN532 to I2C bus 3

Frees I2C bus 1 (GPIO2/3) exclusively for GT911.

```bash
sudo nano /boot/firmware/config.txt
```

Add under `[all]`:
```
dtoverlay=i2c3-pi5,pins_6_7
```

**Rewire PN532**: SDA → GPIO6 (pin 31), SCL → GPIO7 (pin 26).

```bash
sudo reboot
# Verify:
sudo /usr/sbin/i2cdetect -y 3   # PN532 at 0x24
sudo /usr/sbin/i2cdetect -y 1   # GT911 at 0x14
```

Update `pi/setup.py`:
```python
PN532_I2C = Pn532I2c(Pn532I2c.RPI_BUS3)  # GPIO6/7
```

### 8. Run the GUI demo

```bash
source ~/betterwallet/.venv/bin/activate

# BetterWallet main UI
SDL_VIDEODRIVER=kmsdrm SDL_VIDEO_KMSDRM_DEVICE_INDEX=1 SDL_MOUSE_RELATIVE=0 \
  python3 ~/betterwallet/pi/gui/demo.py

# Touch test (4-button diagnostic)
SDL_VIDEODRIVER=kmsdrm SDL_VIDEO_KMSDRM_DEVICE_INDEX=1 SDL_MOUSE_RELATIVE=0 \
  python3 ~/betterwallet/pi/gui/touch_test.py
```

To run persistently (survives SSH disconnect):
```bash
setsid env SDL_VIDEODRIVER=kmsdrm SDL_VIDEO_KMSDRM_DEVICE_INDEX=1 SDL_MOUSE_RELATIVE=0 \
  python3 ~/betterwallet/pi/gui/demo.py </dev/null >/tmp/demo.log 2>&1 &
```

To stop:
```bash
pkill -f demo.py
pkill -f touch_test.py
```

---

## Final `/boot/firmware/config.txt` `[all]` Section

```
[all]
dtparam=spi=on
dtoverlay=mipi-dbi-spi,speed=48000000
dtparam=compatible=st7796s\0panel-mipi-dbi-spi
dtparam=width=320,height=480,width-mm=49,height-mm=79
dtparam=reset-gpio=27,dc-gpio=22,backlight-gpio=18
dtoverlay=goodix,addr=0x14,interrupt=17,reset=25
dtoverlay=i2c3-pi5,pins_6_7
```

---

## I2C Bus Map

| `/dev/i2c-*` | Devices | GPIO |
|-------------|---------|------|
| `/dev/i2c-1` | GT911 touch @ **0x14** | SDA=GPIO2, SCL=GPIO3 |
| `/dev/i2c-3` | PN532 NFC @ **0x24** | SDA=GPIO6, SCL=GPIO7 |

---

## DRM / Display Devices

| `/dev/dri/` | Role |
|-------------|------|
| `card0` | HDMI |
| `card1` | SPI LCD (Waveshare 3.5") — target this one |
| `card2` | HDMI |
| `renderD128` | GPU render node |

---

## Software

### Python venv
```
~/betterwallet/.venv   (Python 3.13)
```
Key packages: `pn532pi`, `pygame 2.6.1 (SDL 2.32.4)`, `RPi.GPIO`

### pn532pi Library Patches
- File on Pi: `~/.venv/lib/python3.13/site-packages/pn532pi/interfaces/pn532i2c.py`
- Local copy: `pi/pn532i2c_patch.py`

### GUI Files (`pi/gui/`)

| File | Purpose |
|------|---------|
| `demo.py` | BetterWallet UI — 320×480, NFC pulse animation, tap-to-advance state machine |
| `touch_test.py` | 4-button touch diagnostic — shows tap coords and count |
| `gt911.py` | Userspace GT911 driver — resets chip via GPIO, polls I2C, posts pygame events |
| `start.sh` | Launch helper — sets SDL KMS env vars, runs `demo.py` |

---

## Known Issues

### GT911 kernel driver fails on Pi 5 (errno -121)
`Goodix-TS 1-005d: Error reading 1 bytes from 0x8140: -121` on every boot.  
Root cause: Pi 5 RP1 I2C controller returns `EREMOTEIO` (121) instead of `EIO` (5) on NAK. The upstream `goodix` kernel driver only handles EIO.  
**Fix**: `gt911.py` userspace driver bypasses the kernel driver entirely — resets the chip via GPIO, reads touch data from `/dev/i2c-1` at address `0x14`, and posts `pygame.MOUSEBUTTONDOWN` events.

### GT911 address is 0x14, not 0x5D
The HAT holds the INT pin LOW during reset, selecting I2C address `0x14`. The overlay default (`addr=0x5d`) was wrong. Confirmed by direct userspace read: product=`911`, fw=`0x1060`.

### pygame / SDL KMS requires `setsid` over SSH
SDL KMS holds `/dev/dri/card1` exclusively. A process launched in an SSH session gets SIGHUP on disconnect and releases the device. Always use `setsid ... &` or `nohup ... & disown`.

### PN532 EREMOTEIO (errno 121) on Pi 5
Same root cause as GT911. Fixed in userspace (`pn532i2c_patch.py`) by catching both `errno.EIO` and `121` throughout the I2C transaction cycle.
