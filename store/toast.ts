import { create } from 'zustand';

type ToastVariant = 'success' | 'error' | 'warning';

interface ToastState {
  message: string;
  variant: ToastVariant;
  visible: boolean;
  show: (message: string, variant: ToastVariant) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  message: '',
  variant: 'success',
  visible: false,
  show: (message, variant) => set({ message, variant, visible: true }),
  hide: () => set({ visible: false }),
}));
