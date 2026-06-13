# Better Wallet Mobile (Android HCE)

## Local Android run

```bash
cd /Users/jovian/Developer/ethNyc/betterwallet-nfc-demo/mobile
npx expo run:android
```

## EAS APK build

```bash
cd /Users/jovian/Developer/ethNyc/betterwallet-nfc-demo/mobile
eas build --platform android --profile preview
```

## Install APK (after download)

```bash
adb install BetterWallet.apk
```

## Pi side loop

```bash
cd /Users/jovian/Developer/ethNyc/betterwallet-nfc-demo
python pi/wallet.py
```
