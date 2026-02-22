# StockSnap — Project Context
**Last Updated**: February 22, 2026 | **Status**: Phase 1-3 in progress (auth, inventory, POS functional)
**This file is the single source of truth for all AI-assisted development sessions.**

---

## What Is StockSnap

Mobile inventory management app for informal retail businesses in Africa. Core use case: absentee owner employs attendants to run shop. QR code system lets owner track every sale remotely. Bluetooth thermal printer makes stickering items fast.

**Elevator pitch**: "WhatsApp-simple inventory management with built-in theft prevention for African SMEs."

---

## Current Status

- [x] Expo project initialized (SDK 54)
- [x] Supabase project created and configured
- [x] Auth flow complete (phone → OTP → PIN setup / PIN login)
- [x] Inventory CRUD (add, edit, view, soft-delete)
- [x] POS mode with QR scanning and sale flow
- [x] Dashboard with revenue stats and realtime updates
- [x] QR code preview and sharing screen
- [x] Debug screen (dev only)
- [ ] WatermelonDB offline-first (deferred — currently direct Supabase)
- [ ] Bluetooth printer integration
- [ ] Native iOS build succeeding on device
- [ ] EAS cloud builds configured

**Next immediate actions**:
1. Get native iOS build working (simulator or device)
2. End-to-end test all screens on device
3. Bluetooth printer integration (Phase 4)

---

## Build Environment

| Component | Version/Detail |
|-----------|---------------|
| Machine | Intel MacBook Pro 2019 |
| macOS | Sonoma 14.8.2 |
| Xcode | 16.2 |
| Node | v24.12.0 |
| Expo SDK | 54 |
| React Native | 0.81.5 |
| Target | iOS Simulator (no paid Apple Developer account yet) |
| EAS cloud builds | Deferred until Apple Developer account ($99) |

### Build constraints
- Intel Mac means some ARM-optimized native modules (NitroModules) fail to compile
- Must keep `react-native-mmkv` at v2.x (v3+ requires NitroModules)
- `react-native-reanimated` removed entirely (folly header conflict)
- Always use `--legacy-peer-deps` for npm installs (React 19 peer dep mismatches)

---

## Tech Stack (Actual — reflects what's installed)

```
Framework:        Expo SDK 54 (React Native 0.81.5)
Language:         TypeScript 5.9 (strict mode, no implicit any)
Styling:          NativeWind v4 (Tailwind syntax for React Native)
Navigation:       Expo Router v6 (file-based routing)
State:            Zustand 5 + Immer (global state)
Local DB:         Supabase direct (WatermelonDB deferred to Phase 4+)
Fast KV:          react-native-mmkv v2.12.2 (auth tokens, settings, session)
Backend:          Supabase (Postgres + Auth + Storage + Realtime)
Camera:           expo-camera + expo-image-picker (Expo Go fallback)
QR Generation:    react-native-qrcode-svg
QR Sharing:       react-native-view-shot + expo-sharing
Images:           expo-image (display) + expo-image-manipulator (compress)
PIN Hashing:      expo-crypto (SHA-256)
Bluetooth:        react-native-ble-plx (not yet integrated)
SMS:              Africa's Talking API (not yet integrated)
Payments:         IntaSend (Phase 2 — deferred)
Build:            Local dev builds (EAS deferred)
```

### Not Using (previously planned, removed)
- `react-native-reanimated` — folly header build failure, no code depended on it
- `react-native-nitro-modules` — was mmkv v3 dependency, not needed with v2
- `@nozbe/watermelondb` — deferred; currently using Supabase directly
- TensorFlow Lite — ML classification deferred

**Why not PWA**: iOS Chrome uses WebKit which blocks Web Bluetooth API. Native is required for printer integration. Building PWA first and porting later is a double build — we go native from day one.

---

## Screens Completed

### Auth Flow (`app/(auth)/`)
| Screen | File | Description |
|--------|------|-------------|
| Phone Entry | `phone.tsx` | Enter phone number, request OTP |
| OTP Verification | `otp.tsx` | 6-digit OTP input, verify with Supabase |
| Account Setup | `setup.tsx` | Business name + PIN creation (new users) |
| PIN Login | `pin-login.tsx` | 6-digit PIN entry (returning users) |

