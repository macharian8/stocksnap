import 'expo-dev-client';
import { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Slot, router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { getStoredSession, loadFromStorage } from '../lib/storage';
import { useAuthStore } from '../store/auth';
import { useToastStore } from '../store/toast';
import { Toast } from '../components/ui/Toast';
import type { Profile } from '../types';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const toast = useToastStore();
  const hideToast = useCallback(() => toast.hide(), [toast]);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      await loadFromStorage();
      const stored = getStoredSession();

      if (!stored) {
        if (mounted) {
          setLoading(false);
          setIsReady(true);
          router.replace('/(auth)/phone');
        }
        return;
      }

      // Try to restore the session with Supabase
      const { data, error } = await supabase.auth.setSession({
        access_token: stored.access_token,
        refresh_token: stored.refresh_token,
      });

      if (!mounted) return;

      if (error || !data.session) {
        setLoading(false);
        setIsReady(true);
        router.replace('/(auth)/phone');
        return;
      }

      setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      // Check if profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profileError || !profile) {
        setLoading(false);
        setIsReady(true);
        router.replace('/(auth)/phone');
        return;
      }

      setUser(profile as Profile);
      setIsReady(true);
      router.replace('/(auth)/pin-login');
    }

    restoreSession();

    return () => {
      mounted = false;
    };
  }, [setSession, setUser, setLoading]);

  if (!isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-[#EFF6FF]">
        <Text className="mb-4 text-3xl font-extrabold text-[#2563EB]">
          StockSnap
        </Text>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Slot />
      <Toast
        message={toast.message}
        variant={toast.variant}
        visible={toast.visible}
        onDismiss={hideToast}
      />
    </View>
  );
}
