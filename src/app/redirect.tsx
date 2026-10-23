import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../theme/ThemeContext';

/**
 * Landing page for the OAuth redirect on web.
 *
 * The popup briefly navigates here before expo-web-browser closes it and hands
 * the result back. Without this route the user sees the router's unmatched-route
 * screen mid-sign-in.
 */
export default function RedirectScreen() {
  const { colors } = useTheme();

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[styles.label, { color: colors.textMuted }]}>Finishing sign-in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  label: { fontSize: 13 },
});
