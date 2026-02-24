export interface Profile {
  id: string;
  phone: string;
  pin_hash: string;
  subscription_status: 'trial' | 'active' | 'expired' | 'cancelled';
  trial_ends_at: string;
  subscription_ends_at: string | null;
  printer_serial: string | null;
  business_name: string;
  role: 'owner' | 'attendant';
  shop_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Shop {
  id: string;
  owner_id: string;
  name: string;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShopMember {
  id: string;
  shop_id: string;
  user_id: string;
  role: 'owner' | 'attendant';
  created_at: string;
}

export interface Item {
  id: string;
  user_id: string;
  shop_id: string | null;
  title: string;
  description: string | null;
  sku: string;
  category: string | null;
  condition: 'new' | 'used' | 'refurbished';
  unit_of_measure: 'piece' | 'pair' | 'kg' | 'metre' | 'litre' | 'other';
  buy_price: number;
  sell_price: number;
  sell_price_floor: number;
  sell_price_ceiling: number | null;
  quantity_in_stock: number;
  quantity_sold: number;
  reorder_point: number;
  image_url: string | null;
  qr_code_data: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type AppMode = 'inventory' | 'pos';

export type SyncStatus = 'synced' | 'syncing' | 'offline';

export type PaymentMethod = Transaction['payment_method'];

export interface SalePayload {
  item_id: string;
  quantity: number;
  price_at_sale: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: Transaction['payment_status'];
  mpesa_transaction_code: string | null;
  mpesa_phone: string | null;
  notes: string | null;
}

export interface RecentTransaction {
  id: string;
  transaction_type: Transaction['transaction_type'];
  quantity: number;
  total_amount: number;
  created_at: string;
  item_title: string;
}

export interface LowStockItem {
  id: string;
  title: string;
  sku: string;
  quantity_in_stock: number;
  reorder_point: number;
}

export interface DashboardStats {
  todayRevenue: number;
  todaySalesCount: number;
  weekRevenue: number;
  totalStock: number;
  lowStockItems: LowStockItem[];
  recentTransactions: RecentTransaction[];
}

export interface Transaction {
  id: string;
  user_id: string;
  shop_id: string | null;
  item_id: string;
  attendant_id: string | null;
  transaction_type: 'sale' | 'restock' | 'adjustment' | 'return';
  quantity: number;
  price_at_sale: number;
  total_amount: number;
  payment_method: 'cash' | 'mpesa_stk' | 'mpesa_till' | 'card' | 'other';
  payment_status: 'pending' | 'confirmed' | 'failed';
  mpesa_transaction_code: string | null;
  mpesa_phone: string | null;
  notes: string | null;
  created_at: string;
}
