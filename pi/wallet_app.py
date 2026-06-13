"""Better Wallet hardware wallet GUI powered by Pygame."""

from __future__ import annotations

import queue
import sys
import threading
import time
from pathlib import Path
from typing import Any

from gui.display_setup import ensure_system_pygame

ensure_system_pygame()

import pygame


def _inject_known_venv_site_packages() -> None:
    """Allow system-python reexec to import deps installed in known venv."""
    version = f"python{sys.version_info.major}.{sys.version_info.minor}"
    candidates = [
        Path.home() / "betterwallet" / ".venv" / "lib" / version / "site-packages",
        Path(__file__).resolve().parents[1] / ".venv" / "lib" / version / "site-packages",
    ]
    for candidate in candidates:
        candidate_str = str(candidate)
        if candidate.exists() and candidate_str not in sys.path:
            sys.path.insert(0, candidate_str)


try:
    import qrcode
except ModuleNotFoundError:
    _inject_known_venv_site_packages()
    import qrcode

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
ASSETS_DIR = ROOT_DIR / "assets"

from nfc_wallet_service import (  # noqa: E402
    NfcWalletService,
    STATUS_ERROR,
    STATUS_READY,
    STATUS_STOPPED,
    STATUS_TIMEOUT,
    SignReview,
    is_retryable_nfc_error_message,
)
from pin_store import enroll_pin, pin_exists, verify_pin  # noqa: E402
from wallet_keys import EvmKeypair, SolanaKeypair, load_or_create_all_keypairs  # noqa: E402

WIDTH, HEIGHT = 320, 480
FPS = 30
FOOTER_HEIGHT = 42

BG = (8, 10, 12)
CARD_BG = (24, 26, 31)
CARD_BG_ALT = (32, 34, 39)
BORDER = (44, 48, 56)
TEXT_MAIN = (236, 238, 240)
TEXT_DIM = (166, 170, 176)
ACCENT = (200, 243, 35)
ACCENT_DIM = (88, 108, 20)
ERROR = (232, 96, 96)
BUTTON_DARK = (34, 36, 40)

SCREEN_PIN_CREATE = "pin_create"
SCREEN_PIN_CONFIRM = "pin_confirm"
SCREEN_HOME = "home"
SCREEN_NETWORK = "network"
SCREEN_PAIRING = "pairing"
SCREEN_CLEAR_SIGN = "clear_sign"
SCREEN_PIN_VERIFY = "pin_verify"
SCREEN_SEND_WAIT = "send_wait"
SCREEN_STATUS = "status"


def init_display() -> pygame.Surface:
    pygame.init()
    flags = pygame.FULLSCREEN | pygame.NOFRAME
    try:
        screen = pygame.display.set_mode((WIDTH, HEIGHT), flags)
    except Exception:
        screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Better Wallet Wallet")
    pygame.mouse.set_visible(False)
    return screen


def load_fonts() -> dict[str, pygame.font.Font]:
    return {
        "title": pygame.font.SysFont("dejavusans", 28, bold=True),
        "h1": pygame.font.SysFont("dejavusans", 20, bold=True),
        "h2": pygame.font.SysFont("dejavusans", 16, bold=True),
        "body": pygame.font.SysFont("dejavusans", 14),
        "small": pygame.font.SysFont("dejavusans", 12),
        "mono": pygame.font.SysFont("dejavusansmono", 12),
        "pin": pygame.font.SysFont("dejavusans", 32, bold=True),
    }


def event_position(event: pygame.event.Event) -> tuple[int, int] | None:
    if event.type == pygame.MOUSEBUTTONDOWN:
        return event.pos
    if event.type == pygame.FINGERDOWN:
        return int(event.x * WIDTH), int(event.y * HEIGHT)
    return None


def draw_round_rect(surface: pygame.Surface, rect: pygame.Rect, color: tuple[int, int, int], radius: int = 16) -> None:
    pygame.draw.rect(surface, color, rect, border_radius=radius)


def draw_text(surface: pygame.Surface, font: pygame.font.Font, text: str, color: tuple[int, int, int], pos: tuple[int, int]) -> None:
    rendered = font.render(text, True, color)
    surface.blit(rendered, pos)


def draw_text_center(surface: pygame.Surface, font: pygame.font.Font, text: str, color: tuple[int, int, int], center: tuple[int, int]) -> None:
    rendered = font.render(text, True, color)
    rect = rendered.get_rect(center=center)
    surface.blit(rendered, rect)


def shorten_address(address: str, left: int = 8, right: int = 6) -> str:
    if len(address) <= left + right + 3:
        return address
    return f"{address[:left]}...{address[-right:]}"


