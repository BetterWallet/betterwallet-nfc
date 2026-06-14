# How We Built Better Wallet NFC

Better Wallet NFC is an air-gapped signing prototype. The core idea is simple: use NFC as the only bridge between a phone and a hardware wallet, so sensitive signing never depends on Bluetooth, USB, or internet connectivity during approval.

In practice, the experience is a two-tap flow:

1. First tap sends an unsigned transaction from phone to wallet.
2. User reviews and approves on the wallet screen.
3. Second tap sends the signed payload back to the phone for broadcast.

Below is the full breakdown of how this came together across hardware, firmware, and app layers.

## Hardware

The hardware wallet runs on a Raspberry Pi 5 connected to:

- a PN532 NFC module (for near-field transfer),
- a Waveshare 3.5" ST7796S display, and
- a GT911 touch controller (for on-device approval input).

One practical challenge was bus contention and stability. To keep touch and NFC reliable at the same time, the PN532 was moved to I2C bus 3 (`GPIO6/GPIO7`), while the GT911 remained on I2C bus 1. That separation removed intermittent conflicts during active use.

Display rendering runs over SPI with KMS/DRM, and the wallet UI is rendered fullscreen via Pygame in a kiosk-style mode.

### Notable hardware hacks worth mentioning

- **RP1 I2C behavior on Pi 5**: both PN532 and GT911 exposed `EREMOTEIO`-style edge cases, which required defensive handling.
- **Resilient reset path**: PN532 resets through GPIO in normal operation, with automatic fallback to `pinctrl` shell reset if `RPi.GPIO` is unavailable.
- **Bus split for stability**: this was a very practical fix that dramatically improved touch + NFC reliability under real usage.

## Firmware / Wallet Runtime

The firmware/runtime is Python-based and organized into clear responsibilities: hardware setup, NFC transport, signing logic, and UI orchestration.

### Technologies used

- **Python** for core runtime
- **pn532pi** for PN532 transport control
- **eth-account, eth-keys, pycryptodome** for EVM signing stack
- **PyNaCl + base58** for Solana key/signature workflows
- **clearsig** for ERC-7730-style clear-sign translation
- **qrcode, Pillow, pygame** for local UX and pairing surfaces

### How the transport protocol works

Instead of high-level NDEF, we used a low-level APDU-style exchange with a custom AID. This gave full control over chunking, retries, and flow state:

- `0x01` asks phone for total payload length
- `0x02 + offset` reads a chunk from phone
- `0x03 + bytes` writes a chunk back to phone
- `0x04` commits transfer and triggers phone-side event

Chunks are intentionally capped at about 200 bytes to stay safely inside PN532 frame limits. That made large payload handling predictable and robust.

### Runtime behavior during a sign flow

- Wallet waits for tap 1 and reads a `sign_request` JSON.
- Request is parsed, validated, and transformed into a clear review screen.
- User approves on touch UI.
- Wallet signs locally (EVM or Solana path).
- Wallet waits for tap 2 and streams signed response back to phone.

This layer also includes automatic recovery logic for transport errors and transient card movement events, so the experience remains stable instead of failing hard.

### Firmware hacks that made it production-like

- **Transport self-healing**: automatic PN532 reconnect + reset when low-level I/O errors appear.
- **Offline-first clear-signing**: registry data is pre-downloaded and merged with a local overlay so no runtime network fetch is required.
- **Environment bridging for UI**: system Pygame compatibility and virtualenv dependencies are reconciled to keep graphics and crypto stack running together.

## Mobile App

The mobile app is built with React Native + Expo, but with native Android code for HCE (Host Card Emulation). This is important: Expo Go is not enough for this architecture because direct APDU handling needs native service access.

### App stack

- **React Native + Expo dev client**
- **Kotlin `HostApduService`** for Android HCE
- **React Native NativeModules + DeviceEventEmitter** for JS/native bridge
- **ethers** for blockchain transaction handling
- **@swype-org/deposit-mobile** for partner deposit and bridge-related user flows

### How the app and wallet are connected

- JS preloads payload into native state before first tap.
- Native HCE service serves/receives NFC chunks in real time.
- Session/progress events are emitted back to React Native:
  - waiting for tap
  - transferring to wallet
  - waiting for rescan
  - transferring from wallet
  - complete
- On commit, the app receives the assembled signed payload and continues broadcast flow.

### App-level hacks that were actually useful

- **Two-tap state machine**: NFC is treated as two deliberate sessions, not a fragile single stream.
- **Byte-level progress telemetry**: native layer reports transfer progress so users get meaningful feedback, especially on larger payloads.
- **Native-first where timing matters**: strict APDU timing stays in Kotlin; product flow and UI remain in React Native.

## Partner technologies and why they helped

- **pn532pi** accelerated low-level NFC bring-up and gave us the primitives needed for custom exchange flow.
- **clearsig** improved trust by turning opaque calldata into human-readable intent for approval.
- **@swype-org/deposit-mobile** let us plug signing into real product flows (deposit/bridge) rather than keeping it as an isolated demo.

## Final takeaway

This project is intentionally practical. The final architecture combines custom APDU chunking, explicit two-tap UX states, and aggressive transport recovery so the system works on real hardware, not just ideal conditions.

The most "hacky" parts, like I2C bus juggling and reset fallbacks, were the exact fixes that made the prototype dependable. Those choices are a key reason the demo feels smooth and trustworthy even on commodity components.
