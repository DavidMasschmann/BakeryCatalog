# AGENTS.md

Digital bakery catalog for iOS, Android and the browser. One JSON document in
the user's Google Drive `appDataFolder` holds the products; product photos are
separate Drive files. No backend — the client talks to Drive directly.

## Stack

Expo SDK 58 · React Native 0.88 · React 19 · TypeScript (strict) · Expo Router ·
Jest via `jest-expo`. Dependencies are pinned to SDK-compatible versions — never
bump them by hand.

## Commands

```bash
npm run typecheck                 # tsc --noEmit
npx eslint .                      # use this, NOT `npx expo lint` (see Gotchas)
npm test                          # jest, 3 suites
npm test -- src/data/money.test.ts
npm test -- -t "avoids floating point drift"   # single test by name
npm run doctor                    # expo-doctor, currently 20/20
npm start                         # dev server; also: npm run web | android | ios
npx expo export --platform web    # cheapest full-bundle check; writes dist/
```

Run `npm run typecheck && npx eslint . && npm test` before calling a task done.

Use `npx expo install <pkg>` for new packages, never `npm install <pkg>` — only
`expo install` picks the version matching the SDK.

## Layout

- `src/app/` — routes. `index.tsx` is the catalog (list, or a FlashList
  masonry grid, plus search, add FAB and header sync status),
  `product/[id].tsx` is the create/edit form (`id === 'new'` means create),
  `settings.tsx` handles Drive auth and appearance, `redirect.tsx` is the web
  OAuth landing page (no header). Non-route code must stay outside this directory.
- `src/components/ProductPhoto.tsx` — async photo resolver + placeholder.
- `src/components/PhotoGallery.tsx` — centred, non-scrolling photo gallery used
  by the product screen (both viewer and admin); click a neighbour or use the web
  arrow keys to change the active photo.
- `product/[id].tsx` handles both viewer and admin modes. Viewers see a
  read-only product view (`ProductViewer`) with the centered photo gallery,
  description and full filling pricing list without edit fields or photo pickers.
  Admins mount the full editable `ProductForm`. Creating products (`id === 'new'`)
  is restricted to admin mode.
- `src/components/SyncStatusButton.tsx` — header sync icon: spins while a sync
  runs, colours itself by state (muted before a session, danger on error), opens
  a hover/press balloon with the message, and syncs when pressed.
- `src/components/HeaderHomeButton.tsx` — monogram at the header's left edge;
  navigates home, and renders its own back chevron because overriding
  `headerLeft` hides native-stack's back button. Decide `canGoBack` on press,
  not during render (it can be stale on web).
- `src/data/` — `types.ts` (document model), `catalog.ts` (validation and
  mutations), `money.ts` (price conversion), `merge.ts`, `repository.ts`
  (AsyncStorage cache), `sync.ts` (Drive orchestration).
- `src/drive/` — `auth.ts` (OAuth session), `client.ts` (Drive REST),
  `photos.ts` (image upload/download/cache), `account.ts` (connected email),
  `errors.ts` (Google error → actionable message), `config.ts` (scope, file
  names, currency).
- `src/state/` — `AuthContext.tsx`, `CatalogContext.tsx` (provider owning the
  document and all mutations, plus the coalesced auto-sync), `RoleContext.tsx`
  (persisted role: standard viewer by default vs admin panel),
  `useViewPreference.ts` (list/grid choice persisted under `catalog:view`).
- `src/theme/` — `tokens.ts` (light/dark palettes), `ThemeContext.tsx`
  (`useTheme`, mode persistence).

## Domain rules

- Money is **integer minor units** (`priceCents: 1250` = 12.50). Convert only
  through `src/data/money.ts`; `parsePriceInput` deliberately avoids
  `parseFloat` so `0.07` cannot drift. Never introduce a float price.
- Display currency comes from `CURRENCY` in `src/drive/config.ts` (defaults to
  `BRL`, rendering Brazilian Real e.g. `R$ 50` or `R$ 50,50` when cents exist).
- `priceCents` is the base price when no filling is chosen. Each filling has its
  own **absolute** `priceCents`; cards show the base price, or `from <min>` when
  the filling prices are not all equal to it.
- Fillings are `{ name, priceCents }`, trimmed and deduped case-insensitively
  (first occurrence wins).
- A product stores ordered `photos: PhotoRef[]`; `photos[0]` is the image on the
  catalog card. The document is **version 3**: `parseDocument` migrates v2's
  single `photo` field and string-only fillings (which inherit the base price).
- Deletes are **tombstones** (`deleted: true`), never removals: dropping the
  record lets a stale peer resurrect it.

## Theming

