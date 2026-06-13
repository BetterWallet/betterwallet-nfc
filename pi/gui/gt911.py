"""
Userspace GT911 touch driver for Raspberry Pi 5.
The kernel goodix driver fails on Pi 5 (EREMOTEIO / errno 121).
This module reads touch events directly from /dev/i2c-1 and posts
them as pygame MOUSEBUTTONDOWN / MOUSEBUTTONUP / MOUSEMOTION events.

Run gt911.start() once after pygame.init(). A background thread
handles polling so the main loop receives events normally.
"""

import os
import fcntl
import struct
import threading
import time

import RPi.GPIO as GPIO
import pygame

# ── Hardware constants ──────────────────────────────────────────────────────
I2C_BUS       = "/dev/i2c-1"
GT911_ADDR    = 0x14          # INT low during reset → address 0x14
I2C_SLAVE     = 0x0703

RST_GPIO      = 25            # BCM GPIO for GT911 RESET
INT_GPIO      = 17            # BCM GPIO for GT911 INT

# GT911 registers
REG_STATUS    = 0x814E        # touch-ready flag + touch count
REG_TOUCH1    = 0x8150        # first touch point (8 bytes)
DISPLAY_W     = 320
DISPLAY_H     = 480

POLL_HZ       = 60            # polls per second


def _write_reg(fd, reg, data: bytes = b""):
    os.write(fd, bytes([reg >> 8, reg & 0xFF]) + data)


def _read_reg(fd, reg, length: int) -> bytes:
    os.write(fd, bytes([reg >> 8, reg & 0xFF]))
    return os.read(fd, length)


def _reset():
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    GPIO.setup(RST_GPIO, GPIO.OUT)
    GPIO.setup(INT_GPIO, GPIO.OUT)
    GPIO.output(RST_GPIO, 0)   # assert reset
    GPIO.output(INT_GPIO, 0)   # INT low → address 0x14
    time.sleep(0.02)
    GPIO.output(RST_GPIO, 1)   # release reset
    time.sleep(0.10)           # GT911 needs ~55 ms to boot
    GPIO.setup(INT_GPIO, GPIO.IN)
    time.sleep(0.05)


def _poll(fd, stop_event: threading.Event):
    was_down = False
    interval = 1.0 / POLL_HZ

    while not stop_event.is_set():
        try:
            status_raw = _read_reg(fd, REG_STATUS, 1)
            status = status_raw[0]

            # Bit 7 = buffer-ready flag; low nibble = touch count
            ready  = bool(status & 0x80)
            count  = status & 0x0F

            if ready and count > 0:
                # Read first touch point: track_id(1) x(2) y(2) size(2) reserved(1)
                tp = _read_reg(fd, REG_TOUCH1, 8)
                x = struct.unpack_from("<H", tp, 1)[0]
                y = struct.unpack_from("<H", tp, 3)[0]

                # Clear the status register so GT911 accepts next touch
                _write_reg(fd, REG_STATUS, b"\x00")

                # Post pygame events
                pos = (min(x, DISPLAY_W - 1), min(y, DISPLAY_H - 1))
                if not was_down:
                    pygame.event.post(pygame.event.Event(
                        pygame.MOUSEBUTTONDOWN, {"pos": pos, "button": 1}
                    ))
                    was_down = True
                else:
                    pygame.event.post(pygame.event.Event(
                        pygame.MOUSEMOTION, {"pos": pos, "buttons": (1, 0, 0), "rel": (0, 0)}
                    ))
            else:
                # Clear buffer-ready even when count == 0
                if ready:
                    _write_reg(fd, REG_STATUS, b"\x00")

                if was_down:
                    pygame.event.post(pygame.event.Event(
                        pygame.MOUSEBUTTONUP, {"pos": (0, 0), "button": 1}
                    ))
                    was_down = False

        except OSError:
            # Transient I2C error — skip frame
            pass

        time.sleep(interval)


# ── Public API ──────────────────────────────────────────────────────────────
_stop  = threading.Event()
_thread: threading.Thread | None = None


def start():
    """Reset GT911 and start the background polling thread."""
    global _thread, _stop

    _reset()

    fd = os.open(I2C_BUS, os.O_RDWR)
    fcntl.ioctl(fd, I2C_SLAVE, GT911_ADDR)

    # Verify chip is alive
    try:
        info = _read_reg(fd, 0x8140, 6)
        pid  = info[:4].decode(errors="replace").strip()
        fw   = struct.unpack_from("<H", info, 4)[0]
        print(f"GT911 ready — product={pid!r}  fw=0x{fw:04x}")
    except OSError as e:
        print(f"GT911 not found on {I2C_BUS} @ 0x{GT911_ADDR:02x}: {e}")
        os.close(fd)
        return

    _stop.clear()
    _thread = threading.Thread(target=_poll, args=(fd, _stop), daemon=True)
    _thread.start()


def stop():
    """Stop the polling thread."""
    _stop.set()
    if _thread:
        _thread.join(timeout=1)
    GPIO.cleanup()
