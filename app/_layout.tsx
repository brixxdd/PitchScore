import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  useEffect(() => {
    // Configurar modo kiosko - se activará en pantallas específicas
    SystemUI.setBackgroundColorAsync('#000000');
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="totem" />
        <Stack.Screen name="judge" />
      </Stack>
    </SafeAreaProvider>
  );
}

