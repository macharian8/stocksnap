import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Profile } from '../types';
import { verifyPin } from '../lib/crypto';
import { clearSession } from '../lib/storage';

interface Session {
  access_token: string;
  refresh_token: string;
}

interface AuthState {
  user: Profile | null;
  session: Session | null;
  phone: string | null;
  isLoading: boolean;
  mode: 'inventory' | 'pos';
  lastScannedSku: string | null;
  lastScanTime: number;
  setUser: (user: Profile | null) => void;
  setSession: (session: Session | null) => void;
  setPhone: (phone: string) => void;
  setMode: (mode: 'inventory' | 'pos') => void;
  setLoading: (loading: boolean) => void;
  setLastScannedSku: (sku: string) => void;
  signOut: () => void;
  checkPin: (pin: string) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  immer((set, get) => ({
    user: null,
    session: null,
    phone: null,
    isLoading: true,
    mode: 'inventory',
    lastScannedSku: null,
    lastScanTime: 0,
    setUser: (user) =>
      set((state) => {
        state.user = user;
        state.isLoading = false;
      }),
    setSession: (session) =>
      set((state) => {
        state.session = session;
      }),
    setPhone: (phone) =>
      set((state) => {
        state.phone = phone;
      }),
    setMode: (mode) =>
      set((state) => {
        state.mode = mode;
      }),
    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading;
      }),
    setLastScannedSku: (sku) =>
      set((state) => {
        state.lastScannedSku = sku;
        state.lastScanTime = Date.now();
      }),
    signOut: () => {
      clearSession();
      set((state) => {
        state.user = null;
        state.session = null;
        state.phone = null;
        state.mode = 'inventory';
      });
    },
    checkPin: async (pin: string) => {
      const user = get().user;
      if (!user) return false;
      return verifyPin(pin, user.pin_hash);
    },
  }))
);
