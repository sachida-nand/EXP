import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuthContext } from '../context/AuthContext';
import { DataProvider } from '../context/DataContext';
import { colors } from '../constants/colors';

void SplashScreen.preventAutoHideAsync();

function Guard({ children }: { children: React.ReactNode }) {
  const { status } = useAuthContext();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (status !== 'loading') {
      void SplashScreen.hideAsync();
    }
  }, [status]);

  useEffect(() => {
    if (status === 'loading') return;
    const top = segments[0];
    const inAuth = top === '(auth)';
    const inApp = top === '(app)';

    if (status === 'unauthenticated' && top !== '(auth)') {
      router.replace('/(auth)/login');
      return;
    }
    if (status === 'setup') {
      const inSetup = segments[1] === 'setup';
      if (!inSetup) router.replace('/(auth)/setup/step1');
      return;
    }
    if (status === 'locked' && !inAuth) {
      router.replace('/(auth)/pin');
      return;
    }
    if (status === 'authenticated' && !inApp) {
      router.replace('/(app)/dashboard');
      return;
    }
    // satisfy unused var warning
    void inAuth;
  }, [status, segments, router]);

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  return <>{children}</>;
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
});
