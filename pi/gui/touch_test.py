import os
import sys
import time

os.environ.setdefault("SDL_VIDEODRIVER", "kmsdrm")
os.environ.setdefault("SDL_VIDEO_KMSDRM_DEVICE_INDEX", "1")
os.environ.setdefault("SDL_MOUSE_RELATIVE", "0")

import pygame

WIDTH, HEIGHT = 320, 480
BG     = (15, 15, 15)
WHITE  = (255, 255, 255)
GRAY   = (80, 80, 80)
GREEN  = (78, 255, 145)
RED    = (255, 80, 80)
BLUE   = (80, 160, 255)
YELLOW = (255, 220, 50)

BUTTONS = [
    {"label": "TAP ME",  "color": GREEN,  "rect": pygame.Rect(20, 60,  280, 80)},
    {"label": "TAP ME",  "color": BLUE,   "rect": pygame.Rect(20, 160, 280, 80)},
    {"label": "TAP ME",  "color": RED,    "rect": pygame.Rect(20, 260, 280, 80)},
    {"label": "TAP ME",  "color": YELLOW, "rect": pygame.Rect(20, 360, 280, 80)},
]

def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.FULLSCREEN | pygame.NOFRAME)
    pygame.mouse.set_visible(False)
    font_lg = pygame.font.SysFont("dejavusans", 22, bold=True)
    font_sm = pygame.font.SysFont("dejavusans", 13)
    clock  = pygame.time.Clock()

    active  = {}   # button index → timestamp when last tapped
    log     = ["Waiting for touch or click..."]
    tap_count = 0

    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit(); sys.exit()
            if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                pygame.quit(); sys.exit()

            pos = None
            if event.type == pygame.MOUSEBUTTONDOWN:
                pos = event.pos
                log.append(f"MOUSE  ({pos[0]},{pos[1]})")
            elif event.type == pygame.FINGERDOWN:
                pos = (int(event.x * WIDTH), int(event.y * HEIGHT))
                log.append(f"FINGER ({pos[0]},{pos[1]})")

            if pos:
                tap_count += 1
                for i, btn in enumerate(BUTTONS):
                    if btn["rect"].collidepoint(pos):
                        active[i] = time.time()
                        log.append(f"  -> Button {i+1} hit!")

        now = time.time()

        screen.fill(BG)

        # Header
        header = font_lg.render("Touch Test", True, WHITE)
        screen.blit(header, (WIDTH // 2 - header.get_width() // 2, 18))

        # Buttons
        for i, btn in enumerate(BUTTONS):
            lit = (i in active) and (now - active[i] < 0.5)
            color = btn["color"] if lit else GRAY
            pygame.draw.rect(screen, color, btn["rect"], border_radius=12)
            lbl = font_lg.render(btn["label"], True, BG if lit else WHITE)
            cx = btn["rect"].centerx - lbl.get_width() // 2
            cy = btn["rect"].centery - lbl.get_height() // 2
            screen.blit(lbl, (cx, cy))

        # Log panel
        log_y = 450
        for i, line in enumerate(log[-2:]):
            t = font_sm.render(line, True, GREEN if "hit" in line else GRAY)
            screen.blit(t, (10, log_y + i * 15))

        # Tap counter
        cnt = font_sm.render(f"Taps: {tap_count}", True, WHITE)
        screen.blit(cnt, (WIDTH - cnt.get_width() - 10, HEIGHT - 18))

        pygame.display.flip()
        clock.tick(30)

if __name__ == "__main__":
    main()