### Main App (`app/(main)/`)
| Screen | File | Description |
|--------|------|-------------|
| Inventory List | `inventory/index.tsx` | Searchable item list with FlatList |
| Add Item | `inventory/add.tsx` | Camera/picker → form → save to Supabase |
| Item Detail | `inventory/[id].tsx` | View item with pricing, stock, edit/delete |
| Edit Item | `inventory/edit/[id].tsx` | Edit form pre-filled with current values |
| QR Preview | `inventory/qr/[id].tsx` | Full-screen QR code with share/print buttons |
| POS Scanner | `pos/index.tsx` | QR scan → sale confirmation flow |
| Dashboard | `dashboard/index.tsx` | Revenue stats, recent transactions, low stock |

### Utility Screens
| Screen | File | Description |
|--------|------|-------------|
| Root Index | `app/index.tsx` | Auth gate — redirects to auth or main |
| Debug Panel | `app/debug.tsx` | Dev-only: auth state, Supabase status, test items |

---

## Supabase Setup

### Database Tables
| Table | Purpose | RLS |
|-------|---------|-----|
| `profiles` | User accounts (business name, PIN hash, subscription) | Enabled — users read/write own row only |
| `items` | Inventory items (title, SKU, pricing, stock, QR data) | Enabled — users CRUD own items only |
| `transactions` | Sales, restocks, adjustments, returns | Enabled — users read/write own transactions |

### Storage
- **`item-images`** bucket — private, authenticated uploads only, used for item photos

### Database Functions
- **`decrement_stock`** RPC — atomic stock decrement to prevent race conditions during sales

### Realtime
- **`transactions`** table — realtime enabled for dashboard live updates

### Auth Configuration
- **Provider**: Phone (SMS OTP)
- **Confirmations**: Disabled for development (auto-confirms)
- **Session**: Persisted in MMKV, restored on app launch

---

## Repository Structure (Actual)

```
stocksnap/
├── app/                          # Expo Router screens (file-based)
│   ├── _layout.tsx               # Root layout + auth guard
│   ├── index.tsx                 # Auth gate redirect
│   ├── debug.tsx                 # Dev-only debug panel
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── phone.tsx             # Phone number entry
│   │   ├── otp.tsx               # OTP verification
│   │   ├── setup.tsx             # Business name + PIN creation
│   │   └── pin-login.tsx         # PIN login (returning users)
│   └── (main)/
│       ├── _layout.tsx           # Tab navigator
│       ├── inventory/
│       │   ├── _layout.tsx       # Stack navigator
│       │   ├── index.tsx         # Item list (searchable)
│       │   ├── add.tsx           # Add item flow
│       │   ├── [id].tsx          # Item detail
│       │   ├── edit/[id].tsx     # Edit item
│       │   └── qr/[id].tsx      # QR code preview + share
│       ├── pos/
│       │   ├── _layout.tsx
│       │   └── index.tsx         # POS scanner mode
│       └── dashboard/
│           ├── _layout.tsx
│           └── index.tsx         # Owner dashboard
├── components/
│   └── ui/                       # Reusable primitives (PinPad, Toast, etc.)
├── lib/
│   ├── supabase.ts               # Supabase client (singleton)
│   ├── storage.ts                # MMKV helpers (session, user ID)
│   ├── sku.ts                    # SKU generation (SS-YYYYMMDD-XXXX)
│   ├── crypto.ts                 # PIN hashing (SHA-256 via expo-crypto)
│   ├── useItem.ts                # Single item fetch hook
│   └── useItems.ts               # Item list fetch hook
├── store/                        # Zustand stores
│   ├── auth.ts                   # Auth state + PIN verification
│   └── toast.ts                  # Toast notifications
├── types/
│   └── index.ts                  # All TypeScript interfaces
├── constants/
│   └── colors.ts                 # Design tokens
├── assets/
├── CLAUDE.md                     # AI development instructions
├── BUILDLOG.md                   # Build issue chronology
├── stocksnap_context.md          # This file
└── stocksnap_prd.md              # Full product requirements
```

