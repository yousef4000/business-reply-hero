---
name: Android Share Target
description: Native SEND intent integration: any Android text-sharing app can send a customer message into Smart Reply
type: feature
---
- AndroidManifest.xml has a SEND intent-filter on MainActivity for `text/plain`.
- MainActivity.java captures `Intent.EXTRA_TEXT`, then once the WebView is ready evaluates JS that sets `window.__sharedText`, dispatches `CustomEvent('smartreply:shared')`, and (if not already on generate page) navigates to `/app/generate?shared=...`.
- GeneratePage reads `?shared=` query param, listens for the `smartreply:shared` event, and reads `window.__sharedText` on mount as fallback.
- Web fallback: `public/manifest.json` declares a `share_target` (GET to `/app/generate` with `shared` param) for PWA installs.
- After native changes, user must run `npx cap sync android` and rebuild the APK in Android Studio.
