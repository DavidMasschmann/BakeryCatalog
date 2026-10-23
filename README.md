# Bakery Catalog

A digital product catalog for a bakery: register bakes with a base price,
multiple photos, a description and priced filling options, then browse and search
them. Runs on iOS, Android and the browser from one codebase.

Everything is stored in a single JSON file in your Google Drive **app data
folder** (hidden from your normal Drive, reachable only by this app), with each
product photo stored as its own Drive file. No server, no account on our side.

## Features

- List or grid catalog with responsive masonry (2, 3 or 4 columns by screen size)
- Search across name, filling and description
- Create/edit/delete products from the floating + button, with camera or
  photo-library images
- Several photos per product, shown in a centred gallery; the first photo is the
  catalog card image. Click a side photo or use the web arrow keys to move it to
  the centre
- A price per filling/flavor; the base price applies when no filling is chosen,
  and cards show `from <lowest>` when prices vary
- Works offline; syncs with Drive automatically and on demand from the header
  status icon
- Prices stored as integer cents, so no rounding drift
- Dual role access mode: standard viewer by default (read-only browsing/search
  without edit privileges) and an admin panel option in Settings for managing
  products, photos, prices, and flavors.
- Light and dark themes, following the system by default

## Run it

Node.js is required: Expo SDK 58 supports `^22.13.0 || ^24.3.0` (Node 18/20 will
fail). Then:

```bash
npm install
cp .env.example .env      # fill in EXPO_PUBLIC_GOOGLE_CLIENT_ID
npx expo start --clear    # press w for web, a for Android, i for iOS
```

Without a client id the app still runs: you can add products, but photos and
sync need Google Drive.

## Google Cloud setup

1. Create a project at <https://console.cloud.google.com> and enable the
   **Google Drive API**.
2. Configure the OAuth consent screen. Add yourself under **Test users** while
   the app is unverified.
3. Create an OAuth client of type **Web application** and add the redirect URIs:
   - `http://localhost:8081/redirect` (local web)
   - `https://<your-domain>/redirect` (deployed web build)

   Add the production URI once you know the domain — you can edit the same client
   later. Google rejects custom schemes such as `bakerycatalog://redirect` on a
   Web client ("must end with a public top-level domain"), so web and native use
   different clients; see Platform notes. Settings always shows the exact URI the
   running build will use.
4. Put the client id in `.env`:

   ```
   EXPO_PUBLIC_GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
   ```

The client **secret** is never needed and must not be added.

## Deploying the web build

`EXPO_PUBLIC_GOOGLE_CLIENT_ID` is inlined at build time, so the `.env` file must
exist wherever the export runs:

```bash
npx expo export --platform web   # writes dist/
```

Then, on the same OAuth client, add the deployed origin and redirect URI:

- `https://<your-domain>` — Authorized JavaScript origins
- `https://<your-domain>/redirect` — Authorized redirect URIs

No code change is needed: the redirect is derived from `window.location.origin`.
Preview URLs (`<project>-git-<branch>.vercel.app` and friends) are not
registered, so sign in on the stable production domain.

The export is a single-page app, so tell the host to serve `index.html` for
unknown paths (Vercel: rewrite `/(.*)` to `/index.html`; Netlify:
`/* /index.html 200`). Without that, deep links such as `/redirect` return 404 —
sign-in still finishes because the popup closes on URL match, but the page
flashes.

## Configuration

- **Currency**: `CURRENCY` in `src/drive/config.ts` (defaults to `BRL`).
  Formats Brazilian Real prices (e.g. `R$ 50` or `R$ 50,50` when cents exist).
- **Theme**: Settings → Appearance (System / Light / Dark). Colours live in
  `src/theme/tokens.ts`.
- **App identity**: name, slug, `scheme`, bundle id and Android package in
  `app.json`. `com.example.bakerycatalog` is a placeholder.

## Platform notes

- **Web** works now (`npm run web`).
- **Android / iOS**: a "Web application" client only accepts `http(s)` redirect
  URIs, so the current implicit-flow client cannot be reused with a
  `bakerycatalog://` redirect. When native matters, either ship the web build as
  a PWA (no native auth work), or add separate Android/iOS OAuth clients and
  sign in through the Google Sign-In SDK instead of the implicit flow.
  `npx expo run:android` / `eas build` only apply to that second path.
- **Windows desktop**: use the web build in a browser. A native shell can be
  added later by wrapping the same web output (e.g. Tauri or Electron); the
  Drive code is plain `fetch` and carries over unchanged.
- Photos require a Drive connection (they are stored in Drive). A product
  without photos saves fully offline; adding or removing photos on an existing
  product still needs a live session.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run web` / `android` / `ios` | Dev server targeting one platform |
| `npm run typecheck` | `tsc --noEmit` |
| `npx eslint .` | Lint |
| `npm test` | Jest unit tests (merge, catalog, money) |
| `npx expo export --platform web` | Production web build into `dist/` |

Agent-oriented notes live in `AGENTS.md`.
