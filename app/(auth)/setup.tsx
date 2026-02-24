import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { hashPin } from '../../lib/crypto';
import { saveSession, saveUserId } from '../../lib/storage';
import { useAuthStore } from '../../store/auth';
import type { Profile } from '../../types';

export default function SetupScreen() {
  const [businessName, setBusinessName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phone = useAuthStore((s) => s.phone);
  const setUser = useAuthStore((s) => s.setUser);
  const setSession = useAuthStore((s) => s.setSession);

  const handleSubmit = useCallback(async () => {
    setError(null);

    if (!businessName.trim()) {
      setError('Business name is required');
      return;
    }

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setError('PIN must be exactly 6 digits');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setIsLoading(true);

    if (__DEV__) {
      // Dev bypass: no real Supabase session — build a mock profile locally
      const devId = '00000000-0000-0000-0000-000000000001';
      const pinHash = await hashPin(pin);
      const now = new Date().toISOString();
      const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

      const devProfile: Profile = {
        id: devId,
        phone: phone ?? '+254000000000',
        pin_hash: pinHash,
        subscription_status: 'trial',
        trial_ends_at: trialEnd,
        subscription_ends_at: null,
        printer_serial: null,
        business_name: businessName.trim(),
        role: 'owner',
        shop_id: null,
        created_at: now,
        updated_at: now,
      };

      saveSession('dev-access-token', 'dev-refresh-token');
      saveUserId(devId);
      setSession({ access_token: 'dev-access-token', refresh_token: 'dev-refresh-token' });
      setUser(devProfile);
      setIsLoading(false);
      router.replace('/(main)/inventory');
      return;
    }

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      setIsLoading(false);
      setError('Session expired. Please sign in again.');
      return;
    }

    const pinHash = await hashPin(pin);
    const now = new Date().toISOString();
    const trialEnd = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000
    ).toISOString();

    const profileData = {
      id: authUser.id,
      phone: phone ?? authUser.phone ?? '',
      pin_hash: pinHash,
      subscription_status: 'trial' as const,
      trial_ends_at: trialEnd,
      subscription_ends_at: null,
      printer_serial: null,
      business_name: businessName.trim(),
      created_at: now,
      updated_at: now,
    };

    const { data: profile, error: insertError } = await supabase
      .from('profiles')
      .insert(profileData)
      .select()
      .single();

    setIsLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setUser(profile as Profile);
    router.replace('/(main)/inventory');
  }, [businessName, pin, confirmPin, phone, setUser]);

  return (
    <SafeAreaView className="flex-1 bg-[#EFF6FF]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="mb-10 items-center">
            <Text className="text-2xl font-bold text-[#111827]">
              Set up your business
            </Text>
            <Text className="mt-2 text-sm text-[#6B7280]">
              This takes less than a minute
            </Text>
          </View>

          {/* Business Name */}
          <Text className="mb-2 text-sm font-medium text-[#111827]">
            Business name
          </Text>
          <TextInput
            className="mb-6 min-h-[52px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-base text-[#111827]"
            placeholder="e.g. Mama Njeri's Shop"
            placeholderTextColor="#9CA3AF"
            value={businessName}
            onChangeText={(text) => {
              setError(null);
              setBusinessName(text);
            }}
            autoFocus
            editable={!isLoading}
          />

          {/* PIN */}
          <Text className="mb-2 text-sm font-medium text-[#111827]">
            Create a 6-digit PIN
          </Text>
          <TextInput
            className="mb-6 min-h-[52px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-center text-2xl text-[#111827]"
            placeholder="------"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            value={pin}
            onChangeText={(text) => {
              setError(null);
              setPin(text.replace(/\D/g, ''));
            }}
            editable={!isLoading}
          />

          {/* Confirm PIN */}
          <Text className="mb-2 text-sm font-medium text-[#111827]">
            Confirm PIN
          </Text>
          <TextInput
            className="mb-2 min-h-[52px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-center text-2xl text-[#111827]"
            placeholder="------"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            value={confirmPin}
            onChangeText={(text) => {
              setError(null);
              setConfirmPin(text.replace(/\D/g, ''));
            }}
            editable={!isLoading}
          />

          {/* Error */}
          {error ? (
            <Text className="mb-4 text-sm text-[#DC2626]">{error}</Text>
          ) : (
            <View className="mb-4" />
          )}

          {/* Submit Button */}
          <Pressable
            onPress={handleSubmit}
            disabled={isLoading}
            className="min-h-[52px] items-center justify-center rounded-xl bg-[#2563EB] disabled:opacity-50"
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-white">
                Get started
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
