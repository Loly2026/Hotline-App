# Hotline App Deployment Notes

## Before Build

- Make sure `EXPO_PUBLIC_API_URL` points to the public backend URL, not a local LAN IP.
- Replace empty asset files before store builds:
  - `assets/icon.png`
  - `assets/adaptive-icon.png`
  - `assets/splash.png`
- Confirm the backend is deployed with HTTPS and reachable from outside your local network.

## Local Verify

```bash
npm start -- --clear
```

## EAS Build

```bash
npx eas login
npx eas build:configure
npx eas build --platform android --profile preview
npx eas build --platform ios --profile preview
```

## Production Build

```bash
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
```

## Important

- Do not publish a build that still uses `http://172.20.x.x:4001` or `http://192.168.x.x:4001`.
- App Store and Google Play builds must use a real public backend domain.
