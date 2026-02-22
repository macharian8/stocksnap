import { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { verifyPin } from '../../lib/crypto';
import { useAuthStore } from '../../store/auth';
import type { Profile } from '../../types';

const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 3;

const NUMPAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'del'],
] as const;

export default function PinLoginScreen() {
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [businessName, setBusinessName] = useState('');
  const [pinHash, setPinHash] = useState('');
  const setUser = useAuthStore((s) => s.setUser);

  // Fetch the user's profile on mount
  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.replace('/(auth)/phone');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (!mounted) return;

      if (profileError || !profile) {
        router.replace('/(auth)/setup');
        return;
      }

      setBusinessName((profile as Profile).business_name);
      setPinHash((profile as Profile).pin_hash);
      setIsLoading(false);
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePress = useCallback(
    async (key: string) => {
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
        const match = await verifyPin(newPin, pinHash);

        if (match) {
          // Load full profile into store
          const {
            data: { user: authUser },
          } = await supabase.auth.getUser();

          if (authUser) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', authUser.id)
              .single();

            if (profile) {
              setUser(profile as Profile);
            }
          }

          router.replace('/(main)/inventory');
        } else {
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          setPin('');

          if (newAttempts >= MAX_ATTEMPTS) {
            setError(null);
          } else {
            setError(
              `Wrong PIN. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts === 1 ? '' : 's'} left.`
            );
          }
        }
      }
    },
    [pin, pinHash, attempts, setUser]
  );

  const handleForgotPin = useCallback(() => {
    router.replace('/(auth)/phone');
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#EFF6FF]">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  if (attempts >= MAX_ATTEMPTS) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF6FF]">
        <View className="flex-1 items-center justify-center px-8">
          <Text className="mb-2 text-xl font-bold text-[#111827]">
            Too many attempts
          </Text>
          <Text className="mb-8 text-center text-sm text-[#6B7280]">
            You've entered the wrong PIN {MAX_ATTEMPTS} times.{'\n'}
            Verify your phone number to continue.
          </Text>
          <Pressable
            onPress={handleForgotPin}
            className="min-h-[52px] w-full items-center justify-center rounded-xl bg-[#2563EB]"
          >
            <Text className="text-base font-semibold text-white">
              Verify phone number
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#EFF6FF]">
      <View className="flex-1 justify-between px-8 pb-8 pt-16">
        {/* Header */}
        <View className="items-center">
          <Text className="text-2xl font-bold text-[#111827]">
            Welcome back
          </Text>
          <Text className="mt-1 text-base text-[#6B7280]">
            {businessName}
          </Text>
        </View>

        {/* PIN Dots */}
        <View className="items-center">
          <View className="mb-6 flex-row gap-4">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View
                key={i}
                className={`h-4 w-4 rounded-full ${
                  i < pin.length ? 'bg-[#2563EB]' : 'border-2 border-[#E5E7EB] bg-white'
                }`}
              />
            ))}
          </View>

          {/* Error */}
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
                  disabled={key === ''}
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

          {/* Forgot PIN */}
          <Pressable
            onPress={handleForgotPin}
            className="mt-2 min-h-[44px] items-center justify-center"
          >
            <Text className="text-sm font-medium text-[#2563EB]">
              Forgot PIN?
            </Text>
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
      </View>
    </SafeAreaView>
  );
}