def wrap_text(text: str, font: pygame.font.Font, width: int) -> list[str]:
    def split_long_word(word: str) -> list[str]:
        chunks: list[str] = []
        remainder = word
        while remainder and font.size(remainder)[0] > width:
            idx = len(remainder)
            while idx > 1 and font.size(remainder[:idx])[0] > width:
                idx -= 1
            chunks.append(remainder[:idx])
            remainder = remainder[idx:]
        if remainder:
            chunks.append(remainder)
        return chunks

    words = text.split(" ")
    lines: list[str] = []
    current = ""
    for word in words:
        if font.size(word)[0] > width:
            parts = split_long_word(word)
            if current:
                lines.append(current)
                current = ""
            lines.extend(parts[:-1])
            word = parts[-1]

        trial = word if not current else f"{current} {word}"
        if font.size(trial)[0] <= width:
            current = trial
            continue
        if current:
            lines.append(current)
        current = word
    if current:
        lines.append(current)
    return lines if lines else [""]


def create_qr_surface(payload: str, size: int = 154) -> pygame.Surface:
    qr = qrcode.QRCode(border=1, box_size=4)
    qr.add_data(payload)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white").convert("RGB").resize((size, size))
    return pygame.image.fromstring(image.tobytes(), image.size, image.mode)


def load_chain_logo(filename: str, size: int = 34) -> pygame.Surface | None:
    logo_path = ASSETS_DIR / filename
    try:
        image = pygame.image.load(str(logo_path)).convert_alpha()
        return pygame.transform.smoothscale(image, (size, size))
    except Exception:
        return None


