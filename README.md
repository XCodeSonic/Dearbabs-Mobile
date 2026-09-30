# Catering Customer App — Expo SDK 56

This mobile app uses Expo SDK 56 with the existing React Navigation UI and the existing Laravel backend API.

No Laravel migrations, models, or controllers were created or changed.

## Requirements

- Node.js 22.13.x or newer
- Expo Go 56.x
- Laravel backend running and reachable from your device/browser

## Install

```bash
cd mobile
npm install
npx expo-doctor
```

## Backend URL

Create `mobile/.env`:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_BACKEND_IP:8000/api
```

Examples:

- Web on the same computer: `http://localhost:8000/api`
- Android emulator: `http://10.0.2.2:8000/api`
- Real phone on the same Wi-Fi: `http://YOUR_COMPUTER_LAN_IP:8000/api`

For web, make sure Laravel CORS allows the Expo web origin shown in your terminal, commonly `http://localhost:8081`.

## Run

```bash
npm start
npm run android
npm run ios
npm run web
```

## Notes

The UI layout and colors were preserved. The changes are compatibility fixes for Expo SDK 56, web runtime, and API route matching.
