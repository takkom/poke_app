# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## V1 / V2 builds, channels, and API backends

This app can talk to **two backends** while v2 is being rolled out. They are kept separate by **EAS build profile** (API URL baked at build time) and **update channel** (OTA stream).

| EAS profile | Update channel | API (`EXPO_PUBLIC_API_URL`) | Use for |
|-------------|----------------|----------------------------|---------|
| `preview` | `preview` | `https://xmon-api-production.up.railway.app` (v1) | Internal v1 preview builds |
| `production` | `production` | `https://xmon-api-production.up.railway.app` (v1) | Store / production v1 |
| `v2-preview` | `v2-preview` | `https://xmon-api-v2-production.up.railway.app` (v2) | Internal v2 preview (arbitrage UI, v2 data) |
| `development` | `development` | Falls back to v1 via `src/config.ts` | Dev client |

**Important:**

- **Channel** = which OTA updates an install receives. Pushing to `v2-preview` does **not** affect `preview` or `production` installs.
- **API URL** = set in `eas.json` per profile at **native build** time. It is not switched at runtime.
- **`runtimeVersion`** in `app.json` is currently `"1"` for all profiles. Channels still isolate OTA; do not publish v2-only breaking JS to v1 channels.
- **Local dev** (`npx expo start`): optional override in `.env` (see comments there). If unset, defaults to v1 in `src/config.ts`. EAS cloud builds ignore ad-hoc `.env` values when the profile sets `env` in `eas.json`.

### Build commands

```powershell
cd D:\apps\poke_app

# v2 internal preview (new pipeline, v2 API)
eas build --profile v2-preview --platform android
eas build --profile v2-preview --platform ios

# v1 internal preview (unchanged v1 backend)
eas build --profile preview --platform android

# v1 production
eas build --profile production --platform android
```

Icons and splash assets are baked into native builds. After changing `assets/images/icon.png`, `android-icon-foreground.png`, or `splash-icon.png`, run a **new** `eas build` (OTA alone will not update them).

### OTA updates (JavaScript only)

Publish to the **same channel** as the build profile:

```powershell
# v2 preview channel
eas update --branch v2-preview --message "describe change"

# v1 preview channel
eas update --branch preview --message "describe change"

# v1 production channel
eas update --branch production --message "describe change"
```

### App version display

In-app version (`v0.1.0` on login/settings) comes from `src/constants/version.ts` — keep it in sync with `app.json` → `expo.version`. Bumping the visible version does not change channels or `runtimeVersion`.

### Related repos

- **poke_app** (this repo) — Expo client
- **xmon** (`D:\apps\xmon`) — v1 and v2 APIs, scrapers, Railway services (`xmon-api-production`, `xmon-api-v2-production`)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
