import React, { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useShareIntent } from 'expo-share-intent';
import { colors } from '../../constants/colors';

// Listens for share-intent payloads from expo-share-intent and pushes the
// user to the /import tab. Mounted as a child of the (app) Tabs layout so it
// only runs once the user is authenticated AND the (app) navigator is fully
// ready. Wrapped in defensive try/catch + retry because GPay's cold-start
// share flow can race the navigator-mount sequence and throw "Attempted to
// navigate before mounting the Root Layout" on the very first attempt.
function ShareIntentBridge() {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent, error } =
    useShareIntent({ resetOnBackground: true });
  const handledUriRef = useRef<string | null>(null);

  useEffect(() => {
    if (error) {
      console.warn('[share-intent] error:', error);
      resetShareIntent(true);
    }
  }, [error, resetShareIntent]);

  useEffect(() => {
    if (!hasShareIntent) return;
    const file = shareIntent.files?.[0];
    const uri = file?.path ?? null;
    if (!uri) return;
    if (handledUriRef.current === uri) return;
    handledUriRef.current = uri;

    let attempts = 0;
    const maxAttempts = 6; // ~3 seconds total of retries
    const tryPush = () => {
      try {
        router.push({
          pathname: '/(app)/import',
          params: { uri },
        });
        resetShareIntent();
      } catch (e) {
        attempts += 1;
        if (attempts >= maxAttempts) {
          console.warn(
            '[share-intent] gave up navigating to /import after',
            attempts,
            'attempts:',
            e,
          );
          return;
        }
        // Schedule another attempt — the navigator should be ready shortly.
        setTimeout(tryPush, 500);
      }
    };

    // Wait for any in-flight animations / navigation transitions to settle
    // before the first push attempt. On GPay cold-start this gives the (app)
    // Tabs navigator time to fully wire up its child routes.
    InteractionManager.runAfterInteractions(tryPush);
  }, [hasShareIntent, shareIntent, router, resetShareIntent]);

  return null;
}

export default function AppLayout() {
  return (
    <>
      <ShareIntentBridge />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.blue,
          tabBarInactiveTintColor: colors.gray,
          tabBarStyle: { borderTopColor: colors.grayLight },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="salary"
          options={{
            title: 'Salary',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cash-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="wallet"
          options={{
            title: 'Wallet',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="wallet-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="fixed"
          options={{
            title: 'Fixed',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="receipt-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="import"
          options={{
            title: 'Import',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="scan-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