- Every screen builds its `StyleSheet` from the palette: a module-level
  `useStyles(colors)` factory (`useMemo` over `StyleSheet.create`) fed by
  `useTheme()`. Do not hardcode colours in components — add a semantic token to
  `src/theme/tokens.ts` instead, and fill it in **both** palettes.
- `useTheme()` returns `{ mode, scheme, colors, setMode }`. `mode` is what the
  user picked (`system | light | dark`), persisted in AsyncStorage under
  `theme:mode`; `scheme` is the resolved palette. Default is `system`, which
  follows the OS (and `prefers-color-scheme` on web).
- `app.json` sets `userInterfaceStyle: "automatic"`; without it native builds
  report light to React Native and the dark palette never activates.
- `onPrimary` is dark in the dark palette because dark-mode `primary` is a light
  rose. Keep contrast in mind when adding tokens.
- **Spacing is a 4px grid.** Every padding, margin, gap, hit slop and control size
  is a multiple of 4 (4, 8, 12, 16, 20…). Never introduce 2, 6, 10, 14 or 18 —
  round to the nearest multiple of 4 instead. Border radii follow the same set.
- **Icons**: Icons come from `@expo/vector-icons` (Ionicons, MaterialCommunityIcons).
  Set the icon's `lineHeight` to its `size` so the glyph stays centred inside a flex control.
  Raw text glyphs (`+`, `⟳`) inherit font ascent/descent and visibly drift off centre.
- Grid cards use `@shopify/flash-list` v2's `masonry` mode with `numColumns`
  derived from the window width. Do not compute pixel card widths or use a plain
  `FlatList`: masonry packs each column independently, so cards of different
  heights leave no row gaps. Cells carry the 8px padding that forms the gutters.
- The header mirrors the monogram: on web `headerRight` has a 16px right margin
  (doubling the 8px inset) and Settings is represented by a cog icon (`settings-outline`)
  from `@expo/vector-icons/Ionicons` in a 32x32 button.
  Native-stack supplies its own header inset on native.
- Both palettes are built around the monogram's rouge (`#773141`, sampled from
  `assets/icon.png`): cream paper + rouge in light, warm charcoal + rose
  (`#e8a5b3`) in dark, with a cream plate behind the monogram in dark. Change the
  two palettes together when the brand shifts.

## Photos

- Each photo is its own `appDataFolder` file. The document stores an **ordered**
  `photos: PhotoRef[]` of `{ fileId, mimeType }`; the first photo is the catalog
  card image. Never inline base64 image data into the JSON — the whole document is
  re-uploaded on every sync.
- The product form keeps photo drafts: existing Drive refs stay in place and new
  picks are appended. On save, kept refs are written first, pending uploads are
  uploaded, and only then is the document persisted. If an upload fails, already
  uploaded new files are deleted best effort.
- Removal is a diff against the saved product: files no longer referenced are
  deleted only after the document write succeeds.
- Attaching a photo requires a live access token, so photo editing fails
  offline by design (products without photos still work offline). Validate the
  form before uploading so an invalid save never creates orphan files.
- The gallery is a translated track inside an `overflow: hidden` viewport, not a
  horizontal `ScrollView`; that is what keeps the scrollbar invisible. It supports
  horizontal touch swipe gestures via `PanResponder`, neighbour click/tap, and web
  arrow keys. The active slide is centred, the viewport is 40% of the window height,
  and neighbours peek in from the sides with a snug 8px gap. When a product has multiple
  photos, a horizontal thumbnail preview row is rendered below the main photo allowing
  instant clicking to jump to any photo. Web measures the viewport from its `testID` because a
  vertical scrollbar makes `window.innerWidth` wider than the real content box.
- SDK 58 ships two filesystem APIs. Use `File`, `UploadTask`, `Paths` from
  `expo-file-system`; the old `uploadAsync`/`downloadAsync` live under
  `expo-file-system/legacy`. Do not mix them.
- `resolvePhotoUri` caches per `fileId`, which is safe because a new upload
  always gets a new id. Web caches object URLs in memory; native caches files in
  `Paths.cache`.
- Replacing or deleting a product deletes the old Drive files best effort. If an
  upload succeeds but the document sync fails, the files are orphaned — harmless,
  but don't assume `appDataFolder` is exactly one file.

## Sync model — read before touching `merge.ts` / `sync.ts`

- One file, `catalog.json`, a `DbDocument` of `Product`s. The current document
  version is 3; parsing older content upgrades it in memory.
- The local AsyncStorage key is still `catalog:v2` so existing devices keep their
  cache; its value is a version-3 document. Only rename it together with a
  migration.
- The catalog syncs on launch once a session exists, and after every save or
  delete; the header status icon is also the manual trigger. `runSync` keeps one
  request in flight and coalesces a follow-up in `queuedRef`, always reading the
  newest document from `docRef`, so a mutation mid-flight is not lost.
