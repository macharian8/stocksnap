# CLAUDE.md — StockSnap AI Development Instructions

**Read this file before writing any code.**
This project uses a two-model workflow: **Claude Sonnet** for documents/planning, **Claude Opus** for all code.

---

## Model Assignment

| Task | Model |
|------|-------|
| Writing/updating PRD, context, this file | Sonnet |
| Architecture decisions, technical analysis | Sonnet |
| All code (components, logic, config, tests) | Opus |
| Debugging, performance optimization | Opus |
| Boilerplate (package.json, .env.example, etc.) | Opus |

**If you are Sonnet reading this**: Do not write code unless explicitly told to. Produce documents, plans, and technical analysis. Flag when something needs Opus.

**If you are Opus reading this**: You own all code quality. Write production-ready TypeScript. No `any` types. No `// TODO` without a GitHub issue reference. No console.log in production paths.

## AI ENGINEER STANDARDS

1. Before proposing ANY solution, grep the entire codebase for relevant imports, dependencies and references. Never ask the human to run diagnostic commands that Claude can run itself.
2. Trace dependency chains fully before recommending package changes. Check what requires what before removing or adding anything.
3. Never propose a solution that hasn't been mentally stress-tested against the full dependency graph.
4. When a loop is detected (same error appearing twice), stop and diagnose root cause before attempting another fix.
5. Act as a 10x engineer: own the problem fully, do the research, present one correct solution — not a series of guesses.

---

## Current Dependencies (Actual — from package.json)

```
expo                         ~54.0.33
expo-router                  ~6.0.23
expo-camera                  ~17.0.10
expo-image                   ~3.0.11
expo-image-manipulator       ~14.0.8
expo-image-picker            ~17.0.10      # Camera fallback for Expo Go
expo-crypto                  ~15.0.8
expo-secure-store            ~15.0.8
expo-notifications           ~0.32.16
expo-sharing                 ^14.0.8       # Native share sheet for QR codes
expo-constants               ~18.0.13
expo-linking                 ~8.0.11
expo-status-bar              ~3.0.9
expo-dev-client              ~6.0.20
@supabase/supabase-js        ^2.97.0
zustand                      ^5.0.11
immer                        ^11.1.4
react-native-mmkv            ^2.12.2       # v2 — uses new MMKV(), NOT createMMKV()
react-native-qrcode-svg      ^6.3.21
react-native-view-shot       ^4.0.3        # Capture QR code as image for sharing
react-native-svg             ^15.15.3
react-native-safe-area-context ^5.6.2
react-native-screens         ^4.23.0
react-native-url-polyfill    ^3.0.0
nativewind                   ^4.2.2
base64-arraybuffer           ^1.0.2
react                        19.1.0
react-native                 0.81.5
```

### Removed Packages (Do Not Re-add)

| Package | Reason |
|---------|--------|
| `react-native-reanimated` | Folly header incompatibility with SDK 54 on Intel Macs. No code depends on it. |
| `react-native-nitro-modules` | Was a peer dependency of mmkv v3/v4. Not needed with mmkv v2. |

### Dev Dependencies

```
@types/react     ~19.1.0
tailwindcss      ^3.4.19
typescript       ~5.9.2
```

---

## Known Build Issues

| Issue | Environment | Resolution |
|-------|-------------|------------|
| NitroModules Swift compilation fails | Intel Mac + Xcode 16.2 | Keep `react-native-mmkv` at v2.x. Do NOT upgrade to v3/v4 which require NitroModules. |
| `react-native-reanimated` folly header error | Intel Mac + Xcode 16.2, SDK 54 | Removed entirely. No code imports it. If animations needed later, use RN's built-in `Animated` API. |
| `npx expo install` fails with ERESOLVE | React 19 peer dep mismatches | Always use `npm install <pkg> --legacy-peer-deps` |
| `xcode-select` points to wrong path | After Xcode install/update | Run `sudo xcode-select -s /Applications/Xcode.app` |
| iOS Simulator missing | Fresh Xcode install | Install runtime via Xcode > Settings > Platforms > iOS |

