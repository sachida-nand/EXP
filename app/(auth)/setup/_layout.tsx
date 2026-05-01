import React from 'react';
import { Stack } from 'expo-router';
import { SetupProvider } from '../../../context/SetupContext';
import { useAuth } from '../../../hooks/useAuth';

export default function SetupLayout() {
  const { user } = useAuth();
  return (
    <SetupProvider initialName={user?.name ?? ''}>
      <Stack screenOptions={{ headerShown: false }} />
    </SetupProvider>
  );
}
