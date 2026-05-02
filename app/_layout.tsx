import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, LogBox } from 'react-native';
import {
  Stack,
  useRouter,
  useSegments,
  useRootNavigationState,
} from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuthContext } from '../context/AuthContext';
import { DataProvider } from '../context/DataContext';
import { colors } from '../constants/colors';

void SplashScreen.preventAutoHideAsync();

// Dev-only: React Navigation's useLinking logs a "configured linking in
// multiple places" warning when expo-share-intent's deep-link URL transiently
// remounts the navigator on cold start. The check is wrapped in a
// `process.env.NODE_ENV === 'production'` guard upstream, so this is purely a
// dev warning. Filter it out to keep the metro log readable.
if (__DEV__) {
  const SUPPRESSED_DEV_NOISE = [
    // React Navigation logs this when expo-share-intent's deep-link URL
    // briefly remounts the navigator on cold start.
    'configured linking in multiple places',
    // Expo Router logs this when a redirect targets a grouped child
    // navigator (e.g. (auth)/pin) before that child has fully mounted.
    // The redirect succeeds on the next tick; this is a transient warning.
    'was not handled by any navigator',
    // Cold-start share-intent timing: expo-share-intent fires its URL handler
    // before the root navigator has finished mounting on the very first
    // frame. The action eventually succeeds on the next render pass, but the
    // initial attempt logs this. App functionality is unaffected.
    'Attempted to navigate before mounting the Root Layout',
  ];
  const matches = (s: unknown) =>
    typeof s === 'string' &&
    SUPPRESSED_DEV_NOISE.some((needle) => s.includes(needle));

  // Quiet console.error.
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    if (matches(args[0])) return;
    origError(...args);
  };
  // Some of these messages come through as warnings/red-box entries, not
  // console.error. ignoreLogs hides matching entries from LogBox/red-box too.
  LogBox.ignoreLogs(SUPPRESSED_DEV_NOISE);
}

// expo-share-intent's native getShareIntent() can throw a SecurityException
// when sender apps (Flutter-based PhonePe/Paytm flows) don't grant URI
// permission to our process. The library doesn't catch it, so it surfaces as
// an unhandled rejection. Swallow only that specific error so the rest of
// the app keeps running; users can fall back to the in-app gallery picker.
const trackingHandler = (e: PromiseRejectionEvent | { reason?: unknown }) => {
  const reason: unknown = (e as { reason?: unknown }).reason;
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : '';
  if (
    message.includes('ExpoShareIntentModule.getShareIntent') ||
    message.includes('ShareFileProvider')
  ) {
    console.warn('[share-intent] suppressed native rejection:', message);
    return;
  }
};

type GlobalWithFlag = typeof globalThis & { __shareIntentRejectionHooked?: boolean };
const g = globalThis as GlobalWithFlag;
if (
  typeof g.addEventListener === 'function' &&
  !g.__shareIntentRejectionHooked
) {
  g.addEventListener('unhandledrejection', trackingHandler as EventListener);
  g.__shareIntentRejectionHooked = true;
}

function Guard({ children }: { children: React.ReactNode }) {
  const { status } = useAuthContext();
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();
  const navReady = Boolean(navState?.key);

  useEffect(() => {
    if (status !== 'loading') {
      void SplashScreen.hideAsync();
    }
  }, [status]);

  useEffect(() => {
    if (!navReady) return;
    if (status === 'loading') return;
    const top = segments[0];
    const inAuth = top === '(auth)';
    const inApp = top === '(app)';

    // Defer the redirect to the next tick so the grouped child navigators
    // ((auth)/_layout, (app)/_layout) finish mounting before we try to
    // navigate into them. Without the deferral, on cold start the Stack
    // exists but its group-children don't, causing
    //   "REPLACE … (auth)/pin was not handled by any navigator".
    const id = setTimeout(() => {
      if (status === 'unauthenticated' && top !== '(auth)') {
        router.replace('/login');
        return;
      }
      if (status === 'setup') {
        const inSetup = segments[1] === 'setup';
        if (!inSetup) router.replace('/setup/step1');
        return;
      }
      if (status === 'locked' && !inAuth) {
        router.replace('/pin');
        return;
      }
      if (status === 'authenticated' && !inApp) {
        router.replace('/dashboard');
        return;
      }
    }, 0);

    return () => clearTimeout(id);
  }, [navReady, status, segments, router]);

  // Always render children so the navigator (Stack) is mounted from the first
  // render. Overlaying the spinner instead of swapping it in for the Stack
  // avoids the "Attempted to navigate before mounting the Root Layout" error
  // when the app is cold-launched via a share intent (e.g. GPay).
  return (
    <>
      {children}
      {status === 'loading' ? (
        <View style={styles.center} pointerEvents="auto">
          <ActivityIndicator color={colors.blue} size="large" />
        </View>
      ) : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <DataProvider>
            <Guard>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
              </Stack>
            </Guard>
          </DataProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
});
