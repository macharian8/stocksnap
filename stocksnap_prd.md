# StockSnap — Product Requirements Document
**Version**: 1.0 | **Last Updated**: February 2026 | **Status**: Active Development

---

## 1. Executive Summary

StockSnap is a mobile-first inventory management system targeting absentee owners of informal retail businesses in Sub-Saharan Africa. The core value proposition is theft prevention and remote monitoring through a QR-code-based workflow that integrates with a Bluetooth thermal label printer.

**Stack decision**: Expo (React Native) + TypeScript — not PWA. Rationale: iOS Web Bluetooth is blocked by Apple regardless of browser. Building PWA-first then porting is a double build. Expo gives us iOS + Android from day one, native Bluetooth, bundled ML models (no download latency), and EAS Build for OTA updates.

---

## 2. Problem Statement

### Primary User
Salaried professional (25–45, urban Kenya/Nigeria/Ghana) running a side business in fashion, secondhand goods, or general merchandise. Employs 1–3 attendants. Visits shop 2–3x/week.

### Pain Points (ranked by severity)
1. **Employee theft** — attendants sell items and pocket cash. No way to prove it without being present.
2. **No visibility** — owner has no idea what sold, what's left, or what revenue was generated.
3. **Existing solutions are unusable** — Loyverse/Square require desktop terminals, barcode scanners, receipt printers. Too expensive, too complex.
4. **Mental load** — tracking inventory in WhatsApp messages and Excel sheets is error-prone and doesn't scale.

### Why Now
- Affordable Bluetooth thermal printers ($35 wholesale) make hardware bundling viable
- TensorFlow Lite on mobile means ML runs entirely on-device
- Expo + EAS has matured enough for production apps
- M-Pesa/mobile money normalization means users expect digital transaction tracking

---

## 3. Goals & Success Metrics

### Product Goals
| Metric | Target (Month 3) | Target (Month 12) |
|--------|-----------------|-------------------|
| Activation: add ≥5 items in week 1 | 80% of signups | 85% |
| Engagement: login ≥3 days/week | 50% | 65% |
| Sales logged per active user/week | 20 | 35 |
| Trial-to-paid conversion | 60% | 70% |
| 90-day retention | 70% | 75% |
| Auto-title accuracy (no edit needed) | 75% | 85% |

### Business Goals
| Metric | Target |
|--------|--------|
| Active paid users (Month 12) | 200+ |
| MRR (Month 12) | $3,000+ |
| Break-even | Month 9 |
| Referral-sourced new users | 40% |

---

## 4. Technical Architecture

### 4.1 Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Mobile framework | Expo SDK 52 (React Native) | iOS + Android from one codebase; native Bluetooth; bundled ML |
| Language | TypeScript (strict mode) | Type safety critical for offline sync logic |
| Styling | NativeWind v4 (Tailwind for RN) | Familiar syntax; consistent design tokens |
| State management | Zustand + Immer | Simple, performant, no boilerplate |
| Local storage | WatermelonDB | Reactive, offline-first, SQLite under the hood; handles 100k+ records |
| Fast key-value | MMKV | Settings, auth tokens, session data (10x faster than AsyncStorage) |
| Backend | Supabase (Postgres + Auth + Storage + Realtime) | Realtime subscriptions for owner dashboard; row-level security |
| SMS | Africa's Talking API | Best African carrier coverage; cheap |
| Bluetooth | react-native-ble-plx | Most stable RN Bluetooth library; ESC/POS support |
| Camera/QR | expo-camera + expo-barcode-scanner | Native scanner; low-light capable |
| ML | TensorFlow Lite (bundled) | Runs on-device; no download; 50-100ms inference |
| Image handling | expo-image-manipulator | Compress before storage (target: <200KB per image) |
| Navigation | Expo Router v4 (file-based) | Familiar to web devs; deep linking built-in |
| Auth | Supabase Auth + custom PIN | Phone/OTP first login; PIN for daily use |
| Payments | IntaSend (Phase 2) | Best M-Pesa STK push + Kenya-native; abstracted for multi-market |
| Build/OTA | EAS Build + EAS Update | OTA updates without App Store approval |

### 4.2 Data Model

