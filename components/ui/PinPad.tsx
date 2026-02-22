import { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';

const PIN_LENGTH = 6;

const NUMPAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'del'],
] as const;

interface PinPadProps {
  title: string;
  subtitle?: string;
  accentColor?: string;
  onComplete: (pin: string) => Promise<boolean>;
  onCancel?: () => void;
}

export function PinPad({
  title,
  subtitle,
  accentColor = '#2563EB',
  onComplete,
  onCancel,
}: PinPadProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handlePress = useCallback(
    async (key: string) => {
      if (isVerifying) return;

      if (key === 'del') {
        setPin((prev) => prev.slice(0, -1));
        setError(null);
        return;
      }

      if (key === '' || pin.length >= PIN_LENGTH) return;

      const newPin = pin + key;
      setPin(newPin);
      setError(null);

      if (newPin.length === PIN_LENGTH) {
        setIsVerifying(true);
        const success = await onComplete(newPin);
        setIsVerifying(false);

        if (!success) {
          setPin('');
          setError('Wrong PIN');
        }
      }
    },
    [pin, isVerifying, onComplete]
  );

  return (
    <View className="flex-1 justify-between pb-8 pt-8">
      {/* Header */}
      <View className="items-center">
        <Text className="text-xl font-bold text-[#111827]">{title}</Text>
        {subtitle ? (
          <Text className="mt-1 text-sm text-[#6B7280]">{subtitle}</Text>
        ) : null}
      </View>

      {/* PIN Dots */}
      <View className="items-center">
        <View className="mb-6 flex-row gap-4">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              className={`h-4 w-4 rounded-full ${
                i < pin.length ? `bg-[${accentColor}]` : 'border-2 border-[#E5E7EB] bg-white'
              }`}
              style={i < pin.length ? { backgroundColor: accentColor } : undefined}
            />
          ))}
        </View>

        {error ? (
          <Text className="text-sm text-[#DC2626]">{error}</Text>
        ) : (
          <Text className="text-sm text-[#6B7280]">Enter your PIN</Text>
        )}
      </View>

      {/* Numpad */}
      <View className="items-center">
        {NUMPAD_KEYS.map((row, rowIdx) => (
          <View key={rowIdx} className="mb-3 flex-row gap-6">
            {row.map((key) => (
              <Pressable
                key={`${rowIdx}-${key}`}
                onPress={() => handlePress(key)}
                disabled={key === '' || isVerifying}
                className={`h-[72px] w-[72px] items-center justify-center rounded-full ${
                  key === ''
                    ? ''
                    : key === 'del'
                      ? ''
                      : 'bg-white border border-[#E5E7EB]'
                }`}
              >
                {key === 'del' ? (
                  <Text className="text-base font-medium text-[#6B7280]">
                    Delete
                  </Text>
                ) : (
                  <Text className="text-2xl font-semibold text-[#111827]">
                    {key}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        ))}

        {onCancel ? (
          <Pressable
            onPress={onCancel}
            className="mt-2 min-h-[44px] items-center justify-center"
          >
            <Text
              className="text-sm font-medium"
              style={{ color: accentColor }}
            >
              Cancel
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
