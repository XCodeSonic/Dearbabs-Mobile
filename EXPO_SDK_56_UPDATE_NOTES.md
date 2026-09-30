# Expo SDK 56 Update Notes

This update keeps the current mobile UI structure and the existing Laravel backend files intact. No migrations, models, controllers, or backend routes were created or changed.

## Updated files

1. `package.json` and `package-lock.json`
   - Updated the mobile app to Expo SDK 56.
   - Aligned the React Native/Expo package versions with SDK 56.
   - Added packages needed for web and SDK 56 compatibility:
     - `@expo/metro-runtime`
     - `expo-clipboard`
     - `expo-font`
   - Pinned `react-native-reanimated` and `react-native-worklets` to compatible versions to avoid npm peer dependency conflicts.

2. `app.json`
   - Added iOS, Android, and web platform support.
   - Added Metro web bundler support.
   - Added icon, splash, adaptive icon, favicon, and API fallback config.

3. `App.js`
   - Added a React Navigation theme with the required `fonts` object.
   - This prevents the Expo web/React Navigation error: `Cannot read properties of undefined (reading 'medium')` in `BottomTabItem`.
   - Existing provider order and UI structure were preserved.

4. `src/services/api.js`
   - Added `EXPO_PUBLIC_API_URL` support.
   - Added web fallback API URL: `http://localhost:8000/api`.
   - Kept the existing LAN backend fallback: `http://192.168.181.219:8000/api`.
   - Fixed customer registration endpoint from `/v1/auth/register` to `/v1/customers/register`, matching `routes/api.php`.
   - Exported `API_URL`, `getBaseUrl`, `endpoints`, and `apiHelpers`.
   - Improved 401 cleanup for auth/guest storage.

5. `src/contexts/AuthContext.jsx`
   - Fixed the startup race between stored login and guest mode.
   - Fixed register endpoint to use the backend-supported `/v1/customers/register` route.
   - Fixed refresh user endpoint from missing `/v1/auth/me` to existing `/v1/auth/user`.
   - Updated profile photo upload to support native and web FormData.

6. `src/screens/ProfileScreen.jsx`
   - Removed hard-coded profile-photo upload URL.
   - Reused `updateProfilePhoto()` from `AuthContext`, so it uses the same API base URL as the rest of the app.
   - Replaced removed/deprecated React Native core `Clipboard` with `expo-clipboard`.

7. `src/screens/BookingScreen.jsx`
   - Replaced direct native DateTimePicker import with a platform-compatible wrapper.
   - Native UI stays the same.

8. `src/screens/CateringOrderScreen.jsx`
   - Replaced direct native DateTimePicker import with a platform-compatible wrapper.
   - Native UI stays the same.

9. `src/components/DateTimePickerCompat.native.jsx`
   - Uses `@react-native-community/datetimepicker` on Android/iOS.

10. `src/components/DateTimePickerCompat.web.jsx`
   - Adds a web-safe date/time fallback so the app can bundle and run in browser.

11. `README.md`
   - Rewritten with SDK 56 install/run instructions and backend URL setup.

## Install commands

```bash
cd mobile
npm install
npx expo install --check
npx expo-doctor
```

## Run commands

```bash
npm start
npm run android
npm run ios
npm run web
```

## Backend URL setup

Create `mobile/.env`:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_BACKEND_IP:8000/api
```

Examples:

- Web on same computer: `http://localhost:8000/api`
- Android emulator: `http://10.0.2.2:8000/api`
- Physical phone on same Wi-Fi: `http://YOUR_COMPUTER_LAN_IP:8000/api`

For web, Laravel CORS must allow the Expo web URL shown in your terminal, usually `http://localhost:8081`.

## Possible remaining bugs/errors in the old system

1. Wrong SDK version
   - Old project had `expo ~55.0.0`; Expo Go 56 supports SDK 56, so the old app can fail with unsupported SDK/version mismatch.

2. Dependency peer conflict
   - `react-native-reanimated` and `react-native-worklets` can conflict if both use loose caret ranges. They were pinned to compatible SDK 56 versions.

3. Register broken
   - Mobile used `/v1/auth/register`, but backend routes expose `/v1/register` and `/v1/customers/register`.

4. Refresh user broken
   - Mobile used `/v1/auth/me`, but backend routes expose `/v1/auth/user` and `/v1/auth/profile`.

5. Web API URL problem
   - The old API file used a fixed LAN IP. Browser/web usually needs `localhost` or a configured LAN URL.

6. Profile photo upload broken on other devices/web
   - `ProfileScreen` had a hard-coded fetch URL, separate from the Axios API config.

7. React Native Clipboard issue
   - `Clipboard` from `react-native` is unsafe on current React Native; `expo-clipboard` is used instead.

8. Date picker web issue
   - `@react-native-community/datetimepicker` is native-focused. A web wrapper was added.

9. Guest mode/login race
   - Startup checked stored login and guest mode separately, which could leave the app in the wrong auth state.

10. Laravel CORS
   - Web login/register/API calls can still fail if Laravel CORS does not allow the Expo web origin.

11. Environment-dependent networking
   - Physical phone, emulator, and browser require different backend hostnames/IPs. Use `EXPO_PUBLIC_API_URL`.

12. `npm audit`
   - The current dependency tree reports moderate vulnerabilities. Do not run `npm audit fix --force` blindly because it can install Expo-incompatible versions.

## Validation performed

- `npm install` completed successfully.
- `npx expo install --check` reported dependencies are up to date using Expo SDK 56 local dependency map.
- Static JavaScript/JSX parsing passed for all app files.
- `npx expo-doctor` passed 19/21 checks. The 2 failed checks required remote Expo/React Native Directory network access from the sandbox, not a local code error.
- `expo export --platform web` was attempted but timed out in the sandbox, so final web testing should still be done on your machine with `npm run web`.
