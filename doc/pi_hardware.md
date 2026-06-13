# BetterWallet Pi Hardware Reference

## Hardware Components

| Component | Model | Interface |
|-----------|-------|-----------|
| Single-board computer | Raspberry Pi 5 (RP1 chip, Debian Trixie, kernel 6.18) | — |
| NFC reader | PN532 breakout board | I2C bus 3 (GPIO6/7) |
| Display | Waveshare 3.5" RPi LCD (F) — ST7796S, 320×480 | SPI0 + I2C bus 1 (touch) |
| Touch controller | GT911 (on LCD HAT) | I2C bus 1 (GPIO2/3) |

---

## Wiring

### PN532 NFC Reader → Pi 5

> **Note:** PN532 was originally on I2C bus 1 (GPIO2/3). Moved to bus 3 to free bus 1 for the GT911 touch controller.

| PN532 Pin | Pi Pin | BCM GPIO |
|-----------|--------|----------|
| VCC | Pin 1 (3.3V) | — |
| GND | Pin 6 (GND) | — |
| SDA | **Pin 31** | **GPIO6** |
| SCL | **Pin 26** | **GPIO7** |

PN532 DIP switches: **I2C mode** (A0=1, A1=0 on most boards — verify with your board's silkscreen).

### Waveshare 3.5" LCD (F) HAT

Covers all 40 GPIO pins. The HAT connector carries:

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

## `/boot/firmware/config.txt` Key Entries

```
dtparam=i2c_arm=on
dtparam=spi=on

# Waveshare 3.5" LCD (F) — ST7796S via mipi-dbi-spi
dtoverlay=mipi-dbi-spi,speed=48000000
dtparam=compatible=st7796s\0panel-mipi-dbi-spi
dtparam=width=320,height=480,width-mm=49,height-mm=79
dtparam=reset-gpio=27,dc-gpio=22,backlight-gpio=18

# GT911 capacitive touch controller on LCD HAT
# interrupt=17 (GPIO17), reset=25 (GPIO25)
dtoverlay=goodix,addr=0x5d,interrupt=17,reset=25

# PN532 NFC reader on dedicated I2C bus 3 (GPIO6=SDA, GPIO7=SCL)
dtoverlay=i2c3-pi5,pins_6_7

dtoverlay=vc4-kms-v3d
max_framebuffers=2
```

---

## I2C Bus Map

| `/dev/i2c-*` | Bus | Devices | GPIO |
|-------------|-----|---------|------|
| `/dev/i2c-1` | I2C1 (hardware) | GT911 touch @ 0x5D | SDA=GPIO2, SCL=GPIO3 |
| `/dev/i2c-3` | I2C3 (hardware, Pi5) | PN532 NFC @ 0x24 | SDA=GPIO6, SCL=GPIO7 |

Verify after boot:
```bash
sudo i2cdetect -y 1   # should show 0x5d (GT911)
sudo i2cdetect -y 3   # should show 0x24 (PN532)
```

---

## DRM / Display Devices

| `/dev/dri/` | Role |
|-------------|------|
| `card0` | HDMI |
| `card1` | SPI LCD (Waveshare 3.5") |
| `card2` | HDMI |
| `renderD128` | GPU render node |

The pygame demo targets `card1` via SDL KMS:
```bash
SDL_VIDEODRIVER=kmsdrm SDL_VIDEO_KMSDRM_DEVICE_INDEX=1
```

---

## Software

### Python venv
```
~/betterwallet/.venv   (Python 3.13)
```
Key packages: `pn532pi`, `pygame 2.6.1 (SDL 2.32.4)`, `RPi.GPIO`

### pn532pi Library Patches
File: `~/.venv/lib/python3.13/site-packages/pn532pi/interfaces/pn532i2c.py`
Local copy: `pi/pn532i2c_patch.py`

Critical fixes applied for Pi 5 / RP1 I2C (EREMOTEIO = errno 121):

1. **`wakeup()`** — removed the `writing(addr, [0])` call; just `sleep(0.05)`. The write caused a NAK that locked the bus.
2. **`_readAckFrame()`** — catches `errno.EIO` and `121` (EREMOTEIO); sends NACK when response arrives in ACK slot (Pi 5 is fast enough to trigger this).
3. **`_getResponseLength()`** — wrapped read in `try/except` catching `errno.EIO` and `121`.
4. **Bus assertion** — relaxed from `bus in [0,1]` to any non-negative int; added `RPI_BUS3 = 3`.

### NFC setup (`pi/setup.py`)
```python
PN532_I2C = Pn532I2c(Pn532I2c.RPI_BUS3)  # I2C3: SDA=GPIO6 (pin 31), SCL=GPIO7 (pin 26)
```

### GUI Demo (`pi/gui/`)

| File | Purpose |
|------|---------|
| `demo.py` | BetterWallet pygame UI — 320×480 portrait, NFC pulse animation, tap-to-cycle state machine |
| `touch_test.py` | 4-button touch diagnostic — shows coords and tap count |
| `start.sh` | Launch helper — sets SDL env vars, runs `demo.py` |

Run from SSH:
```bash
nohup env SDL_VIDEODRIVER=kmsdrm SDL_VIDEO_KMSDRM_DEVICE_INDEX=1 SDL_MOUSE_RELATIVE=0 \
  python3 ~/betterwallet/pi/gui/demo.py </dev/null >/tmp/demo.log 2>&1 &
```

---

## Known Issues

### GT911 touch not responding (errno -121)
The Goodix kernel driver probe fails with `Error reading 1 bytes from 0x8140: -121` on every boot. The Pi 5 RP1 I2C controller returns `EREMOTEIO` (121) instead of `EIO` (5) when a device NAKs, and the upstream goodix kernel driver only handles `EIO`. This is a kernel-level issue — unlike the userspace pn532pi fix, it cannot be patched without recompiling the driver. The GT911 does not appear on `i2cdetect -y 1` as a result.

**Workaround candidates (not yet tried):**
- Slow down I2C bus 1: `dtparam=i2c_arm=on,i2c_arm_baudrate=50000`
- Use a custom goodix kernel module with EREMOTEIO handling
- Check that the touch FPC cable on the HAT is fully seated

### `nohup`/`setsid` needed for pygame over SSH
SDL KMS acquires the DRM device exclusively. When launched directly in an SSH session the process gets SIGHUP on disconnect and releases `card1`. Always launch with `nohup ... & disown` or `setsid ... &` to survive SSH disconnect.
