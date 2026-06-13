import math
import os
import sys
import time

# Use KMS/DRM directly — no X server needed on Pi 5
os.environ.setdefault("SDL_VIDEODRIVER", "kmsdrm")
os.environ.setdefault("SDL_VIDEO_KMSDRM_DEVICE_INDEX", "1")  # card1 = SPI LCD

import pygame

WIDTH, HEIGHT = 320, 480
FPS = 30

# Brand palette
BG       = (15,  15,  15)
SURFACE  = (25,  25,  25)
SURFACE2 = (35,  35,  35)
GREEN    = (78,  255, 145)
GREEN_DIM= (30,  100,  55)
WHITE    = (255, 255, 255)
GRAY     = (140, 140, 140)
RED      = (255,  80,  80)

STATES = ["idle", "tap1", "signing", "tap2", "done"]

def init_display():
    pygame.init()
    flags = pygame.FULLSCREEN | pygame.NOFRAME
    try:
        screen = pygame.display.set_mode((WIDTH, HEIGHT), flags)
    except Exception:
        screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("BetterWallet")
    pygame.mouse.set_visible(False)
    return screen

def load_fonts():
    return {
        "xl":  pygame.font.SysFont("dejavusans", 32, bold=True),
        "lg":  pygame.font.SysFont("dejavusans", 24, bold=True),
        "md":  pygame.font.SysFont("dejavusans", 18),
        "sm":  pygame.font.SysFont("dejavusans", 13),
    }

def draw_text_centered(surface, text, font, color, cy, x=WIDTH // 2):
    rendered = font.render(text, True, color)
    surface.blit(rendered, (x - rendered.get_width() // 2, cy - rendered.get_height() // 2))
    return rendered.get_height()

def draw_pill(surface, color, rect, radius=10):
    pygame.draw.rect(surface, color, rect, border_radius=radius)

def draw_nfc_pulse(surface, cx, cy, frame, color, active=True):
    if not active:
        pygame.draw.circle(surface, GREEN_DIM, (cx, cy), 28, 2)
        return
    for i in range(3):
        phase = (frame + i * 20) % 60
        radius = 28 + i * 22
        alpha = max(0, 255 - phase * 4)
        s = pygame.Surface((radius * 2 + 4, radius * 2 + 4), pygame.SRCALPHA)
        pygame.draw.circle(s, (*color, alpha), (radius + 2, radius + 2), radius, 2)
        surface.blit(s, (cx - radius - 2, cy - radius - 2))

def draw_header(surface, fonts):
    draw_pill(surface, SURFACE, pygame.Rect(0, 0, WIDTH, 58))
    draw_text_centered(surface, "BetterWallet", fonts["xl"], GREEN, 30)

def draw_wallet_card(surface, fonts):
    draw_pill(surface, SURFACE, pygame.Rect(16, 66, WIDTH - 32, 72), 12)
    draw_text_centered(surface, "WALLET", fonts["sm"], GRAY, 84)
    draw_text_centered(surface, "0x4A3f  ····  8e2B", fonts["md"], WHITE, 104)
    draw_pill(surface, SURFACE2, pygame.Rect(16 + 8, 66 + 46, WIDTH - 32 - 16, 18), 6)
    draw_text_centered(surface, "1.2345 ETH   ·   $3,142.00", fonts["sm"], GREEN, 66 + 55)

def draw_status_card(surface, fonts, state, frame):
    card_y = 152
    draw_pill(surface, SURFACE, pygame.Rect(16, card_y, WIDTH - 32, 190), 12)

    cx, cy = WIDTH // 2, card_y + 90

    label_map = {
        "idle":    ("Ready", GRAY, False),
        "tap1":    ("Tap phone to send TX", WHITE, True),
        "signing": ("Signing...", GREEN, True),
        "tap2":    ("Tap again to receive", WHITE, True),
        "done":    ("Signed!", GREEN, False),
    }
    label, label_color, pulsing = label_map.get(state, ("Ready", GRAY, False))

    draw_nfc_pulse(surface, cx, cy, frame, GREEN, active=pulsing)

    # NFC icon
    nfc_surf = fonts["lg"].render("NFC", True, GREEN if pulsing else GREEN_DIM)
    surface.blit(nfc_surf, (cx - nfc_surf.get_width() // 2, cy - nfc_surf.get_height() // 2))

    draw_text_centered(surface, label, fonts["md"], label_color, card_y + 162)

def draw_log(surface, fonts, log_lines):
    y = 358
    draw_pill(surface, SURFACE, pygame.Rect(16, y, WIDTH - 32, 88), 12)
    draw_text_centered(surface, "LOG", fonts["sm"], GRAY, y + 12)
    for i, line in enumerate(log_lines[-3:]):
        color = GREEN if line.startswith("✓") else GRAY if line.startswith("·") else WHITE
        draw_text_centered(surface, line, fonts["sm"], color, y + 28 + i * 18)

def draw_footer(surface, fonts, state):
    dot_color = GREEN if state != "idle" else GRAY
    dot = "●"
    label = "NFC Active" if state != "idle" else "Waiting"
    draw_text_centered(surface, f"{dot}  {label}", fonts["sm"], dot_color, HEIGHT - 12)

def cycle_state(state):
    idx = STATES.index(state)
    return STATES[(idx + 1) % len(STATES)]

def main():
    screen = init_display()
    fonts  = load_fonts()
    clock  = pygame.time.Clock()

    state = "idle"
    frame = 0
    log_lines = ["· Waiting for tap...", "· NFC reader ready", "· BetterWallet v0.1"]
    state_ts  = time.time()

    log_map = {
        "tap1":    "· TAP 1: send TX",
        "signing": "· Signing transaction...",
        "tap2":    "✓ Signed! TAP 2 to receive",
        "done":    "✓ Transaction complete",
        "idle":    "· Waiting for tap...",
    }

    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit(); sys.exit()
            if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                pygame.quit(); sys.exit()
            # Touch / click advances demo state
            if event.type in (pygame.MOUSEBUTTONDOWN, pygame.FINGERDOWN):
                state = cycle_state(state)
                state_ts = time.time()
                log_lines.append(log_map.get(state, "·"))

        # Auto-advance signing after 2 s for demo feel
        if state == "signing" and time.time() - state_ts > 2:
            state = "tap2"
            state_ts = time.time()
            log_lines.append(log_map["tap2"])

        screen.fill(BG)
        draw_header(screen, fonts)
        draw_wallet_card(screen, fonts)
        draw_status_card(screen, fonts, state, frame)
        draw_log(screen, fonts, log_lines)
        draw_footer(screen, fonts, state)

        pygame.display.flip()
        frame = (frame + 1) % 60
        clock.tick(FPS)

if __name__ == "__main__":
    main()
