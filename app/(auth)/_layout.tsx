import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#EFF6FF' },
        animation: 'slide_from_right',
      }}
    />
  );
}
