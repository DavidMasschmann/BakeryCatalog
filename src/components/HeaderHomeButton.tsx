import { usePathname, useRouter } from 'expo-router';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import icon from '../../assets/icon.png';
import { useTheme } from '../theme/ThemeContext';

/**
 * Shop monogram on the far left of every header. Tapping it returns to the
 * catalog; on nested screens it sits next to a back chevron, because setting a
 * custom `headerLeft` hides the native-stack back button.
 *
 * The monogram is maroon with a transparent background, which nearly vanishes on
 * the dark palette, so it gets a light backing plate.
 */
export function HeaderHomeButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();

  const isHome = pathname === '/';
  // Always show the back affordance off-home; `canGoBack()` during render can be
  // stale on web, so it is only consulted when the button is pressed.
  const showBack = !isHome;

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.navigate('/');
  }

  return (
    <View style={styles.row}>
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={12}
          onPress={goBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <View style={[styles.chevron, { borderColor: colors.text }]} />
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Início do catálogo"
        hitSlop={8}
        disabled={isHome}
        onPress={() => router.navigate('/')}
        style={({ pressed }) => [
          styles.logoButton,
          { backgroundColor: colors.logoBackground },
          pressed && styles.pressed,
        ]}
      >
        <Image source={icon} resizeMode="contain" style={styles.logo} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 8,
    // Match the right-hand menu: 8px from the screen edge to the monogram, just
    // as the headerRight container keeps an 8px right margin.
    ...(Platform.OS === 'web' ? { marginLeft: 8 } : null),
  },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  // A rotated square with two borders draws a crisp chevron without an icon font.
  chevron: {
    width: 8,
    height: 8,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
  },
  logoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 24, height: 24 },
  pressed: { opacity: 0.6 },
});