---

## Code Quality Standards (Non-Negotiable)

### TypeScript
- `strict: true` in tsconfig — no exceptions
- No implicit `any`. If you don't know the type, define it in `types/index.ts`
- Interfaces over types for object shapes (extensible)
- Types for unions and primitives
- All async functions have proper error typing

### React Native / Expo
- Functional components only — no class components
- Custom hooks for all stateful logic extracted from components
- `useCallback` and `useMemo` for expensive operations and stable references
- `FlatList` for all lists (never `.map()` in render for data lists)
- Minimum 44x44pt touchable hit areas (accessibility)
- All images use `expo-image` not `Image` from React Native (better caching)

### File Structure Rules
- One component per file
- Component files: PascalCase (`ItemCard.tsx`)
- Utility/lib files: camelCase (`sku.ts`)
- Barrel exports (`index.ts`) for each directory
- Co-locate styles with components using NativeWind (no separate StyleSheet files)

### Error Handling
```typescript
// CORRECT: explicit error handling
const { data, error } = await supabase.from('items').select('*');
if (error) {
  // Handle error — never silently swallow
  throw new AppError('FETCH_ITEMS_FAILED', error.message);
}

// WRONG: assuming success
const { data } = await supabase.from('items').select('*');
doSomethingWith(data!); // Never use non-null assertion on network data
```

### Offline-First Rules
- **Never** show a loading spinner for data that exists locally
- Always read from WatermelonDB first, sync in background
- Sync status (synced / syncing / offline) shown in header — always visible
- All writes go to local DB first, sync queue second — never block UI on network

---

## Architecture Patterns

### Data Flow
```
User Action
    ↓
Zustand store action (optimistic update)
    ↓
WatermelonDB write (local, instant)
    ↓
Sync queue enqueue
    ↓ (background)
Supabase upsert
    ↓
Sync status update in store
```

### Component Pattern
```typescript
// Always separate concerns:
// 1. Data/logic in custom hook
// 2. Pure render in component
// 3. Types in types/index.ts

// hooks/useItemList.ts
export function useItemList() {
  const items = useWatermelonQuery(Item.query());
  const { addItem, deleteItem } = useInventoryStore();
  return { items, addItem, deleteItem };
}

// components/inventory/ItemList.tsx
export function ItemList() {
  const { items } = useItemList();
  return <FlatList data={items} renderItem={({ item }) => <ItemCard item={item} />} />;
}
```

### Supabase Client
```typescript
// lib/supabase.ts — singleton, always import from here
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase'; // Generated types

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);
```

### Store Pattern (Zustand)
```typescript
// store/inventory.ts
interface InventoryState {
  mode: 'inventory' | 'pos';
  setMode: (mode: 'inventory' | 'pos') => void;
}

export const useInventoryStore = create<InventoryState>()(
  immer((set) => ({
    mode: 'inventory',
    setMode: (mode) => set((state) => { state.mode = mode; }),
  }))
);
```

---

## Security Rules

1. **Never put service role keys in client code** — only `EXPO_PUBLIC_` prefixed vars go to client
2. **RLS is your primary security layer** — every Supabase table has RLS enabled
3. **PIN is stored as SHA-256 hash** (via expo-crypto) — never store plain PIN even in MMKV
4. **Attendant mode cannot access owner data** — enforced at RLS level, not just UI level
5. **No user data in URLs or logs** — no PII in console.log or analytics events

---

## Performance Targets

| Operation | Target |
|-----------|--------|
| App cold start | <3s |
| Camera open | <500ms |
| ML inference | <500ms |
| QR scan to item card | <1s |
| Sale confirmation | <500ms |
| Item list scroll | 60fps |
| Dashboard load (local data) | <200ms |

---

## Testing Requirements

