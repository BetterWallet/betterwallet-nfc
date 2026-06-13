# Better Wallet NFC MVP PRD

## Overview

Better Wallet is a hardware wallet prototype that enables secure offline communication between a React Native mobile app and a Raspberry Pi-based hardware wallet using NFC. The goal is to demonstrate air-gapped transaction signing without requiring Bluetooth, WiFi, USB, or cloud connectivity.

## Core User Flow

### Mode 1: Phone → Better Wallet

1. User creates a transaction in the mobile app.
2. User taps the phone on the Better Wallet.
3. Transaction payload is transferred via NFC.
4. Better Wallet displays transaction details and awaits approval.

### Mode 2: Better Wallet → Phone

1. User approves the transaction on Better Wallet.
2. Better Wallet generates a signed transaction.
3. User taps the phone again.
4. Signed payload is transferred back to the mobile app.
5. Mobile app broadcasts the transaction to the blockchain.

## Technical Stack

* Mobile App: React Native + react-native-nfc-manager
* Hardware Wallet: Raspberry Pi Zero 2W + PN532 NFC module
* Communication Protocol: NFC NDEF messages containing JSON payloads
* Backend Logic: Python + nfcpy

## Message Format

Request:

```json
{
  "id": "123",
  "type": "sign_request",
  "tx": "base64_transaction"
}
```

Response:

```json
{
  "id": "123",
  "type": "signed_tx",
  "signature": "base64_signature"
}
```

## Success Criteria

* Transaction transfer from phone to hardware wallet in under 2 seconds.
* Signed transaction transfer back to phone in under 2 seconds.
* No Bluetooth, USB, or internet dependency.
* End-to-end demo completed with two NFC taps.
