# Push Setup

## Goal

This app already contains the client code to request notification permission, fetch an Expo push token, and send it to the backend.

The missing part is native push credentials. Without them, devices will never appear in the admin portal.

## Current project values

- Android package: `com.hotline.egypt`
- EAS project ID: `ad40b21c-50ba-4e75-81ed-b21f3df612d6`
- Backend URL: `https://hotline-app-4j53.onrender.com`

## Android setup checklist

1. Open Firebase Console.
2. Create a project, or use an existing project for Hotline App.
3. Add an Android app with this exact package name:

```text
com.hotline.egypt
```

4. Download `google-services.json`.
5. Place the file here:

```text
/Users/mohamedibrahimhelmy/Documents/New project/mobile/google-services.json
```

6. In Firebase Console:
   - Go to `Project settings`
   - Open `Service accounts`
   - Generate a new private key for Firebase Admin SDK
   - Keep the downloaded JSON file safe

7. In Expo / EAS:
   - Run `eas credentials`
   - Choose Android
   - Upload the Firebase FCM V1 service account key JSON when prompted

8. After the file is placed locally, update `app.json` to point to `./google-services.json`.
9. Build a new development build or production build.

## iOS setup checklist

1. Make sure the app is connected to the correct Apple Developer account.
2. Run `eas credentials`.
3. Choose iOS.
4. Generate or upload a valid APNs key when prompted.
5. Build a new iOS development build or production build.

## Test rules

- Do not test push notifications in Expo Go.
- Use a real phone, not an emulator or simulator.
- Open the app and allow notifications.
- Close the app and reopen it once after permission is granted.
- Then check the admin portal push stats.

## Expected success result

When setup is correct:

- `Active devices` becomes greater than `0`
- One or more rows appear in the admin push devices table
- Sending a test notification returns a positive sent count

## Notes

- `google-services.json` is ignored by git on purpose.
- `GoogleService-Info.plist` is also ignored by git for safety.
- If Android works and iOS still shows `0`, the missing part is usually APNs credentials.