```typescript
// Users
interface User {
  id: string; // UUID
  phone: string; // E.164 format (+254...)
  pin_hash: string; // bcrypt
  subscription_status: 'trial' | 'active' | 'expired' | 'cancelled';
  trial_ends_at: string; // ISO 8601
  subscription_ends_at: string | null;
  printer_serial: string | null;
  business_name: string;
  created_at: string;
  updated_at: string;
}

// Inventory Items
interface Item {
  id: string; // UUID
  user_id: string;
  title: string;
  description: string | null;
  sku: string; // Auto-generated: SS-YYYYMMDD-XXXX
  category: string | null; // ML-generated, user confirms
  condition: 'new' | 'used' | 'refurbished'; // Default: new
  unit_of_measure: 'piece' | 'pair' | 'kg' | 'metre' | 'litre' | 'other'; // Default: piece
  buy_price: number; // Purchase/cost price in lowest currency unit (KES)
  sell_price: number; // Default selling price
  sell_price_floor: number; // Minimum allowed sale price (blocks attendant underselling)
  sell_price_ceiling: number | null; // Optional maximum (null = no ceiling)
  quantity_in_stock: number;
  quantity_sold: number;
  reorder_point: number; // Alert threshold (default: 3)
  image_url: string | null; // Supabase Storage URL
  image_local_path: string | null; // Local cache path
  qr_code_data: string; // URL: stocksnap.app/scan/{sku}
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // WatermelonDB sync fields
  _status: 'created' | 'updated' | 'deleted' | 'synced';
  _changed: string;
}

// Transactions
interface Transaction {
  id: string;
  user_id: string;
  item_id: string;
  attendant_id: string | null;
  transaction_type: 'sale' | 'restock' | 'adjustment' | 'return';
  quantity: number;
  price_at_sale: number;
  total_amount: number;
  payment_method: 'cash' | 'mpesa_stk' | 'mpesa_till' | 'card' | 'other';
  payment_status: 'pending' | 'confirmed' | 'failed';
  mpesa_transaction_code: string | null; // e.g. QH47X2Y3Z8
  mpesa_phone: string | null; // For STK push
  notes: string | null;
  synced: boolean;
  created_at: string;
}

// Attendants (Phase 2)
interface Attendant {
  id: string;
  user_id: string; // Owner's user_id
  name: string;
  pin_hash: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}
```

### 4.3 Supabase Schema (SQL)

```sql
-- Enable RLS on all tables
-- Users table managed by Supabase Auth + profile table

CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  subscription_status TEXT DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  subscription_ends_at TIMESTAMPTZ,
  printer_serial TEXT,
  business_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sku TEXT UNIQUE NOT NULL,
  category TEXT,
  condition TEXT DEFAULT 'new' CHECK (condition IN ('new', 'used', 'refurbished')),
  unit_of_measure TEXT DEFAULT 'piece' CHECK (unit_of_measure IN ('piece', 'pair', 'kg', 'metre', 'litre', 'other')),
  buy_price INTEGER NOT NULL,           -- Purchase/cost price, never shown in POS
  sell_price INTEGER NOT NULL,          -- Default selling price
  sell_price_floor INTEGER NOT NULL,    -- Minimum attendant can sell at
  sell_price_ceiling INTEGER,           -- Optional maximum (NULL = no ceiling)
  quantity_in_stock INTEGER DEFAULT 0,
  quantity_sold INTEGER DEFAULT 0,
  reorder_point INTEGER DEFAULT 3,      -- Low stock alert threshold
  image_url TEXT,
  qr_code_data TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT floor_lte_sell CHECK (sell_price_floor <= sell_price),
  CONSTRAINT ceiling_gte_sell CHECK (sell_price_ceiling IS NULL OR sell_price_ceiling >= sell_price)
);

CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  attendant_id UUID REFERENCES attendants(id),
  transaction_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_at_sale INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their data" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users own their items" ON items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their transactions" ON transactions FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_items_user_id ON items(user_id);
CREATE INDEX idx_items_sku ON items(sku);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
```

### 4.4 API Contracts

All Supabase calls use the typed client. Key operations:

```typescript
// Types for all API responses
interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

interface ApiError {
  message: string;
  code: string;
  details?: unknown;
}

// Item operations
type CreateItemPayload = Omit<Item, 'id' | 'created_at' | 'updated_at' | '_status' | '_changed'>;
type UpdateItemPayload = Partial<CreateItemPayload> & { id: string };

// Transaction operations  
type CreateTransactionPayload = Omit<Transaction, 'id' | 'created_at' | 'synced'>;

// Dashboard query result
interface DashboardStats {
  today_revenue: number;
  today_sales_count: number;
  week_revenue: number;
  low_stock_items: Item[];
  recent_transactions: (Transaction & { item: Pick<Item, 'title' | 'sku'> })[];
}

// Sync payload for WatermelonDB → Supabase
interface SyncPayload {
  created: Item[];
  updated: Item[];
  deleted: string[]; // IDs only
  last_synced_at: string;
}
```

---

## 5. Feature Specifications

### 5.1 Authentication Flow

