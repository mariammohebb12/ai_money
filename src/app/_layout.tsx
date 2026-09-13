import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { CurrencyProvider } from '@/hooks/use-currency';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AuthProvider>
        <CurrencyProvider>
          <RootNavigator />
        </CurrencyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { session, isLoading } = useAuth();

  // Auth state hasn't resolved yet (checking for a persisted session on launch).
  // Render a blank loading view instead of the tabs or login screen flashing briefly.
  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primaryAccent} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Stack.Protected only mounts its screens while `guard` is true — expo-router
          automatically redirects here the moment `session` flips, no manual navigation needed. */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-transaction" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-goal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-funds" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-bill" options={{ presentation: 'modal' }} />
        <Stack.Screen name="change-password" options={{ presentation: 'modal' }} />
        <Stack.Screen name="bills" />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
