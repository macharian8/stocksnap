import { useState, useCallback, useEffect, useRef } from 'react';
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
import { useAuthStore } from '../../store/auth';
import { saveSession, saveUserId } from '../../lib/storage';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function OtpScreen() {
  const phone = useAuthStore((s) => s.phone);
  const setSession = useAuthStore((s) => s.setSession);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(RESEND_SECONDS);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((t) => t - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleDigitChange = useCallback(
    (text: string, index: number) => {
      setError(null);
      const digit = text.replace(/\D/g, '').slice(-1);

      setDigits((prev) => {
        const next = [...prev];
        next[index] = digit;
        return next;
      });

      // Auto-advance to next input
      if (digit && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    []
  );

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === 'Backspace' && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        setDigits((prev) => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
      }
    },
    [digits]
  );

  const handleVerify = useCallback(async () => {
    if (!phone) {
      setError('Phone number not found. Go back and try again.');
      return;
    }

    const token = digits.join('');
    if (token.length !== OTP_LENGTH) {
      setError('Enter all 6 digits');
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    if (verifyError) {
      setIsLoading(false);
      setError(verifyError.message);
      return;
    }

    if (data.session) {
      saveSession(data.session.access_token, data.session.refresh_token);
      setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }

    const userId = data.user?.id;
    if (!userId) {
      setIsLoading(false);
      setError('Verification succeeded but no user returned.');
      return;
    }

    saveUserId(userId);

    // Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    setIsLoading(false);

    if (profileError) {
      setError(profileError.message);
      return;
    }

    if (profile) {
      router.replace('/(auth)/pin-login');
    } else {
      router.replace('/(auth)/setup');
    }
  }, [phone, digits, setSession]);

  const handleResend = useCallback(async () => {
    if (!phone || resendTimer > 0) return;

    setError(null);
    const { error: resendError } = await supabase.auth.signInWithOtp({
      phone,
    });

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setResendTimer(RESEND_SECONDS);
  }, [phone, resendTimer]);

  return (
    <SafeAreaView className="flex-1 bg-[#EFF6FF]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-8">
          {/* Header */}
          <View className="mb-8 items-center">
            <Text className="text-2xl font-bold text-[#111827]">
              Verify your number
            </Text>
            <Text className="mt-2 text-center text-sm text-[#6B7280]">
              Enter the 6-digit code sent to{'\n'}
              {phone ?? 'your phone'}
            </Text>
          </View>

          {/* OTP Inputs */}
          <View className="mb-4 flex-row justify-center gap-3">
            {digits.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => {
                  inputRefs.current[i] = ref;
                }}
                className="h-14 w-12 rounded-xl border border-[#E5E7EB] bg-white text-center text-2xl font-bold text-[#111827]"
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={(text) => handleDigitChange(text, i)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(nativeEvent.key, i)
                }
                editable={!isLoading}
                autoFocus={i === 0}
              />
            ))}
          </View>

          {/* Error */}
          {error ? (
            <Text className="mb-4 text-center text-sm text-[#DC2626]">
              {error}
            </Text>
          ) : (
            <View className="mb-4" />
          )}

          {/* Verify Button */}
          <Pressable
            onPress={handleVerify}
            disabled={isLoading || digits.some((d) => !d)}
            className="mb-6 min-h-[52px] items-center justify-center rounded-xl bg-[#2563EB] disabled:opacity-50"
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-white">
                Verify
              </Text>
            )}
          </Pressable>

          {/* Resend */}
          <Pressable
            onPress={handleResend}
            disabled={resendTimer > 0}
            className="min-h-[44px] items-center justify-center"
          >
            <Text className="text-sm text-[#6B7280]">
              {resendTimer > 0
                ? `Resend code in ${resendTimer}s`
                : 'Resend code'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