**First launch:**
1. Splash screen (2s) → Onboarding (3 screens, skippable after first view)
2. Enter phone number → SMS OTP via Africa's Talking → Verify OTP
3. Set business name + PIN (6 digits)
4. Prompted to connect printer (skippable)
5. Land on Inventory Mode (blue theme)

**Returning user:**
1. Splash → PIN entry screen
2. 3 wrong PINs → SMS OTP fallback
3. Land on last used mode

**Attendant login (Phase 2):**
1. Long-press logo on PIN screen → Attendant mode
2. Enter attendant PIN → POS Mode only (Inventory Mode locked)

### 5.2 Add Item Flow (Inventory Mode)

**Time target: <45 seconds from photo to QR printed**

**Step 1 — Capture**
1. Tap "+" FAB
2. Camera opens full-screen
3. Capture photo → auto-compress to <200KB
4. TFLite model runs on-device → predicts category + suggested title (300ms)

**Step 2 — Details form (pre-filled where possible)**

| Field | Source | Editable |
|-------|--------|----------|
| Photo | Camera | Retake button |
| Title | ML-generated | Yes — always |
| Category | ML-generated (top-3 shown) | Yes |
| Condition | Default: New | Yes — New / Used / Refurbished |
| Unit of measure | Default: Piece | Yes — Piece / Pair / Kg / Metre / Litre / Other |
| SKU | Auto-generated (SS-YYYYMMDD-XXXX) | No (shown for reference) |
| Purchase price | Empty | Yes — required |
| Default sell price | Empty | Yes — required |
| Floor price | Auto: same as sell price | Yes — minimum attendant can sell at |
| Ceiling price | Empty | Optional |
| Units bought (qty) | Empty | Yes — required |
| Reorder alert at | Default: 3 | Yes |

**Step 3 — Duplicate detection**
- After user taps "Save & Print", app does fuzzy match on title + category against existing items
- If match found (>80% similarity): bottom sheet appears — "Looks like you already have: [Item Name] (X in stock). Add to existing stock or create new item?"
- **Add to existing**: increments quantity on existing item, prints new QR labels, no new SKU created
- **Create new**: proceeds normally with new SKU
- If no match: skip straight to save

**Step 4 — Save & Print**
5. QR code generated from SKU
6. Sent to Bluetooth printer
7. Item saved to local DB → sync queue

**ML pipeline:**
- Model: MobileNet v3 Small (TFLite, bundled, ~2MB)
- Input: 224×224 image
- Output: Top-3 categories with confidence scores
- Title generation: Category + dominant color from image
- Accuracy target: 75% no-edit needed

**Photo handling:**
- Capture at full resolution
- Compress to <200KB using expo-image-manipulator (quality: 0.7, max dimension: 1024px)
- Store compressed version locally
- Upload to Supabase Storage on sync

**Business rules enforced at save:**
- Floor price cannot exceed default sell price
- Ceiling price (if set) must be ≥ default sell price
- Purchase price stored but never shown in POS mode (margin stays private)
- SKU is immutable once created

### 5.3 POS Mode (Sales Flow)

**Time target: <15 seconds from scan to confirmation**

1. POS Mode active (green theme)
2. Camera opens to QR scanner (always-on in this mode)
3. Scan QR on item
4. Item card appears: photo, title, default sell price, stock count (purchase price never shown)
5. Quantity selector (default: 1)
6. Price field — pre-filled with default sell price, editable down to floor price only
   - If attendant enters price below floor: field turns red, "Save" blocked, shows "Min price: KES X"
   - Ceiling enforced silently if set
7. Payment method selector (Cash / M-Pesa STK / M-Pesa Code / Other)
8. Tap "Confirm Sale"
8. Transaction saved locally → owner notified (push + SMS if offline)
9. Stock count decrements
10. Camera returns to scanning mode

**Phase 2 — M-Pesa payment flows:**

*Flow A — STK Push (IntaSend):*
1. Attendant scans item QR → selects "M-Pesa STK Push"
2. Attendant enters customer phone number
3. IntaSend fires STK push → customer phone shows M-Pesa PIN prompt
4. Customer enters PIN → IntaSend webhook confirms → transaction marked paid
5. Timeout after 60s → cancelled, attendant retries or switches to Flow B

*Flow B — Till Number (manual entry):*
- Customer pays via owner's M-Pesa till independently
- Customer shows M-Pesa confirmation SMS to attendant
- Attendant taps "Enter M-Pesa Code" → types transaction code (e.g. QH47X2Y3Z8) → app validates format → marks transaction paid
- Transaction code stored on record for owner reconciliation

