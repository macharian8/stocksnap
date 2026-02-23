import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { normalizeKenyanPhone, isValidKenyanPhone } from '../../lib/phone';
import { useAuthStore } from '../../store/auth';

export default function PhoneScreen() {
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setStorePhone = useAuthStore((s) => s.setPhone);

  const handleContinue = useCallback(async () => {
    setError(null);

    if (!isValidKenyanPhone(phone)) {
      setError('Enter a valid Kenyan phone number (e.g. 0712 345 678)');
      return;
    }

    const normalized = normalizeKenyanPhone(phone);
    setIsLoading(true);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: normalized,
    });

    setIsLoading(false);

    if (otpError) {
      if (__DEV__) {
        // Phone provider disabled in dev — bypass OTP send and go to OTP screen
        setStorePhone(normalized);
        router.push('/(auth)/otp');
        return;
      }
      setError(otpError.message);
      return;
    }

    setStorePhone(normalized);
    router.push('/(auth)/otp');
  }, [phone, setStorePhone]);

  const handlePhoneChange = useCallback((text: string) => {
    setError(null);
    setPhone(text);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-[#EFF6FF]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-8">
          {/* Logo */}
          <View className="mb-12 items-center">
            <Text className="text-4xl font-extrabold text-[#2563EB]">
              StockSnap
            </Text>
            <Text className="mt-2 text-base text-[#6B7280]">
              Inventory & POS
            </Text>
          </View>

          {/* Phone Input */}
          <Text className="mb-2 text-sm font-medium text-[#111827]">
            Phone number
          </Text>
          <View className="mb-2 flex-row items-center rounded-xl border border-[#E5E7EB] bg-white px-4">
            <Text className="mr-2 text-base text-[#6B7280]">+254</Text>
            <TextInput
              className="min-h-[52px] flex-1 text-base text-[#111827]"
              placeholder="712 345 678"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              autoFocus
              value={phone}
              onChangeText={handlePhoneChange}
              maxLength={13}
              editable={!isLoading}
            />
          </View>

          {/* Error */}
          {error ? (
            <Text className="mb-4 text-sm text-[#DC2626]">{error}</Text>
          ) : (
            <View className="mb-4" />
          )}

          {/* Continue Button */}
          <Pressable
            onPress={handleContinue}
            disabled={isLoading || phone.length < 9}
            className="min-h-[52px] items-center justify-center rounded-xl bg-[#2563EB] disabled:opacity-50"
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-white">
                Continue
              </Text>
            )}
          </Pressable>

          {/* Debug (dev only) */}
          {__DEV__ ? (
            <Pressable
              onPress={() => router.push('/debug')}
              className="mt-2 min-h-[44px] items-center justify-center"
            >
              <Text className="text-sm font-medium text-[#6B7280]">
                Debug
              </Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
