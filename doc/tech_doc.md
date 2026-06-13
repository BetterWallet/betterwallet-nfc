# Better Wallet NFC Demo — Technical Document

## Architecture Overview

```
┌─────────────────────────────┐         NFC (13.56 MHz)         ┌─────────────────────────────┐
│   Android Phone             │◄───────────────────────────────►│   Raspberry Pi 5            │
│                             │                                  │                             │
│  Custom HostApduService     │                                  │  pn532pi (Python)           │
│  (native Kotlin, bare Expo) │                                  │  PN532 via SPI              │
│                             │                                  │                             │
│  Tap 1: serves tx payload   │──── Pi reads chunks ───────────►│  Parses tx, signs it        │
│  Tap 2: receives signed tx  │◄─── Pi writes chunks ───────────│  Sends signed tx            │
└─────────────────────────────┘                                  └─────────────────────────────┘
```

**Core principle:** Pi is always the NFC initiator/reader (active RF field). Android runs a native `HostApduService` with a custom AID. The Pi follows the same pattern as the [pn532pi android_hce example](https://github.com/gassajor000/pn532pi/blob/master/examples/android_hce.py): SELECT custom AID, then exchange raw byte commands.

---

## Library Choices

| Component | Choice | Reason |
|---|---|---|
| Pi SPI + APDU | `pn532pi` | SPI on Pi 5 + `inDataExchange()` for raw byte exchange |
| Android HCE | Custom native Kotlin `HostApduService` | Full control over APDU bytes; no library overhead |
| RN bridge | `NativeModules` + `DeviceEventEmitter` | Built into React Native, no extra packages |
| Expo build | Bare workflow + EAS Build | Native code required; Expo Go won't work |

**AID (custom):** `F0 01 02 03 04 05 06` — matches the pn532pi example directly.

---

## Hardware Setup

### PN532 Jumper Configuration (SPI mode)

| Jumper | Setting |
|---|---|
| I0 | LOW (short to GND) |
| I1 | HIGH (short to 3.3V) |

### Wiring: Pi 5 GPIO → PN532

| PN532 Pin | Pi 5 GPIO | Physical Pin |
|---|---|---|
| MOSI | GPIO 10 | Pin 19 |
| MISO | GPIO 9 | Pin 21 |
| SCK | GPIO 11 | Pin 23 |
| SS / CS | GPIO 8 (CE0) | Pin 24 |
| GND | GND | Pin 6 |
| VCC | **External 3.3V supply** | — |

> **CRITICAL:** Do NOT power PN532 from Pi 5's GPIO 3.3V pin. The Pi 5 regulator cannot source enough current. Use an external regulated 3.3V supply with shared GND.

---

## Application Protocol

After SELECT AID succeeds, the Pi sends raw byte commands. All commands fit within the PN532's ~265-byte frame buffer.

| Cmd byte | Direction | Payload | Response |
|---|---|---|---|
| `0x01` | Pi → Android | — | 2-byte big-endian total payload length |
| `0x02 hi lo` | Pi → Android | offset (2 bytes) | up to 200 bytes of payload at that offset |
| `0x03 data...` | Pi → Android | chunk bytes | `90 00` |
| `0x04` | Pi → Android | — | `90 00`, fires event to React Native |

**Tap 1 (Phone → Pi):**
1. Pi SELECT AID → `90 00`
2. Pi `0x01` → Android returns 2-byte `total_len`
3. Pi loops: `0x02 offset_hi offset_lo` → Android returns 200-byte chunk; increment offset until done
4. Pi reassembles JSON, signs transaction

**Tap 2 (Pi → Phone):**
1. Pi SELECT AID → `90 00`
2. Pi loops: `0x03 chunk_data...` → Android appends to buffer, returns `90 00`
3. Pi `0x04` (COMMIT) → Android fires `HCE_SIGNED_TX` event to JS → returns `90 00`

**Large payloads:** Each loop iteration is one `inDataExchange` APDU round trip (~10–15ms on SPI). 10KB = 50 chunks × 15ms ≈ 750ms per tap. The user holds the phone still; no extra UI logic needed.

---

## Pi Setup

### 1. Enable SPI

```bash
sudo raspi-config
# Interface Options → SPI → Enable
# Reboot
```

Verify:
```bash
ls /dev/spidev0.*   # expect /dev/spidev0.0
sudo usermod -aG spi $USER  # avoid running as root; re-login after
```

### 2. Install Dependencies

```bash
pip install pn532pi
```

### 3. Project Structure

```
pi/
├── requirements.txt
├── setup.py         # PN532 init (matches pn532pi example setup())
├── protocol.py      # Custom APDU read/write helpers
└── wallet.py        # Main loop: tap1 read → sign → tap2 write
```

---

## Pi Code

### `pi/requirements.txt`

```
pn532pi
```

---

### `pi/setup.py`

Mirrors the `setup()` function from the pn532pi example.

```python
import time
from pn532pi import Pn532, Pn532Spi

PN532_SPI = Pn532Spi(Pn532Spi.SS0_GPIO8)
nfc = Pn532(PN532_SPI)

CUSTOM_AID = bytearray([0xF0, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06])

SELECT_AID_APDU = bytearray([
    0x00,           # CLA
    0xA4,           # INS: SELECT
    0x04,           # P1: select by name
    0x00,           # P2
    len(CUSTOM_AID),
    *CUSTOM_AID,
    0x00            # Le
])


def setup():
    print("------- Better Wallet HCE -------")
    nfc.begin()
    time.sleep(0.5)  # Pi 5 SPI settling

    versiondata = nfc.getFirmwareVersion()
    if not versiondata:
        raise RuntimeError("Didn't find PN53x board — check wiring and jumpers")

    print("Found chip PN5{:#x} Firmware ver. {:d}.{:d}".format(
        (versiondata >> 24) & 0xFF,
        (versiondata >> 16) & 0xFF,
        (versiondata >> 8) & 0xFF,
    ))
    nfc.SAMConfig()
    print("Ready.\n")
```

---

### `pi/protocol.py`

```python
import binascii
from setup import nfc, SELECT_AID_APDU

CHUNK_SIZE = 200  # safe within PN532's ~265-byte frame buffer


def _exchange(apdu: bytearray) -> bytearray:
    """Send APDU, raise on failure."""
    success, response = nfc.inDataExchange(apdu)
    if not success:
        raise IOError("inDataExchange failed — card moved away?")
    return bytearray(response)


def select_aid() -> bool:
    """Send SELECT AID. Returns True if card accepted."""
    success, response = nfc.inDataExchange(SELECT_AID_APDU)
    if not success:
        return False
    print("  SELECT AID response:", binascii.hexlify(response))
    return True


def read_payload() -> bytes:
    """
    Tap 1: read the full JSON payload from Android HCE.
    Android pre-loaded the payload in JS before the tap.
    """
    # Get total length
    resp = _exchange(bytearray([0x01]))
    total_len = (resp[0] << 8) | resp[1]
    print(f"  Payload length: {total_len} bytes")

    data = bytearray()
    offset = 0
    while offset < total_len:
        hi = (offset >> 8) & 0xFF
        lo = offset & 0xFF
        chunk = _exchange(bytearray([0x02, hi, lo]))
        data.extend(chunk)
        offset += len(chunk)
        print(f"  Read {offset}/{total_len} bytes", end='\r')

    print()
    return bytes(data)


def write_payload(data: bytes):
    """
    Tap 2: send signed tx JSON to Android HCE in chunks, then commit.
    Android fires HCE_SIGNED_TX React Native event on commit.
    """
    total = len(data)
    sent = 0
    while sent < total:
        chunk = data[sent: sent + CHUNK_SIZE]
        _exchange(bytearray([0x03]) + bytearray(chunk))
        sent += len(chunk)
        print(f"  Wrote {sent}/{total} bytes", end='\r')

    print()
    # COMMIT — triggers the React Native event on Android
    _exchange(bytearray([0x04]))
    print("  Committed.")
```

---

### `pi/wallet.py`

Follows the `setup()` / `loop()` pattern from the pn532pi example.

```python
import json
import base64
import time
from setup import nfc, setup
from protocol import select_aid, read_payload, write_payload


def mock_sign(tx_b64: str) -> str:
    """Mock signing — replace with real key operations."""
    return base64.b64encode(b"signed:" + base64.b64decode(tx_b64)).decode()


def loop_tap1() -> dict | None:
    """Wait for phone, read sign request. Returns parsed message or None."""
    print("TAP 1 — waiting for phone...")
    if not nfc.inListPassiveTarget():
        return None

    print("  Card detected!")
    try:
        if not select_aid():
            print("  SELECT AID failed.")
            return None

        raw = read_payload()
        msg = json.loads(raw.decode("utf-8"))

        if msg.get("type") != "sign_request":
            print(f"  Unexpected type: {msg.get('type')}")
            return None

        print(f"  Got sign request id={msg['id']}")
        return msg

    except (IOError, json.JSONDecodeError, UnicodeDecodeError) as e:
        print(f"  Error: {e}")
        return None


def loop_tap2(data: bytes) -> bool:
    """Wait for phone, write signed tx. Returns True on success."""
    print("TAP 2 — waiting for phone...")
    if not nfc.inListPassiveTarget():
        return False

    print("  Card detected!")
    try:
        if not select_aid():
            print("  SELECT AID failed.")
            return False

        write_payload(data)
        return True

    except IOError as e:
        print(f"  Error: {e}")
        return False


def main():
    setup()

    while True:
        # ── TAP 1: read transaction ──
        msg = None
        while msg is None:
            msg = loop_tap1()
            time.sleep(0.5)

        # Sign it
        signature = mock_sign(msg["tx"])
        response = json.dumps({"id": msg["id"], "type": "signed_tx", "signature": signature})
        response_bytes = response.encode("utf-8")
        print(f"  Signed. Response size: {len(response_bytes)} bytes")

        # Brief pause so user can lift phone between taps
        time.sleep(1.0)

        # ── TAP 2: write signed tx ──
        success = False
        while not success:
            success = loop_tap2(response_bytes)
            time.sleep(0.5)

        print("  Done! Waiting for next transaction...\n")


if __name__ == "__main__":
    main()
```

---

## Android Setup

### 1. Create Expo Bare Workflow App

```bash
npx create-expo-app@latest BetterWallet --template bare-minimum
cd BetterWallet
npx expo prebuild --platform android
```

### 2. Install EAS and Build

```bash
npm install -g eas-cli && eas login
```

`eas.json`:
```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    }
  }
}
```

```bash
eas build --platform android --profile preview
# Download APK from EAS dashboard, then:
adb install BetterWallet.apk
```

### 3. Project Structure

```
android/
├── App.tsx
├── src/
│   └── useHCE.ts                          # React Native HCE hook
├── app.json
├── eas.json
└── android/app/src/main/
    ├── AndroidManifest.xml
    ├── res/xml/aid_list.xml
    └── java/com/betterwallet/
        ├── CardService.kt                 # HostApduService
        ├── HCEState.kt                    # Shared state singleton
        ├── HCEModule.kt                   # React Native native module
        ├── HCEPackage.kt                  # RN package registration
        └── MainApplication.kt             # Register HCEPackage (add one line)
```

---

## Android Code

### `android/app/src/main/res/xml/aid_list.xml`

Must match the AID in `SELECT_AID_APDU` on the Pi side exactly.

```xml
<host-apdu-service
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/app_name"
    android:requireDeviceUnlock="false">
  <aid-group
      android:category="other"
      android:description="@string/app_name">
    <aid-filter android:name="F001020304050600" />
  </aid-group>
</host-apdu-service>
```

> Note: Android AID filter omits the `Le` byte — the AID is just `F0010203040506`.

### `android/app/src/main/AndroidManifest.xml` additions

```xml
<uses-permission android:name="android.permission.NFC" />
<uses-feature android:name="android.hardware.nfc" android:required="true" />
<uses-feature android:name="android.hardware.nfc.hce" android:required="true" />

<!-- inside <application>: -->
<service
    android:name=".CardService"
    android:exported="true"
    android:enabled="true"
    android:permission="android.permission.BIND_NFC_SERVICE">
  <intent-filter>
    <action android:name="android.nfc.cardemulation.action.HOST_APDU_SERVICE" />
    <category android:name="android.intent.category.DEFAULT" />
  </intent-filter>
  <meta-data
      android:name="android.nfc.cardemulation.host_apdu_service"
      android:resource="@xml/aid_list" />
</service>
```

---

### `HCEState.kt`

Shared singleton between `CardService` and `HCEModule`.

```kotlin
package com.betterwallet

import com.facebook.react.bridge.ReactApplicationContext
import java.io.ByteArrayOutputStream

object HCEState {
    var pendingPayload: ByteArray? = null
    var reactContext: ReactApplicationContext? = null
    var writeBuffer = ByteArrayOutputStream()
}
```

---

### `CardService.kt`

```kotlin
package com.betterwallet

import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import com.facebook.react.modules.core.DeviceEventManagerModule

class CardService : HostApduService() {

    override fun processCommandApdu(commandApdu: ByteArray?, extras: Bundle?): ByteArray {
        if (commandApdu == null || commandApdu.isEmpty()) return STATUS_FAILED

        // SELECT AID (CLA=00, INS=A4)
        if (commandApdu[0] == 0x00.toByte() && commandApdu.getOrNull(1) == 0xA4.toByte()) {
            HCEState.writeBuffer = java.io.ByteArrayOutputStream()
            return STATUS_OK
        }

        return when (commandApdu[0].toInt() and 0xFF) {

            // 0x01 → GET_LEN: return 2-byte big-endian payload length
            0x01 -> {
                val p = HCEState.pendingPayload ?: return byteArrayOf(0x00, 0x00)
                byteArrayOf((p.size shr 8).toByte(), p.size.toByte())
            }

            // 0x02 hi lo → GET_CHUNK: return up to 200 bytes at offset
            0x02 -> {
                val p = HCEState.pendingPayload ?: return byteArrayOf()
                if (commandApdu.size < 3) return STATUS_FAILED
                val offset = ((commandApdu[1].toInt() and 0xFF) shl 8) or (commandApdu[2].toInt() and 0xFF)
                if (offset >= p.size) return byteArrayOf()
                p.copyOfRange(offset, minOf(offset + 200, p.size))
            }

            // 0x03 data... → RECV_CHUNK: append to write buffer
            0x03 -> {
                val data = commandApdu.copyOfRange(1, commandApdu.size)
                HCEState.writeBuffer.write(data)
                STATUS_OK
            }

            // 0x04 → COMMIT: fire React Native event with assembled JSON
            0x04 -> {
                val received = HCEState.writeBuffer.toByteArray()
                HCEState.reactContext
                    ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit("HCE_SIGNED_TX", String(received, Charsets.UTF_8))
                HCEState.writeBuffer = java.io.ByteArrayOutputStream()
                STATUS_OK
            }

            else -> STATUS_UNKNOWN
        }
    }

    override fun onDeactivated(reason: Int) {}

    companion object {
        private val STATUS_OK = byteArrayOf(0x90.toByte(), 0x00)
        private val STATUS_FAILED = byteArrayOf(0x67.toByte(), 0x00)
        private val STATUS_UNKNOWN = byteArrayOf(0x6D.toByte(), 0x00)
    }
}
```

---

### `HCEModule.kt`

```kotlin
package com.betterwallet

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class HCEModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    init {
        HCEState.reactContext = reactContext
    }

    override fun getName() = "HCEModule"

    @ReactMethod
    fun setPayload(json: String) {
        HCEState.pendingPayload = json.toByteArray(Charsets.UTF_8)
    }

    // Required stubs for RN event emitter
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
```

---

### `HCEPackage.kt`

```kotlin
package com.betterwallet

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class HCEPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
        listOf(HCEModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
```

---

### `MainApplication.kt` — add one line

In `getPackages()`, add `HCEPackage()`:

```kotlin
override fun getPackages(): List<ReactPackage> = PackageList(this).packages.apply {
    add(HCEPackage())   // ← add this
}
```

---

### `android/src/useHCE.ts`

```typescript
import { useEffect, useRef } from 'react';
import { NativeModules, DeviceEventEmitter } from 'react-native';

const { HCEModule } = NativeModules;

type SignedTxCallback = (json: string) => void;

export function useHCE() {
  const listenerRef = useRef<ReturnType<typeof DeviceEventEmitter.addListener> | null>(null);

  /** Call before Tap 1. Preloads the payload Android will serve to Pi. */
  function loadPayload(payload: object) {
    HCEModule.setPayload(JSON.stringify(payload));
  }

  /** Call after Tap 1 completes. Fires callback when Pi commits signed tx. */
  function waitForSignedTx(callback: SignedTxCallback) {
    listenerRef.current?.remove();
    listenerRef.current = DeviceEventEmitter.addListener('HCE_SIGNED_TX', (json: string) => {
      listenerRef.current?.remove();
      callback(json);
    });
  }

  useEffect(() => {
    return () => { listenerRef.current?.remove(); };
  }, []);

  return { loadPayload, waitForSignedTx };
}
```

---

### `android/App.tsx`

```tsx
import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useHCE } from './src/useHCE';

type AppState = 'idle' | 'tap1_ready' | 'tap2_ready' | 'done';

export default function App() {
  const { loadPayload, waitForSignedTx } = useHCE();
  const [state, setState] = useState<AppState>('idle');
  const [signedTx, setSignedTx] = useState('');

  const startDemo = () => {
    // Build ~10KB demo transaction
    const fakeTx = Buffer.alloc(7500, 'x').toString('base64');
    loadPayload({ type: 'sign_request', id: `tx-${Date.now()}`, tx: fakeTx });
    setState('tap1_ready');

    // Pi will read the payload on Tap 1.
    // We poll HCE_SIGNED_TX — it fires after Tap 2 completes on Pi side.
    // To know when Tap 1 is done, either:
    //   A) Add a short delay and transition to tap2_ready (simple demo)
    //   B) Listen for card disconnect (requires additional native event)
    // For demo: transition to tap2_ready after a 3-second grace period.
    setTimeout(() => {
      setState('tap2_ready');
      waitForSignedTx((json) => {
        try {
          const msg = JSON.parse(json);
          setSignedTx(msg.signature ?? json);
        } catch {
          setSignedTx(json);
        }
        setState('done');
      });
    }, 3000);
  };

  const reset = () => { setState('idle'); setSignedTx(''); };

  return (
    <SafeAreaView style={s.root}>
      {state === 'idle' && (
        <TouchableOpacity style={s.btn} onPress={startDemo}>
          <Text style={s.btnTxt}>Start Demo</Text>
        </TouchableOpacity>
      )}
      {state === 'tap1_ready' && (
        <View style={s.center}>
          <Text style={s.title}>TAP 1</Text>
          <Text style={s.sub}>Hold phone to Pi to send transaction...</Text>
        </View>
      )}
      {state === 'tap2_ready' && (
        <View style={s.center}>
          <Text style={s.title}>TAP 2</Text>
          <Text style={s.sub}>Hold phone to Pi to receive signed tx...</Text>
        </View>
      )}
      {state === 'done' && (
        <View style={s.center}>
          <Text style={s.title}>Done ✓</Text>
          <Text style={s.mono} numberOfLines={8}>{signedTx}</Text>
          <TouchableOpacity style={s.btn} onPress={reset}>
            <Text style={s.btnTxt}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },
  center: { alignItems: 'center', padding: 24 },
  title:  { fontSize: 36, fontWeight: '700', color: '#fff', marginBottom: 12 },
  sub:    { fontSize: 16, color: '#aaa', textAlign: 'center' },
  mono:   { fontSize: 11, color: '#4eff91', fontFamily: 'monospace', marginTop: 16, maxWidth: 340 },
  btn:    { marginTop: 24, backgroundColor: '#4eff91', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  btnTxt: { fontSize: 18, fontWeight: '700', color: '#000' },
});
```

---

## Large Payload Handling

| Metric | Value |
|---|---|
| PN532 safe data per APDU | 200 bytes |
| Chunks for 10KB | ~51 exchanges |
| Time per APDU round-trip (SPI) | ~10–15ms |
| Total time for 10KB tap | ~0.5–0.8 seconds |
| Total time for 30KB tap | ~1.5–2.5 seconds |

No application-level reassembly complexity: Pi sends sequential chunks; Android appends to `ByteArrayOutputStream`. Pi commits with `0x04`; Android fires the event.

---

## Testing

### Verify Pi + PN532 only

```bash
cd pi
python -c "from setup import setup; setup()"
# Expect: "Found chip PN5... Firmware ver. X.Y"
```

### End-to-End

1. `cd pi && python wallet.py`
   → `TAP 1 — waiting for phone...`

2. Open Android app → **Start Demo**
   → Screen: "TAP 1: Hold phone to Pi..."

3. Hold phone to PN532
   → Pi: `Card detected! ... Got sign request id=tx-...`
   → App transitions to "TAP 2" after 3s grace period

4. Hold phone to PN532 again
   → Pi: `Wrote N/N bytes` → `Committed.`
   → App: shows signature

---

## Common Issues

| Symptom | Cause | Fix |
|---|---|---|
| `Didn't find PN53x board` | Bad wiring / wrong jumpers | Check I0=LOW I1=HIGH; verify SPI wired correctly |
| `Didn't find PN53x board` | Insufficient power | Use external 3.3V supply, not Pi GPIO |
| `inDataExchange failed` | Phone moved | Hold phone still; loop retries automatically |
| SELECT AID ignored | AID mismatch | Verify `F0010203040506` in `aid_list.xml` matches Pi `CUSTOM_AID` |
| App not selected | Android routing conflict | Settings → NFC → Tap & Pay → Other → select BetterWallet |
| `HCE_SIGNED_TX` never fires | `CardService` not enabled | Check `android:enabled="true"` in AndroidManifest |
| Build error: `HCEModule` not found | Package not registered | Confirm `add(HCEPackage())` in `MainApplication.kt` |
| Expo Go crash | Native module not available | Must use EAS Build, not Expo Go |