*Phase 3 — C2B webhook auto-recognition (deferred):*
- Schema already supports this: Transaction model has payment_status, mpesa_transaction_code fields
- When ready: register owner till via Daraja, Supabase Edge Function receives C2B callbacks, auto-matches to pending transactions
- See Phase 3 spec when implementing

**Payment provider abstraction:**
- All payment calls routed through lib/payments.ts — never call IntaSend or Daraja directly from components
- Kenya: IntaSend (STK push + manual M-Pesa code entry); Daraja C2B in Phase 3
- Nigeria Phase 3+: swap provider in config, same interface
- Item not found: show "Item not in system" with manual search fallback
- Out of stock: warning shown but sale can still be forced (with confirmation)
- Low stock alert: shown at threshold (configurable, default: 3 units)

### 5.4 Mode Switching

- Blue = Inventory Mode (add/edit items, view reports)
- Green = POS Mode (scan and sell only)
- Toggle via prominent button in header
- **Security**: Switching TO Inventory Mode requires PIN confirmation
- Switching to POS Mode is free (attendants can always enter sell mode)

### 5.5 Dashboard

Owner dashboard (Inventory Mode → Dashboard tab):

```
┌─────────────────────────────────┐
│  Today's Revenue    KES 4,500   │
│  Sales Today           23       │
├─────────────────────────────────┤
│  This Week          KES 28,400  │
│  Revenue Trend      ▲ 12%       │
├─────────────────────────────────┤
│  Low Stock (3 items)            │
│  • Blue Hoodie M    2 left      │
│  • Nike Tee White   1 left      │
│  • Levi's 32        0 left ⚠️   │
├─────────────────────────────────┤
│  Recent Activity                │
│  14:32  Sold: Blue Hoodie M     │
│  13:15  Sold: Nike Tee White    │
│  11:40  Restock: Levi's 32      │
└─────────────────────────────────┘
```

Real-time updates via Supabase Realtime subscriptions when online.

### 5.6 Bluetooth Printer Integration

**Supported printers (tested):**
- Phomemo M02 (primary recommendation, ~$35)
- Niimbot D11 (alternative)
- Generic ESC/POS 58mm

**Pairing flow (in-app wizard):**
1. "Connect Printer" button → in-app wizard opens
2. Step 1: Turn on printer (animated GIF)
3. Step 2: Scanning for devices (react-native-ble-plx scan)
4. Step 3: Select printer from list
5. Step 4: Test print (prints "StockSnap Ready ✓")
6. Save printer serial to profile

**Print payload (ESC/POS commands):**
```
Header: Business name (centered, large)
QR Code: 3cm × 3cm, error correction level M
Item title (truncated to 24 chars)
Price: KES XXX
SKU: SS-XXXXXXXX
```

**Offline print queue:** If printer disconnected, queue up to 50 labels. Auto-print when reconnected.

### 5.7 Offline Sync Architecture

**Strategy:** WatermelonDB local-first + Supabase sync

```
Phone (WatermelonDB) ←→ Sync Engine ←→ Supabase (Postgres)
                              ↑
                    Runs on: app foreground + background fetch
```

**Sync rules:**
- Transactions: push-only (local → server), never pulled back
- Items: bidirectional (owner edits from another device possible in Phase 2)
- Conflict resolution: last-write-wins with timestamp
- Sync frequency: immediate when online, every 30min background fetch
- Sync status indicator in header (✓ synced / ⟳ syncing / ⚠ offline)

---

## 6. UX Principles & Design System

### Design Tokens
```
Inventory Mode (Blue):
  Primary: #2563EB (blue-600)
  Background: #EFF6FF (blue-50)
  Accent: #1D4ED8 (blue-700)

POS Mode (Green):
  Primary: #16A34A (green-600)
  Background: #F0FDF4 (green-50)
  Accent: #15803D (green-700)

Neutral:
  Text primary: #111827
  Text secondary: #6B7280
  Border: #E5E7EB
  Danger: #DC2626

Typography:
  Font: System default (SF Pro on iOS, Roboto on Android)
  Scale: 12/14/16/18/20/24/32px
```

### UX Rules
1. **Time targets**: <45s add item, <15s sell item — these are product requirements not aspirations
2. **One thumb operation**: All critical actions reachable with right thumb
3. **WhatsApp-familiar patterns**: Bottom tabs, card lists, status indicators
4. **Forgiving inputs**: Auto-format phone numbers, currency inputs default to local currency
5. **Feedback on every action**: Toast notifications, haptic feedback on sale confirmation
6. **Offline-first UI**: Never show spinners for local data. Only show loading for network ops.

---

## 7. Monetization