- Merge is last-write-wins per product id by `updatedAt`; ties go to the remote
  copy so all devices converge regardless of merge order. Products are sorted
  by id (`normalizeDocument`) so documents compare with `JSON.stringify`.
- Google Drive has **no transactions**. Concurrency relies on the file ETag and
  `If-Match`; a `412` means another device won the race, and `syncDocument`
  re-reads and re-merges (up to 2 retries). Do not remove the conditional write.
- Writes use `uploadType=media`; creating a file is metadata POST + media PATCH
  because `uploadType=media` alone cannot set `parents`.
- `merge.test.ts`, `catalog.test.ts` and `money.test.ts` are the contract.
  Change behaviour and tests together.

## Auth constraints that are easy to get wrong

- Scope is `drive.appdata`, plus `email`/`profile` purely to show the connected
  account in Settings (`src/drive/account.ts`). Every Drive query must pass
  `spaces=appDataFolder`; files are deliberately invisible in the user's normal
  Drive listing.
- Flow is implicit (`response_type=token`) on **every** platform: Google's token
  endpoint requires a client secret for "Web application" clients, which cannot
  be shipped in a public app. So tokens last ~1h and there is **no refresh
  token**; the user re-consents after expiry. Don't "fix" this by adding a
  client secret or pretending a refresh token exists.
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID` is inlined into the bundle at build time. Only
  public values may go there. After editing `.env`, restart with
  `npx expo start --clear`.
- The redirect scheme `bakerycatalog` is duplicated in `app.json` (`expo.scheme`)
  and `src/drive/auth.ts` (`REDIRECT_SCHEME`). On web the URI is the page origin
  + `/redirect`, so deployment only needs the domain registered — no code change.
- A **Web application** client rejects non-`http(s)` redirect URIs ("must end
  with a public top-level domain"), so `bakerycatalog://redirect` cannot be
  registered there. Native auth is therefore **not wired up**: it needs separate
  Android/iOS clients plus the Google Sign-In SDK (or the web build shipped as a
  PWA). Don't "fix" the console error by changing the scheme — it will fail at
  token time. Setup steps: `README.md`.
- Web resolves the redirect to `<origin>/redirect`, hence the `redirect.tsx`
  route: the popup briefly lands there, then expo-web-browser closes it and
  returns the URL. The URI is shown verbatim in Settings so it can be copied
  into Google Cloud — don't reformat it.
- Sign-in failures must surface: `signIn` stores a mapped message in
  `session.error` (`describeAuthError`) instead of silently returning. Keep that
  behaviour; a dead-looking Connect button was a real support problem.

## Native builds

- `ios/` and `android/` are gitignored and generated (Continuous Native
  Generation). Never create or hand-edit them; configure native behaviour in
  `app.json` and config plugins.
- The `expo-image-picker` config plugin in `app.json` supplies the camera/photo
  permission strings. Adding a native module without its plugin yields a
  permission crash at runtime, not a build error.
- iOS cannot be built on Windows. Use EAS cloud builds (`eas build`) or a Mac.
- Expo Go only bundles its native modules; anything adding native code needs a
  development build (`npx expo run:android` or `eas build --profile development`).
- `com.example.bakerycatalog` (bundle id / package) and the name/slug in `app.json`
  are placeholders — replace before shipping.

## Gotchas on this machine

- Node is not on `PATH`. Use the portable install:
  `$env:PATH = "C:\Users\david\AppData\Local\nodejs\node-v24.20.0-win-x64;$env:PATH"`.
  SDK 58 accepts only Node `^22.13` or `^24.3` — Node 18/20 will not run it.
- PowerShell execution policy is Restricted, so `.ps1` shims fail. Call
  `npm.cmd` / `npx.cmd`, not `npm` / `npx`.
- `npx expo lint` exits with a bogus "requires ESLint version 8.57.0 or greater"
  error even though ESLint 9 is installed. `npx eslint .` is the working
  equivalent.
- Test files import `describe/it/expect` from `@jest/globals`; the tsconfig
  deliberately does not add Jest globals.
- The workspace path contains a space, which makes `create-expo-app` refuse the
  directory name — scaffold in a temp folder and copy in.
- Starting Metro with `CI=1` (e.g. `$env:CI = "1"` for a clean test run) makes it
  log "Metro is running in CI mode, reloads are disabled" and silently serve
  stale bundles. Unset `CI` before starting the dev server, or work will appear
  not to apply.
- Expo ships breaking changes every SDK release. Check `expo` in `package.json`
  and read `https://docs.expo.dev/versions/v58.0.0/` (index:
  `https://docs.expo.dev/llms.txt`) instead of trusting remembered APIs.
