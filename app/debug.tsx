import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { useToastStore } from '../store/toast';
import { clearAllStorage } from '../lib/storage';
import { generateSku } from '../lib/sku';

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <View
      className={`h-3 w-3 rounded-full ${ok ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`}
    />
  );
}

export default function DebugScreen() {
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const show = useToastStore((s) => s.show);

  const [supabaseOk, setSupabaseOk] = useState<boolean | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    async function checkSupabase() {
      const { error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
      setSupabaseOk(!error);
    }
    checkSupabase();
  }, []);

  const handleCreateTestItem = useCallback(async () => {
    if (!user) {
      show('No user logged in', 'error');
      return;
    }

    setIsCreating(true);
    const sku = generateSku(user.id, user.business_name);
    const now = new Date().toISOString();

    const { error } = await supabase.from('items').insert({
      user_id: user.id,
      title: `Test Item ${sku}`,
      description: 'Created from debug screen',
      sku,
      category: 'test',
      condition: 'new',
      unit_of_measure: 'piece',
      buy_price: 100,
      sell_price: 200,
      sell_price_floor: 150,
      sell_price_ceiling: null,
      quantity_in_stock: 10,
      quantity_sold: 0,
      reorder_point: 2,
      image_url: null,
      qr_code_data: `stocksnap:${sku}`,
      is_active: true,
      created_at: now,
      updated_at: now,
    });

    setIsCreating(false);

    if (error) {
      show(`Insert failed: ${error.message}`, 'error');
    } else {
      show(`Created item ${sku}`, 'success');
    }
  }, [user, show]);

  const handleClearStorage = useCallback(() => {
    clearAllStorage();
    show('Storage cleared', 'warning');
  }, [show]);

  const handleSignOut = useCallback(() => {
    signOut();
    router.replace('/(auth)/phone');
  }, [signOut]);

  if (!__DEV__) {
    return <Redirect href="/(main)/inventory" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-[#EFF6FF]">
      <ScrollView className="flex-1 px-4 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="mb-6 text-2xl font-bold text-[#111827]">
          Debug Panel
        </Text>

        {/* Auth State */}
        <View className="mb-4 rounded-xl bg-white p-4">
          <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
            Auth State
          </Text>
          <Text className="mb-1 text-sm text-[#111827]">
            <Text className="font-medium">User ID: </Text>
            {user?.id ?? 'null'}
          </Text>
          <Text className="mb-1 text-sm text-[#111827]">
            <Text className="font-medium">Business: </Text>
            {user?.business_name ?? 'null'}
          </Text>
          <Text className="text-sm text-[#111827]">
            <Text className="font-medium">Session: </Text>
            {session ? 'Active' : 'None'}
          </Text>
        </View>

        {/* Supabase Status */}
        <View className="mb-4 rounded-xl bg-white p-4">
          <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
            Supabase
          </Text>
          <View className="flex-row items-center gap-2">
            {supabaseOk === null ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <StatusDot ok={supabaseOk} />
            )}
            <Text className="text-sm text-[#111827]">
              {supabaseOk === null
                ? 'Checking...'
                : supabaseOk
                  ? 'Connected'
                  : 'Connection failed'}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View className="gap-3">
          <Pressable
            onPress={handleCreateTestItem}
            disabled={isCreating}
            className="min-h-[52px] items-center justify-center rounded-xl bg-[#2563EB] disabled:opacity-50"
          >
            {isCreating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold text-white">
                Create test item
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleClearStorage}
            className="min-h-[52px] items-center justify-center rounded-xl border border-[#D97706] bg-white"
          >
            <Text className="text-base font-semibold text-[#D97706]">
              Clear storage
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSignOut}
            className="min-h-[52px] items-center justify-center rounded-xl border border-[#DC2626] bg-white"
          >
            <Text className="text-base font-semibold text-[#DC2626]">
              Sign out
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