class WalletGuiApp:
    def __init__(self) -> None:
        self.screen = init_display()
        self.fonts = load_fonts()
        self.clock = pygame.time.Clock()
        self.running = True
        self.frame = 0

        self.evm_keypair: EvmKeypair
        self.solana_keypair: SolanaKeypair
        keypairs = load_or_create_all_keypairs()
        self.evm_keypair = keypairs["evm"]  # type: ignore[assignment]
        self.solana_keypair = keypairs["solana"]  # type: ignore[assignment]

        self.nfc_service = NfcWalletService()
        self.worker_queue: queue.Queue[tuple[str, Any]] = queue.Queue()
        self.worker_thread: threading.Thread | None = None
        self.worker_stop_event: threading.Event | None = None
        self.listen_mode = "idle"  # idle | passive | pairing
        self.pending_sign_request: dict[str, Any] | None = None
        self.pending_review: SignReview | None = None

        self.current_screen = SCREEN_HOME if pin_exists() else SCREEN_PIN_CREATE
        self.selected_chain = "evm"
        self.status_message = ""
        self.error_message = ""
        self.send_wait_error = ""
        self.pending_send_response: dict[str, Any] | None = None
        self.pending_send_label: str | None = None
        self.log_lines: list[str] = ["Wallet started", "Keys loaded"]

        self.pin_input = ""
        self.pin_first = ""
        self.pin_prompt = "Create 6-digit PIN"
        self.pin_error = ""

        self.clear_sign_scroll = 0
        self.review_lines_cache: list[str] = []
        self.qr_cache: dict[str, pygame.Surface] = {}
        self.chain_logos: dict[str, pygame.Surface | None] = {
            "evm": load_chain_logo("ethereum.png"),
            "solana": load_chain_logo("solana.png"),
        }

    def run(self) -> None:
        while self.running:
            self.handle_events()
            self.process_worker_events()
            self.draw()
            pygame.display.flip()
            self.frame = (self.frame + 1) % 120
            self.clock.tick(FPS)

        self.stop_worker()
        pygame.quit()

    def stop_worker(self) -> None:
        if self.worker_stop_event:
            self.worker_stop_event.set()
        if self.worker_thread and self.worker_thread.is_alive():
            self.worker_thread.join(timeout=0.3)
        self.worker_thread = None
        self.worker_stop_event = None
        self.listen_mode = "idle"

    def start_listen_worker(self, mode: str = "pairing") -> None:
        self.stop_worker()
        self.worker_stop_event = threading.Event()
        self.listen_mode = mode

        def target() -> None:
            status, request = self.nfc_service.wait_for_json_request(stop_event=self.worker_stop_event)
            if status != STATUS_READY:
                self.worker_queue.put(("listen_status", (status, request)))
                return
            assert request is not None
            if self.nfc_service.is_pair_request(request):
                response = self.nfc_service.build_pair_response(request, self.evm_keypair, self.solana_keypair)
                ok, message = self.nfc_service.send_json_response(response, stop_event=self.worker_stop_event)
                self.worker_queue.put(("pair_done", (ok, message, response)))
                return
            if self.nfc_service.is_sign_request(request):
                try:
                    review = self.nfc_service.build_sign_review(request, self.evm_keypair, self.solana_keypair)
                    self.worker_queue.put(("sign_review", (request, review)))
                except Exception as exc:  # noqa: BLE001
                    self.worker_queue.put(("listen_status", (STATUS_ERROR, {"message": str(exc)})))
                return
            self.worker_queue.put(("listen_status", (STATUS_ERROR, {"message": "Unsupported NFC request type."})))

        self.worker_thread = threading.Thread(target=target, daemon=True)
        self.worker_thread.start()

    def start_send_worker(self, response: dict[str, Any], label: str) -> None:
        self.stop_worker()
        self.worker_stop_event = threading.Event()
        self.pending_send_response = response
        self.pending_send_label = label
        self.send_wait_error = ""

        def target() -> None:
            ok, message = self.nfc_service.send_json_response(response, stop_event=self.worker_stop_event)
            self.worker_queue.put(("send_done", (ok, message, label, response)))

        self.worker_thread = threading.Thread(target=target, daemon=True)
        self.worker_thread.start()

    def set_screen(self, screen_name: str) -> None:
        if screen_name != SCREEN_NETWORK and self.listen_mode == "passive":
            self.stop_worker()
        self.current_screen = screen_name
        self.error_message = ""
        if screen_name == SCREEN_NETWORK:
            self.ensure_passive_sign_listen()

    def ensure_passive_sign_listen(self) -> None:
        if self.worker_thread and self.worker_thread.is_alive():
            return
        self.start_listen_worker(mode="passive")

    def begin_pair_or_sign(self) -> None:
        self.status_message = "Ready to pair. Hold phone near wallet."
        self.log_lines.append("Waiting for NFC request")
        self.start_listen_worker(mode="pairing")
        self.set_screen(SCREEN_PAIRING)

    def handle_events(self) -> None:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
                return
            if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                self.running = False
                return

            pos = event_position(event)
            if not pos:
                continue

            if self.current_screen in (SCREEN_PIN_CREATE, SCREEN_PIN_CONFIRM, SCREEN_PIN_VERIFY):
                self.handle_pin_screen_press(pos)
            elif self.current_screen == SCREEN_HOME:
                self.handle_home_press(pos)
            elif self.current_screen == SCREEN_NETWORK:
                self.handle_network_press(pos)
            elif self.current_screen == SCREEN_PAIRING:
                self.handle_pairing_press(pos)
            elif self.current_screen == SCREEN_CLEAR_SIGN:
                self.handle_clear_sign_press(pos)
            elif self.current_screen == SCREEN_STATUS:
                self.handle_status_press(pos)
            elif self.current_screen == SCREEN_SEND_WAIT:
                self.handle_send_wait_press(pos)

    def process_worker_events(self) -> None:
        while True:
            try:
                event_name, payload = self.worker_queue.get_nowait()
            except queue.Empty:
                break

            if event_name == "listen_status":
                status, detail = payload
                if status == STATUS_TIMEOUT:
                    detail_message = ""
                    if isinstance(detail, dict):
                        detail_message = str(detail.get("message", ""))
                    if detail_message and is_retryable_nfc_error_message(detail_message):
                        self.log_lines.append("Card moved away; retrying NFC listen")
                        self.start_listen_worker(mode=self.listen_mode)
                        continue
                    if self.listen_mode == "passive":
                        self.log_lines.append("Passive listen timed out; retrying")
                        self.start_listen_worker(mode="passive")
                        continue
                    self.status_message = "Timed out waiting for phone. Tap Pair to retry."
                    self.set_screen(SCREEN_STATUS)
                elif status == STATUS_STOPPED:
                    self.set_screen(SCREEN_NETWORK)
                else:
                    if self.listen_mode == "passive":
                        self.log_lines.append("Passive NFC error")
                        self.start_listen_worker(mode="passive")
                        continue
                    message = "NFC error."
                    if isinstance(detail, dict):
                        message = str(detail.get("message", message))
                    self.error_message = message
                    self.status_message = message
                    self.set_screen(SCREEN_STATUS)

            elif event_name == "pair_done":
                ok, message, response = payload
                if ok:
                    chain = response.get("chain", "unknown")
                    self.status_message = f"Pairing complete ({chain})."
                    self.log_lines.append(f"Paired {chain}")
                else:
                    if is_retryable_nfc_error_message(message):
                        self.log_lines.append("Pair response interrupted; waiting for retap")
                        self.start_send_worker(response, "Pairing response")
                        self.set_screen(SCREEN_SEND_WAIT)
                        continue
                    self.status_message = f"Pairing failed: {message}"
                self.set_screen(SCREEN_STATUS)

            elif event_name == "sign_review":
                request, review = payload
                self.pending_sign_request = request
                self.pending_review = review
                self.clear_sign_scroll = 0
                self.review_lines_cache = self.build_review_lines(review)
                self.set_screen(SCREEN_CLEAR_SIGN)

            elif event_name == "send_done":
                ok, message, label, response = payload
                if ok:
                    self.status_message = f"{label} complete."
                    self.log_lines.append(f"{label} sent")
                    self.pending_send_response = None
                    self.pending_send_label = None
                    self.send_wait_error = ""
                    self.pending_sign_request = None
                    self.pending_review = None
                    self.pin_input = ""
                    self.set_screen(SCREEN_STATUS)
                else:
                    if is_retryable_nfc_error_message(message):
                        self.log_lines.append("Card moved away during send; waiting for retap")
                        self.start_send_worker(response, label)
                        self.set_screen(SCREEN_SEND_WAIT)
                        continue
                    self.send_wait_error = f"{label} failed: {message}"
                    self.status_message = self.send_wait_error
                    self.log_lines.append(self.send_wait_error)
                    self.pending_sign_request = None
                    self.pending_review = None
                    self.pin_input = ""
                    self.set_screen(SCREEN_STATUS)

    def handle_home_press(self, pos: tuple[int, int]) -> None:
        evm_rect = pygame.Rect(20, 112, 135, 170)
        sol_rect = pygame.Rect(165, 112, 135, 170)
        if evm_rect.collidepoint(pos):
            self.selected_chain = "evm"
            self.set_screen(SCREEN_NETWORK)
        elif sol_rect.collidepoint(pos):
            self.selected_chain = "solana"
            self.set_screen(SCREEN_NETWORK)

    def handle_network_press(self, pos: tuple[int, int]) -> None:
        back_btn, pair_btn = self.network_button_rects()
        if back_btn.collidepoint(pos):
            self.set_screen(SCREEN_HOME)
            return
        if pair_btn.collidepoint(pos):
            self.begin_pair_or_sign()

    def handle_pairing_press(self, pos: tuple[int, int]) -> None:
        if self.footer_safe_wide_button_rect().collidepoint(pos):
            self.stop_worker()
            self.set_screen(SCREEN_NETWORK)

    def handle_clear_sign_press(self, pos: tuple[int, int]) -> None:
        reject_btn, accept_btn = self.clear_sign_button_rects()
        if reject_btn.collidepoint(pos):
            if self.pending_sign_request:
                reject_response = self.nfc_service.build_reject_response(self.pending_sign_request)
                self.start_send_worker(reject_response, "Reject response")
                self.set_screen(SCREEN_SEND_WAIT)
            return
        if accept_btn.collidepoint(pos):
            self.pin_input = ""
            self.pin_error = ""
            self.pin_prompt = "Enter PIN to Sign"
            self.set_screen(SCREEN_PIN_VERIFY)
            return
        if pygame.Rect(270, 154, 32, 32).collidepoint(pos):
            self.clear_sign_scroll = max(0, self.clear_sign_scroll - 1)
        if pygame.Rect(270, 190, 32, 32).collidepoint(pos):
            max_scroll = max(0, len(self.review_lines_cache) - self.clear_sign_visible_line_count())
            self.clear_sign_scroll = min(max_scroll, self.clear_sign_scroll + 1)

    def handle_send_wait_press(self, pos: tuple[int, int]) -> None:
        if self.send_wait_error:
            cancel_btn, retry_btn = self.send_wait_button_rects()
            if retry_btn.collidepoint(pos):
                if self.pending_send_response and self.pending_send_label:
                    self.send_wait_error = ""
                    self.start_send_worker(self.pending_send_response, self.pending_send_label)
                    self.set_screen(SCREEN_SEND_WAIT)
                return
            if cancel_btn.collidepoint(pos):
                self.pending_send_response = None
                self.pending_send_label = None
                self.send_wait_error = ""
                self.pending_sign_request = None
                self.pending_review = None
                self.pin_input = ""
                self.stop_worker()
                self.status_message = "Transfer cancelled."
                self.set_screen(SCREEN_STATUS)
                return
        if self.footer_safe_wide_button_rect().collidepoint(pos):
            self.pending_send_response = None
            self.pending_send_label = None
            self.send_wait_error = ""
            self.pending_sign_request = None
            self.pending_review = None
            self.pin_input = ""
            self.stop_worker()
            self.status_message = "Transfer cancelled."
            self.set_screen(SCREEN_STATUS)

    def handle_status_press(self, pos: tuple[int, int]) -> None:
        if self.footer_safe_wide_button_rect().collidepoint(pos):
            self.set_screen(SCREEN_NETWORK)

    def footer_safe_wide_button_rect(self) -> pygame.Rect:
        return pygame.Rect(18, HEIGHT - FOOTER_HEIGHT - 66, 284, 56)

    def network_button_rects(self) -> tuple[pygame.Rect, pygame.Rect]:
        y = HEIGHT - FOOTER_HEIGHT - 48
        return pygame.Rect(16, y, 140, 38), pygame.Rect(164, y, 140, 38)

    def clear_sign_button_rects(self) -> tuple[pygame.Rect, pygame.Rect]:
        y = HEIGHT - FOOTER_HEIGHT - 64
        return pygame.Rect(18, y, 138, 50), pygame.Rect(164, y, 138, 50)

    def send_wait_button_rects(self) -> tuple[pygame.Rect, pygame.Rect]:
        y = HEIGHT - FOOTER_HEIGHT - 64
        return pygame.Rect(18, y, 138, 50), pygame.Rect(164, y, 138, 50)

    def clear_sign_visible_line_count(self) -> int:
        panel_height = 218
        top_padding = 12
        bottom_padding = 12
        line_height = 22
        return max(1, (panel_height - top_padding - bottom_padding) // line_height)

    def handle_pin_screen_press(self, pos: tuple[int, int]) -> None:
        for label, rect in self.pin_keypad_layout():
            if rect.collidepoint(pos):
                if label.isdigit():
                    if len(self.pin_input) < 6:
                        self.pin_input += label
                elif label == "DEL":
                    self.pin_input = self.pin_input[:-1]
                elif label == "OK":
                    self.handle_pin_submit()

    def handle_pin_submit(self) -> None:
        if len(self.pin_input) != 6:
            self.pin_error = "PIN must be 6 digits."
            return

        if self.current_screen == SCREEN_PIN_CREATE:
            self.pin_first = self.pin_input
            self.pin_input = ""
            self.pin_error = ""
            self.pin_prompt = "Confirm your 6-digit PIN"
            self.set_screen(SCREEN_PIN_CONFIRM)
            return

        if self.current_screen == SCREEN_PIN_CONFIRM:
            if self.pin_input != self.pin_first:
                self.pin_error = "PIN mismatch. Try again."
                self.pin_input = ""
                return
            enroll_pin(self.pin_input)
            self.pin_first = ""
            self.pin_input = ""
            self.pin_prompt = "PIN set"
            self.log_lines.append("PIN enrolled")
            self.set_screen(SCREEN_HOME)
            return

        if self.current_screen == SCREEN_PIN_VERIFY:
            if not verify_pin(self.pin_input):
                self.pin_error = "Incorrect PIN."
                self.pin_input = ""
                return
            if not self.pending_sign_request:
                self.status_message = "Missing sign request."
                self.set_screen(SCREEN_STATUS)
                return
            try:
                response = self.nfc_service.build_signed_response(
                    self.pending_sign_request, self.evm_keypair, self.solana_keypair
                )
            except Exception as exc:  # noqa: BLE001
                self.status_message = f"Signing failed: {exc}"
                self.set_screen(SCREEN_STATUS)
                return
            self.pin_error = ""
            self.start_send_worker(response, "Signed transaction")
            self.set_screen(SCREEN_SEND_WAIT)

    def pin_keypad_layout(self) -> list[tuple[str, pygame.Rect]]:
        labels = [
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "DEL",
            "0",
            "OK",
        ]
        result: list[tuple[str, pygame.Rect]] = []
        x0, y0 = 24, 154
        w, h = 84, 64
        gap = 10
        for idx, label in enumerate(labels):
            row, col = divmod(idx, 3)
            rect = pygame.Rect(x0 + col * (w + gap), y0 + row * (h + gap), w, h)
            result.append((label, rect))
        return result

    def chain_display(self) -> tuple[str, str, str]:
        if self.selected_chain == "solana":
            return ("Solana", "Devnet", self.solana_keypair.address)
        return ("Ethereum", "Sepolia", self.evm_keypair.address)

    def chain_qr_payload(self) -> str:
        if self.selected_chain == "solana":
            return f"solana:{self.solana_keypair.address}?cluster=devnet"
        return f"ethereum:{self.evm_keypair.address}@11155111"

    def get_qr_surface(self) -> pygame.Surface:
        payload = self.chain_qr_payload()
        if payload not in self.qr_cache:
            self.qr_cache[payload] = create_qr_surface(payload)
        return self.qr_cache[payload]

    def build_review_lines(self, review: SignReview) -> list[str]:
        wrapped: list[str] = []
        for line in review.lines:
            wrapped.extend(wrap_text(line, self.fonts["small"], 238))
        if review.raw_preview.strip():
            wrapped.append("")
            wrapped.extend(wrap_text("Payload:", self.fonts["small"], 238))
            for line in review.raw_preview.splitlines():
                wrapped.extend(wrap_text(line, self.fonts["small"], 238))
        return wrapped

    def draw(self) -> None:
        self.screen.fill(BG)
        if self.current_screen not in (SCREEN_PIN_CREATE, SCREEN_PIN_CONFIRM, SCREEN_PIN_VERIFY):
            self.draw_header()
        if self.current_screen == SCREEN_HOME:
            self.draw_home()
        elif self.current_screen == SCREEN_NETWORK:
            self.draw_network()
        elif self.current_screen == SCREEN_PAIRING:
            self.draw_pairing()
        elif self.current_screen == SCREEN_CLEAR_SIGN:
            self.draw_clear_sign()
        elif self.current_screen in (SCREEN_PIN_CREATE, SCREEN_PIN_CONFIRM, SCREEN_PIN_VERIFY):
            self.draw_pin_screen()
        elif self.current_screen == SCREEN_SEND_WAIT:
            self.draw_send_wait()
        elif self.current_screen == SCREEN_STATUS:
            self.draw_status()

    def draw_header(self) -> None:
        bar_y = HEIGHT - FOOTER_HEIGHT
        draw_round_rect(self.screen, pygame.Rect(0, bar_y, WIDTH, FOOTER_HEIGHT), (10, 12, 16), radius=0)
        pygame.draw.line(self.screen, BORDER, (0, bar_y), (WIDTH, bar_y), 1)
        draw_text(self.screen, self.fonts["body"], "BETTER WALLET", ACCENT, (14, bar_y + 12))
        gear_rect = pygame.Rect(280, bar_y + 7, 24, 24)
        draw_round_rect(self.screen, gear_rect, CARD_BG_ALT, radius=10)
        draw_text_center(self.screen, self.fonts["small"], "*", TEXT_MAIN, gear_rect.center)

    def draw_home(self) -> None:
        draw_text_center(self.screen, self.fonts["small"], "AUTHORIZED CHAINS ONLY", TEXT_DIM, (160, 84))
        chain_cards = [
            ("Ethereum", "Sepolia", pygame.Rect(20, 112, 135, 170), "evm"),
            ("Solana", "Devnet", pygame.Rect(165, 112, 135, 170), "solana"),
        ]
        for label, network_label, rect, chain_name in chain_cards:
            draw_round_rect(self.screen, rect, CARD_BG, radius=18)
            pygame.draw.rect(self.screen, BORDER, rect, width=1, border_radius=18)
            icon_rect = pygame.Rect(rect.x + 43, rect.y + 22, 48, 48)
            draw_round_rect(self.screen, icon_rect, CARD_BG_ALT, radius=24)
            logo = self.chain_logos.get(chain_name)
            if logo is not None:
                self.screen.blit(logo, logo.get_rect(center=icon_rect.center))
            else:
                draw_text_center(self.screen, self.fonts["h2"], label[0], ACCENT, icon_rect.center)
            draw_text_center(self.screen, self.fonts["h2"], label, TEXT_MAIN, (rect.centerx, rect.y + 100))
            draw_text_center(self.screen, self.fonts["small"], network_label, TEXT_DIM, (rect.centerx, rect.y + 124))
            if chain_name == self.selected_chain:
                pygame.draw.rect(self.screen, ACCENT, rect, width=2, border_radius=18)
        draw_text_center(self.screen, self.fonts["small"], "Tap a network to continue", TEXT_DIM, (160, 314))

    def draw_network(self) -> None:
        chain_name, network_name, address = self.chain_display()
        chain_key = "solana" if self.selected_chain == "solana" else "evm"
        heading_icon_rect = pygame.Rect(18, 36, 30, 30)
        draw_round_rect(self.screen, heading_icon_rect, CARD_BG_ALT, radius=15)
        heading_logo = self.chain_logos.get(chain_key)
        if heading_logo is not None:
            logo_small = pygame.transform.smoothscale(heading_logo, (22, 22))
            self.screen.blit(logo_small, logo_small.get_rect(center=heading_icon_rect.center))
        else:
            draw_text_center(self.screen, self.fonts["small"], chain_name[0], ACCENT, heading_icon_rect.center)

        heading_text_x = heading_icon_rect.right + 10
        draw_text(self.screen, self.fonts["title"], chain_name, TEXT_MAIN, (heading_text_x, 32))
        draw_text(self.screen, self.fonts["body"], network_name, TEXT_DIM, (heading_text_x, 66))

        card = pygame.Rect(18, 110, 284, 258)
        draw_round_rect(self.screen, card, CARD_BG, radius=18)
        pygame.draw.rect(self.screen, BORDER, card, width=1, border_radius=18)

        draw_text(self.screen, self.fonts["small"], "Public Address", TEXT_DIM, (32, 126))
        draw_text(self.screen, self.fonts["mono"], shorten_address(address, 14, 10), TEXT_MAIN, (32, 146))

        qr_surface = self.get_qr_surface()
        self.screen.blit(qr_surface, (83, 168))

        draw_text_center(self.screen, self.fonts["small"], "Scan for deposit", TEXT_DIM, (160, 346))

        back_btn, pair_btn = self.network_button_rects()
        draw_round_rect(self.screen, back_btn, BUTTON_DARK, radius=19)
        draw_round_rect(self.screen, pair_btn, ACCENT, radius=19)
        draw_text_center(self.screen, self.fonts["body"], "Back", TEXT_MAIN, back_btn.center)
        draw_text_center(self.screen, self.fonts["body"], "Pair", (15, 20, 5), pair_btn.center)

    def draw_pairing(self) -> None:
        draw_text(self.screen, self.fonts["title"], "Ready to Pair", ACCENT, (58, 138))
        draw_text_center(self.screen, self.fonts["h2"], "Hold near phone to link", TEXT_MAIN, (160, 186))
        draw_text_center(self.screen, self.fonts["small"], "Awaiting NFC handshake", TEXT_DIM, (160, 212))

        center = (160, 268)
        for idx in range(3):
            pulse = (self.frame + idx * 35) % 120
            radius = 30 + idx * 36 + pulse // 4
            alpha = max(15, 180 - pulse * 2)
            layer = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            pygame.draw.circle(layer, (ACCENT[0], ACCENT[1], ACCENT[2], alpha), center, radius, 2)
            self.screen.blit(layer, (0, 0))
        draw_round_rect(self.screen, pygame.Rect(136, 264, 48, 48), CARD_BG_ALT, radius=12)
        draw_text_center(self.screen, self.fonts["h2"], "N", ACCENT, (160, 288))

        cancel_btn = self.footer_safe_wide_button_rect()
        draw_round_rect(self.screen, cancel_btn, BUTTON_DARK, radius=26)
        draw_text_center(self.screen, self.fonts["h2"], "Cancel", TEXT_MAIN, cancel_btn.center)

    def draw_clear_sign(self) -> None:
        title = "Sign Transaction"
        if self.pending_review:
            title = self.pending_review.title

        title_font = self.fonts["title"]
        max_title_width = WIDTH - 36
        if title_font.size(title)[0] > max_title_width:
            title_font = self.fonts["h1"]
        if title_font.size(title)[0] > max_title_width:
            ellipsis = "..."
            trimmed = title
            while trimmed and title_font.size(trimmed + ellipsis)[0] > max_title_width:
                trimmed = trimmed[:-1]
            title = (trimmed + ellipsis) if trimmed else ellipsis

        draw_text(self.screen, title_font, title, TEXT_MAIN, (18, 70))
        draw_text(self.screen, self.fonts["small"], "SECURITY LEVEL: HIGH", TEXT_DIM, (18, 106))

        panel = pygame.Rect(18, 126, 284, 218)
        draw_round_rect(self.screen, panel, CARD_BG, radius=16)
        pygame.draw.rect(self.screen, BORDER, panel, width=1, border_radius=16)

        visible_count = self.clear_sign_visible_line_count()
        visible_lines = self.review_lines_cache[self.clear_sign_scroll : self.clear_sign_scroll + visible_count]
        y = 138
        for line in visible_lines:
            draw_text(self.screen, self.fonts["small"], line, TEXT_MAIN, (30, y))
            y += 22

        up_btn = pygame.Rect(270, 154, 32, 32)
        down_btn = pygame.Rect(270, 190, 32, 32)
        draw_round_rect(self.screen, up_btn, CARD_BG_ALT, radius=10)
        draw_round_rect(self.screen, down_btn, CARD_BG_ALT, radius=10)
        draw_text_center(self.screen, self.fonts["small"], "^", TEXT_MAIN, up_btn.center)
        draw_text_center(self.screen, self.fonts["small"], "v", TEXT_MAIN, down_btn.center)

        reject_btn, accept_btn = self.clear_sign_button_rects()
        draw_round_rect(self.screen, reject_btn, BUTTON_DARK, radius=24)
        draw_round_rect(self.screen, accept_btn, ACCENT, radius=24)
        draw_text_center(self.screen, self.fonts["body"], "Reject", TEXT_MAIN, reject_btn.center)
        draw_text_center(self.screen, self.fonts["body"], "Accept", (15, 20, 5), accept_btn.center)

    def draw_pin_screen(self) -> None:
        draw_text_center(self.screen, self.fonts["title"], "Enter PIN", TEXT_MAIN, (160, 74))
        draw_text_center(self.screen, self.fonts["small"], self.pin_prompt, TEXT_DIM, (160, 100))

        for idx in range(6):
            color = ACCENT if idx < len(self.pin_input) else BORDER
            pygame.draw.circle(self.screen, color, (80 + idx * 32, 130), 8, 0 if idx < len(self.pin_input) else 2)

        for label, rect in self.pin_keypad_layout():
            if label == "OK":
                draw_round_rect(self.screen, rect, ACCENT_DIM, radius=14)
                fg = ACCENT
            elif label == "DEL":
                draw_round_rect(self.screen, rect, BUTTON_DARK, radius=14)
                fg = TEXT_MAIN
            else:
                draw_round_rect(self.screen, rect, BUTTON_DARK, radius=14)
                fg = TEXT_MAIN
            draw_text_center(self.screen, self.fonts["h2"], label, fg, rect.center)

        if self.pin_error:
            draw_text_center(self.screen, self.fonts["small"], self.pin_error, ERROR, (160, 456))

    def draw_send_wait(self) -> None:
        draw_text_center(self.screen, self.fonts["title"], "Send Response", ACCENT, (160, 160))
        if self.send_wait_error:
            draw_text_center(
                self.screen,
                self.fonts["small"],
                "Unable to send NFC response. Phone moved away.",
                ERROR,
                (160, 192),
            )
            wrapped = wrap_text(self.send_wait_error, self.fonts["small"], 270)
            y = 214
            for line in wrapped[:4]:
                draw_text_center(self.screen, self.fonts["small"], line, TEXT_DIM, (160, y))
                y += 18
            cancel_btn, retry_btn = self.send_wait_button_rects()
            draw_round_rect(self.screen, cancel_btn, BUTTON_DARK, radius=24)
            draw_round_rect(self.screen, retry_btn, ACCENT, radius=24)
            draw_text_center(self.screen, self.fonts["body"], "Cancel", TEXT_MAIN, cancel_btn.center)
            draw_text_center(self.screen, self.fonts["body"], "Retry", (15, 20, 5), retry_btn.center)
            return

        draw_text_center(self.screen, self.fonts["body"], "Tap phone again to receive result", TEXT_MAIN, (160, 192))
        draw_text_center(self.screen, self.fonts["small"], "Waiting for second NFC tap", TEXT_DIM, (160, 216))
        cancel_btn = self.footer_safe_wide_button_rect()
        draw_round_rect(self.screen, cancel_btn, BUTTON_DARK, radius=26)
        draw_text_center(self.screen, self.fonts["h2"], "Cancel", TEXT_MAIN, cancel_btn.center)

    def draw_status(self) -> None:
        panel = pygame.Rect(18, 112, 284, 234)
        draw_round_rect(self.screen, panel, CARD_BG, radius=18)
        pygame.draw.rect(self.screen, BORDER, panel, width=1, border_radius=18)
        draw_text_center(self.screen, self.fonts["h1"], "Status", ACCENT, (160, 142))
        lines = wrap_text(self.status_message or "Done", self.fonts["body"], 240)
        y = 174
        for line in lines[:7]:
            draw_text_center(self.screen, self.fonts["body"], line, TEXT_MAIN, (160, y))
            y += 24
        back_btn = self.footer_safe_wide_button_rect()
        draw_round_rect(self.screen, back_btn, ACCENT, radius=26)
        draw_text_center(self.screen, self.fonts["h2"], "Back", (15, 20, 5), back_btn.center)

def main() -> None:
    app = WalletGuiApp()
    app.run()


if __name__ == "__main__":
    main()