- All utility functions in `lib/` have unit tests (Jest)
- All Zustand store actions have unit tests
- Critical flows (add item, make sale, sync) have integration tests
- Use `@testing-library/react-native` for component tests
- No snapshot tests — they're brittle and useless here

---

## Git Conventions

```
feat: add QR scanning in POS mode
fix: prevent mode switch without PIN
chore: update dependencies
refactor: extract useItemForm hook
test: add sync engine unit tests
docs: update CLAUDE.md with printer specs
```

- Never commit `.env.local`
- Always run `npx tsc --noEmit` before committing
- Branch naming: `feat/qr-scanning`, `fix/ble-connection`, `phase/1-foundation`

---

## Phase-by-Phase Checklist

### Phase 1: Foundation
- [x] `npx expo start` works, app loads in Expo Go
- [x] Supabase connected, can read/write from app
- [x] Auth flow complete: phone → OTP → PIN → home screen
- [x] Tab navigation working with blue/green theme switching
- [ ] WatermelonDB initialized, Item model defined
- [x] Basic design system components: Button, Card, Input, Toast

### Phase 2: Core Features
- [x] Camera opens, captures photo, compresses to <200KB (via expo-image-picker)
- [ ] TFLite model loads and returns prediction in <500ms
- [x] Add Item form pre-fills from ML, user can edit and save
- [x] QR code generated and displayed correctly
- [x] Items persisted (currently direct to Supabase, WatermelonDB deferred)

### Phase 3: Inventory & POS
- [x] Item list shows all items, searchable
- [x] QR scanner opens and scans successfully
- [x] Sale confirmation updates stock count
- [x] Transactions saved (to Supabase)
- [ ] Offline sync to Supabase working

### Phase 4: Dashboard & Printer
- [x] Dashboard shows correct today's revenue
- [x] Realtime updates when a sale is made
- [ ] Bluetooth printer pairs via in-app wizard
- [ ] Label prints correctly with QR code + item name + price

### Phase 5: Beta
- [ ] App submitted to TestFlight (iOS) and Play Store internal track
- [ ] 5 internal alpha users testing for 1 week with no critical bugs
- [ ] 20 beta users onboarded with printers

---

## Common Gotchas

1. **NativeWind v4 config differs from v2** — follow v4 docs exactly, older tutorials are wrong
2. **expo-camera permissions** — must request both camera AND microphone on iOS (even if not using mic)
3. **Supabase Realtime** — requires `supabase.channel()` API in v2, not the old `.from().on()` syntax
4. **MMKV with Expo** — use `react-native-mmkv@2.12.2`, NOT v3/v4 (NitroModules dependency fails on Intel)
5. **MMKV v2 API** — `new MMKV()` constructor, `storage.delete()` not `.remove()`
6. **Dependency installs** — always use `--legacy-peer-deps` due to React 19 peer dep mismatches
7. **EAS Build environment vars** — `EXPO_PUBLIC_` vars auto-included; others need `eas secret:create`
8. **ios/ directory** — delete and let `npx expo run:ios` regenerate after native dependency changes

---

## Key Files Quick Reference

| File | Purpose |
|------|---------|
| `stocksnap_prd.md` | Full product requirements |
| `stocksnap_context.md` | Project context + tech decisions |
| `CLAUDE.md` (this file) | AI instructions + code standards |
| `BUILDLOG.md` | Chronological build issue log |
| `types/index.ts` | All TypeScript interfaces |
| `lib/supabase.ts` | Supabase client singleton |
| `lib/storage.ts` | MMKV storage helpers |
| `lib/sku.ts` | SKU generation |
| `lib/useItem.ts` | Single item fetch hook |
| `lib/useItems.ts` | Item list fetch hook |
| `store/auth.ts` | Auth state (Zustand) |
| `store/toast.ts` | Toast notifications (Zustand) |

---

*Update this file whenever architecture decisions change. Stale instructions are dangerous.*
