import { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/auth';
import { PinPad } from '../../components/ui/PinPad';
import type { AppMode } from '../../types';

function InventoryIcon({ color }: { color: string }) {
  return (
    <Text style={{ color, fontSize: 20 }}>📦</Text>
  );
}

function PosIcon({ color }: { color: string }) {
  return (
    <Text style={{ color, fontSize: 20 }}>🔍</Text>
  );
}

function DashboardIcon({ color }: { color: string }) {
  return (
    <Text style={{ color, fontSize: 20 }}>📊</Text>
  );
}

export default function MainLayout() {
  const user = useAuthStore((s) => s.user);
  const mode = useAuthStore((s) => s.mode);
  const setMode = useAuthStore((s) => s.setMode);
  const checkPin = useAuthStore((s) => s.checkPin);
  const [showPinModal, setShowPinModal] = useState(false);

  const pathname = usePathname();
  const isOnDashboard = pathname.startsWith('/dashboard');

  const targetMode: AppMode = mode === 'inventory' ? 'pos' : 'inventory';

  const handleModeToggle = useCallback(() => {
    if (targetMode === 'inventory') {
      // Switching TO inventory requires PIN
      setShowPinModal(true);
    } else {
      // Switching to POS — no PIN needed
      setMode('pos');
    }
  }, [targetMode, setMode]);

  const handlePinComplete = useCallback(
    async (pin: string): Promise<boolean> => {
      const success = await checkPin(pin);
      if (success) {
        setShowPinModal(false);
        setMode('inventory');
      }
      return success;
    },
    [checkPin, setMode]
  );

  const handlePinCancel = useCallback(() => {
    setShowPinModal(false);
  }, []);

  const isInventory = mode === 'inventory';
  const primaryColor = isInventory ? '#2563EB' : '#16A34A';
  const bgColor = isInventory ? '#EFF6FF' : '#F0FDF4';

  const headerRight = useMemo(
    () =>
      isOnDashboard ? null : (
        <Pressable
          onPress={handleModeToggle}
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-3 py-2"
          style={{ backgroundColor: isInventory ? '#DCFCE7' : '#DBEAFE' }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: isInventory ? '#16A34A' : '#2563EB' }}
          >
            {isInventory ? 'Switch to POS' : 'Switch to Inventory'}
          </Text>
        </Pressable>
      ),
    [handleModeToggle, isInventory, isOnDashboard]
  );

  return (
    <>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: bgColor },
          headerShadowVisible: false,
          headerTitleStyle: { color: '#111827', fontWeight: '700', fontSize: 18 },
          tabBarActiveTintColor: primaryColor,
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#E5E7EB' },
          headerLeft: () => (
            <View className="ml-4">
              <Text className="text-sm font-semibold text-[#111827]">
                {user?.business_name ?? 'StockSnap'}
              </Text>
              <Text className="text-xs text-[#16A34A]">✓ Synced</Text>
            </View>
          ),
          headerRight: () => headerRight,
          headerTitle: '',
        }}
      >
        <Tabs.Screen
          name="inventory"
          options={{
            title: 'Inventory',
            tabBarIcon: ({ color }) => <InventoryIcon color={color} />,
          }}
        />
        <Tabs.Screen
          name="pos"
          options={{
            title: 'POS',
            tabBarIcon: ({ color }) => <PosIcon color={color} />,
          }}
        />
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <DashboardIcon color={color} />,
            href: isInventory ? undefined : null,
          }}
        />
      </Tabs>

      {/* PIN Confirmation Modal */}
      <Modal
        visible={showPinModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handlePinCancel}
      >
        <SafeAreaView className="flex-1 bg-[#EFF6FF] px-8">
          <PinPad
            title="Enter PIN"
            subtitle="PIN required to access Inventory mode"
            accentColor="#2563EB"
            onComplete={handlePinComplete}
            onCancel={handlePinCancel}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}
