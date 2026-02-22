import { Stack } from 'expo-router';

export default function PosLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F0FDF4' },
      }}
    />
  );
}
