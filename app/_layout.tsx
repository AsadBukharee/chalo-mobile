import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PushBanner } from '@/components/PushBanner';
import { AppProvider } from '@/context/AppContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
// Side-effect import: registers FCM's background message handler outside the
// React tree, which Firebase requires and which must happen before render.
import '@/lib/pushBackground';

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

const AUTH_ROUTES = new Set(['login', 'verify']);
const WELCOME_ROUTE = 'welcome';

/**
 * Keeps the visible route and the sign-in state in agreement.
 *
 * Signed out, every route funnels to /login; signed in, the auth screens
 * bounce back to the tabs. On a platform with no native Firebase — the web
 * preview, or Expo Go — there is no way to complete an OTP, so the gate stands
 * down rather than trapping the user on a login screen that cannot work.
 */
function useAuthGate() {
  const { status, unavailableReason, hasWelcomed } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading' || unavailableReason) return;

    const first = segments[0] ?? '';
    const onAuthRoute = AUTH_ROUTES.has(first);
    const onWelcome = first === WELCOME_ROUTE;

    if (status !== 'signed-in') {
      if (!onAuthRoute) router.replace('/login');
      return;
    }

    // Signed in with Firebase, but the API account still has to be fetched
    // (and named, if it is new). Until that lands the rest of the app has no
    // account to render, so everything funnels through /welcome.
    if (!hasWelcomed) {
      if (!onWelcome) router.replace('/welcome');
      return;
    }

    if (onAuthRoute || onWelcome) router.replace('/(tabs)');
  }, [status, unavailableReason, hasWelcomed, segments, router]);
}

function RootLayoutNav() {
  const colors = useColors();
  useAuthGate();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="login" options={{ animation: 'fade' }} />
      <Stack.Screen name="verify" />
      <Stack.Screen name="welcome" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="location" />
      <Stack.Screen name="travel-options" />
      <Stack.Screen name="search" />
      <Stack.Screen name="ride" />
      <Stack.Screen name="booking" />
      <Stack.Screen name="journey" />
      <Stack.Screen name="map" options={{ animation: 'fade' }} />
      <Stack.Screen name="driver" />
      <Stack.Screen name="vehicle" />
      <Stack.Screen name="register-car" />
      <Stack.Screen name="cloudinary-test" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <AppProvider>
              <AuthProvider>
                <ErrorBoundary>
                  <RootLayoutNav />
                  {/* Floats above every screen: foreground pushes are the
                      app's job to display, the OS will not do it. */}
                  <PushBanner />
                </ErrorBoundary>
              </AuthProvider>
            </AppProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