---

## Key Business Rules (Encode in Code, Never Bypass)

1. **Switching to Inventory Mode requires PIN** — attendants cannot access inventory management
2. **Sales are never deleted** — transactions are immutable once created
3. **Stock can go to 0 but force-confirm required to go negative** — show warning, don't block
4. **SKU format**: `SS-YYYYMMDD-XXXX` where XXXX is zero-padded sequential per user per day
5. **All prices stored in lowest currency unit** (KES = 1, no decimals for KES)
6. **Images compressed to <200KB before storage** — no exceptions
7. **Subscription locks**: Expired users can view/sell but cannot add items or print labels
8. **30-day free trial** starts at first successful login, not signup
9. **Floor price is a hard block** — POS mode rejects any sale below sell_price_floor, no override
10. **Purchase price is never shown in POS mode** — margin stays private from attendants
11. **SKU is immutable** — once created, cannot be changed even by owner
12. **Duplicate detection** runs on save — fuzzy match title+category, >80% similarity triggers merge prompt
13. **Floor price <= default sell price** — enforced at DB level (CHECK constraint) and in form validation

---

## Environment Variables

```bash
# .env.local (never commit)
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_KEY=        # anon key (client-safe)
SUPABASE_SERVICE_ROLE_KEY=       # Server-side only
AFRICA_TALKING_API_KEY=
AFRICA_TALKING_USERNAME=
INTASEND_PUBLIC_KEY=             # Phase 2
INTASEND_SECRET_KEY=             # Phase 2, server-side only

# EAS secrets (set via `eas secret:create`)
# SUPABASE_SERVICE_ROLE_KEY
# AFRICA_TALKING_API_KEY
```

---

## Design System

### Colors
```typescript
// Inventory Mode (Blue theme)
inventory: {
  primary: '#2563EB',     // blue-600
  background: '#EFF6FF',  // blue-50
  accent: '#1D4ED8',      // blue-700
}

// POS Mode (Green theme)
pos: {
  primary: '#16A34A',     // green-600
  background: '#F0FDF4',  // green-50
  accent: '#15803D',      // green-700
}

// Neutral
neutral: {
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  danger: '#DC2626',
  warning: '#D97706',
  surface: '#FFFFFF',
  background: '#F9FAFB',
}
```

### Typography
System fonts only (SF Pro on iOS, Roboto on Android). Scale: 12/14/16/18/20/24/32px.

### Component Conventions
- All touchable elements: min 44x44pt hit area
- Cards: rounded-xl shadow-sm border border-neutral-100
- Buttons: rounded-xl, full-width for primary actions
- Lists: FlatList with keyExtractor, never map() for long lists

---

## External Services & Accounts Needed

| Service | Purpose | Status |
|---------|---------|--------|
| Supabase | Backend DB + Auth + Storage + Realtime | Configured and working |
| Africa's Talking | SMS OTP + notifications | Not set up |
| Expo/EAS | Build + OTA updates | Local dev only (EAS deferred) |
| Apple Developer | iOS App Store ($99/year) | Not yet purchased |
| Google Play | Android ($25 one-time) | Not set up |
| IntaSend | Subscription payments + M-Pesa STK push (Phase 2) | Not set up |

---

## Phase Map

```
Phase 1 (Weeks 1-2):   Foundation — Auth, navigation, DB schema, design system     [~80% complete]
Phase 2 (Weeks 3-4):   Core features — Camera, ML, QR gen, local DB                [~60% complete]
Phase 3 (Weeks 5-6):   Inventory & POS — Item CRUD, QR scan, sale flow, sync       [~70% complete]
Phase 4 (Weeks 7-8):   Dashboard & Printer — Stats, Realtime, BLE printer          [~30% complete]
Phase 5 (Weeks 9-12):  Beta — Alpha → Private beta → App Store submission          [not started]
Phase 6 (Month 3+):    Phase 2 features — Attendant logins, M-Pesa, reports        [not started]
```

---

*This file should be updated at the start of every major feature build.*