### Subscription
- **Price**: KES 650/month (~$5 USD), NGN 2,300/month
- **Trial**: 30 days free, full feature access
- **Payment**: IntaSend STK Push (M-Pesa Express) — owner's phone gets a payment prompt, they enter PIN, done
- **Grace period**: 7 days after expiry before features lock
- **Locked features on expiry**: Adding new items, printing labels (can still view and sell)

### Free Printer Program
- First 200 users who: complete signup + add 10+ items + are in Nairobi
- Printer shipped within 3 business days
- Tracked via referral code on signup

### Revenue Projections
| Month | Users | MRR |
|-------|-------|-----|
| 3 | 50 paid | $250 |
| 6 | 100 paid | $500 |
| 9 | 200 paid | $1,000 |
| 12 | 600 paid | $3,000 |

---

## 8. Development Roadmap

### Phase 1: Foundation (Weeks 1–2)
- [ ] Expo project setup with TypeScript + NativeWind
- [ ] Supabase project + schema + RLS policies
- [ ] Auth flow: phone → OTP → PIN setup
- [ ] Navigation structure: Expo Router with tab + stack
- [ ] WatermelonDB schema + sync engine scaffold
- [ ] Core design system components

### Phase 2: Core Features (Weeks 3–4)
- [ ] Camera + photo capture + compression pipeline
- [ ] TFLite model integration + inference
- [ ] Add Item form with ML pre-fill
- [ ] QR code generation (react-native-qrcode-svg)
- [ ] Local database operations (CRUD)
- [ ] Mode toggle (Inventory/POS)

### Phase 3: Inventory & POS (Weeks 5–6)
- [ ] Inventory list view (search, filter, sort)
- [ ] Item detail/edit screen
- [ ] QR scanner (expo-camera barcode scanning)
- [ ] Sale confirmation flow
- [ ] Transaction history
- [ ] Offline sync to Supabase

### Phase 4: Dashboard & Printer (Weeks 7–8)
- [ ] Owner dashboard with real-time stats
- [ ] Supabase Realtime integration
- [ ] Bluetooth printer pairing wizard
- [ ] ESC/POS label generation
- [ ] Print queue (offline resilience)
- [ ] Push notifications (Expo Notifications)

### Phase 5: Beta (Weeks 9–12)
- [ ] Internal alpha (5 users)
- [ ] Private beta (20 Nairobi users + printers)
- [ ] Bug fixes + performance tuning
- [ ] App Store + Play Store submission
- [ ] Subscription flow (manual M-Pesa for beta)

### Phase 2 Features (Months 3–4)
- Attendant logins (PIN-based, POS-only)
- M-Pesa payment integration: IntaSend STK push + manual transaction code entry
- Export reports (PDF)
- Multi-location support
- WhatsApp daily summaries (WhatsApp Business API)

---

## 9. Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|------------|
| Printer Bluetooth unstable | High | Medium | Test 3 printer models; print queue for offline; switch printer models if needed |
| TFLite accuracy too low | Medium | Low | User always edits; improve dataset over time; worst case = manual entry |
| WatermelonDB sync conflicts | High | Medium | Strict last-write-wins; transaction log; conflict UI for Phase 2 |
| App Store rejection (QR scanning) | Medium | Low | Common use case; describe clearly in store listing |
| Africa's Talking SMS delays | Medium | Medium | Retry logic; push notification as primary, SMS as fallback |
| Low-light QR scan failures | High | High | expo-camera has better low-light than html5-qrcode; test in dim conditions |
| User drops at Bluetooth pairing | High | High | In-app video wizard; test with 5 non-tech users before beta |
| M-Pesa API sandbox issues | Medium | Medium | IntaSend sandbox well-documented; manual M-Pesa code entry as fallback requires no API |
| Safaricom Daraja C2B (Phase 3) | Low | Low | Deferred; schema provision already in place (payment_status, mpesa_transaction_code fields) |
| Photo storage costs | Low | Medium | Compress aggressively; Supabase free tier = 1GB; monitor closely |

---

## 10. Open Decisions (Resolve Before Each Phase)

| Decision | Deadline | Options |
|----------|----------|---------|
| Primary printer model | Week 8 | Phomemo M02 vs Niimbot D11 vs generic ESC/POS |
| Subscription payment for beta | Week 9 | Manual M-Pesa vs IntaSend STK push |
| Push notification provider | Week 7 | Expo Notifications vs OneSignal |
| ML model improvement | Month 3 | Fine-tune on African fashion images vs use cloud Vision API as fallback |
| Geographic expansion | Month 6 | Nairobi-only vs Lagos expansion |

---

*End of PRD v1.0*
