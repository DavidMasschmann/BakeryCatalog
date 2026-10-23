import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { HeaderHomeButton } from '../components/HeaderHomeButton';
import { AuthProvider } from '../state/AuthContext';
import { CatalogProvider } from '../state/CatalogContext';
import { RoleProvider } from '../state/RoleContext';
import { ThemeProvider, useTheme } from '../theme/ThemeContext';

function ThemedStack() {
  const { colors, scheme } = useTheme();

  // Without this, React Navigation's stock #f2f2f2 background shows through
  // edges, transitions and screens that do not paint their own background.
  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [colors, scheme]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.background },
          headerLeft: () => <HeaderHomeButton />,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Catálogo de Produtos' }} />
        <Stack.Screen name="product/[id]" options={{ title: 'Produto' }} />
        <Stack.Screen name="settings" options={{ title: 'Configurações' }} />
        <Stack.Screen name="redirect" options={{ headerShown: false }} />
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RoleProvider>
        <AuthProvider>
          <CatalogProvider>
            <ThemedStack />
          </CatalogProvider>
        </AuthProvider>
      </RoleProvider>
    </ThemeProvider>
  );
}
