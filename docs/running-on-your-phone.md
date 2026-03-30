# Run detox-app on your phone

This project is an **Expo** app (React Native with [Expo Router](https://docs.expo.dev/router/introduction/)). You run it from your computer and open it on a physical device with **Expo Go** or a **development build**.

---

## 1. Prerequisites on your computer

1. **Node.js** (LTS recommended): [https://nodejs.org](https://nodejs.org)
2. From the project folder, install dependencies:

   ```bash
   cd D:\detox-app
   npm install
   ```

---

## 2. Start the development server

```bash
npm start
```

Or explicitly:

```bash
npx expo start
```

You should see a QR code in the terminal and a URL like `exp://...`.

---

## 3. Install Expo Go on your phone

- **Android**: [Expo Go on Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
- **iPhone**: [Expo Go on the App Store](https://apps.apple.com/app/expo-go/id982107779)

---

## 4. Connect your phone to the dev server

### Option A — Same Wi‑Fi (simplest)

1. Phone and PC must be on the **same Wi‑Fi** network.
2. In the terminal where Expo is running, press **`w`** to open the dev tools in a browser if needed.
3. **Android**: Open Expo Go → **Scan QR code** and scan the terminal/browser QR code.  
   **iPhone**: Open the **Camera** app and scan the QR code → tap the banner to open in Expo Go.

If the app does not load, try **tunnel mode** (below).

### Option B — Tunnel mode (firewalls or different networks)

If your PC and phone cannot see each other (corporate Wi‑Fi, VPN, strict firewall):

```bash
npx expo start --tunnel
```

Scan the new QR code with Expo Go. Tunneling is slower but works across more networks.

### Option C — Android USB (optional)

1. Enable **Developer options** → **USB debugging** on the phone.
2. Connect via USB and install [Android platform tools](https://developer.android.com/tools/releases/platform-tools) so `adb` works.
3. With the dev server running, press **`a`** in the Expo terminal to open on the connected Android device (if drivers and `adb` recognize the device).

---

## 5. Daily workflow

1. `cd D:\detox-app`
2. `npm start`
3. Open **Expo Go** on your phone and connect (QR or recent projects).

---

## Notes

- **SDK and Expo Go must match**: The [Expo Go](https://expo.dev/go) app from the Play Store / App Store embeds a **fixed native runtime** (for example, “supported SDK **54**” in app info). Your JavaScript project must use the **same Expo SDK** (see `expo` in `package.json`). If the project targets a **newer** SDK than the store build (for example SDK 55 canary while Expo Go is still on 54), you will see **“Project is incompatible with this version of Expo Go”** — updating Expo Go does not help until the store ships a client for that SDK.
- **This repo** is pinned to **Expo SDK 54** so it runs in the current **Expo Go** from the store.
- **Production build**: To install a standalone app without Expo Go, use [EAS Build](https://docs.expo.dev/build/introduction/) (`eas build`). That is separate from day‑to‑day development.

---

## Troubleshooting: “Project is incompatible with this version of Expo Go”

**Cause:** The dev server is bundling a **different Expo SDK** than the one inside Expo Go on your phone (shown under app info as “supported SDK”).

**Fix (recommended):** Align the project with your Expo Go version.

1. In `package.json`, set `expo` to the same major SDK as Expo Go (e.g. `"expo": "~54.0.0"` for SDK 54).
2. Reinstall and let Expo fix native module versions:

   ```bash
   cd D:\detox-app
   npm install
   npx expo install --fix
   ```

3. Restart the dev server (`npm start`) and open the project again in Expo Go.

**If you must use a newer SDK (e.g. 55) before Expo Go supports it:** use a **development build** ([`expo-dev-client`](https://docs.expo.dev/develop/development-builds/introduction/)) or **EAS Build** instead of Expo Go — the store app cannot load arbitrary future SDKs.

---

---

## Quick command reference

| Goal              | Command                    |
| ----------------- | -------------------------- |
| Start dev server  | `npm start`                |
| Start with tunnel | `npx expo start --tunnel`  |
| Android emulator  | `npm run android`          |
| iOS simulator     | `npm run ios` (macOS only) |
