// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: { backgroundColor: '#ffffff' }
      }}
    >
      {/* Phone Input Screen */}
      <Stack.Screen name="phone" />
      
      {/* OTP Verification Screen */}
      <Stack.Screen name="otp" />
      
      {/* Profile Completion Screen - Combined name/password/role */}
      <Stack.Screen name="profile" />
      
      {/* Worker Onboarding Screen */}
      <Stack.Screen name="worker-onboarding" />
      
      {/* Subcategory Selection Screen - Modal style */}
      <Stack.Screen 
        name="subcategory-selection"
        options={{
          presentation: 'card',
          gestureEnabled: true,
          headerShown: false,
          animation: 'slide_from_right'
        }}
      />
      
      {/* Pending Approval Screen */}
      <Stack.Screen name="pending-approval" />
      
      {/* Sign In Screen */}
      <Stack.Screen 
        name="sign-in" 
        options={{ gestureEnabled: true }}
      />
    </Stack>
  );
}
