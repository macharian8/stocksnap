import { useEffect, useCallback } from 'react';
import { Text, Pressable, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastVariant = 'success' | 'error' | 'warning';

interface ToastProps {
  message: string;
  variant: ToastVariant;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

const VARIANT_STYLES: Record<ToastVariant, { bg: string; text: string }> = {
  success: { bg: '#DCFCE7', text: '#15803D' },
  error: { bg: '#FEE2E2', text: '#DC2626' },
  warning: { bg: '#FEF3C7', text: '#D97706' },
};

export function Toast({
  message,
  variant,
  visible,
  onDismiss,
  duration = 3000,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const opacity = new Animated.Value(0);

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => onDismiss());
      }, duration);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible, duration, onDismiss]);

  if (!visible) return null;

  const styles = VARIANT_STYLES[variant];

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        opacity,
        zIndex: 9999,
      }}
    >
      <Pressable
        onPress={onDismiss}
        className="min-h-[44px] items-center justify-center rounded-xl px-4 py-3"
        style={{ backgroundColor: styles.bg }}
      >
        <Text className="text-sm font-medium" style={{ color: styles.text }}>
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
