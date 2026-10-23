import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCatalog } from '../state/CatalogContext';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/tokens';

const SPIN_MS = 1200;
const BALLOON_LINGER_MS = 3200;

/**
 * Quiet Drive status for the header's right side: the arrow turns while a sync
 * runs, and its colour carries the state. Hovering (or pressing) opens a small
 * balloon with the detailed message; pressing also starts a sync. The footer
 * that used to hold the message and the mobile "New" link are gone.
 */
export function SyncStatusButton() {
  const { message, syncing, syncState, sync } = useCatalog();
  const { colors } = useTheme();
  const styles = useStyles(colors);

  // Lazy initial state keeps one Animated.Value for the life of the header
  // without reading a ref during render.
  const [spin] = useState(() => new Animated.Value(0));
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!syncing) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: SPIN_MS,
        easing: Easing.linear,
        // RN Web cannot drive this natively; native platforms can.
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin, syncing]);

  // Keep the balloon up while a sync runs, then long enough to read the result.
  useEffect(() => {
    if (!pinned || syncing) return;
    const timer = setTimeout(() => setPinned(false), BALLOON_LINGER_MS);
    return () => clearTimeout(timer);
  }, [pinned, syncing, message]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const tone =
    syncState === 'error'
      ? colors.danger
      : syncState === 'local'
        ? colors.textMuted
        : colors.primary;
  const showBalloon = hovered || pinned;
  const tap = Platform.OS === 'web' ? 'Clique para sincronizar agora' : 'Toque para sincronizar agora';
  const hint = syncing
    ? 'Sincronizando com o Google Drive'
    : syncState === 'error'
      ? 'Verifique a conexão e tente novamente'
      : tap;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={syncing ? 'Sincronizando com o Google Drive' : `Status de sincronização: ${message}`}
        accessibilityHint={tap}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={() => {
          setPinned(true);
          void sync();
        }}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ transform: [{ rotate }] }}
        >
          <Ionicons name="sync" size={20} color={tone} style={styles.glyph} />
        </Animated.View>
      </Pressable>

      {showBalloon ? (
        <View style={styles.balloon}>
          <Text style={styles.balloonTitle}>{message}</Text>
          <Text style={styles.balloonHint}>{hint}</Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = (colors: ThemeColors) =>
  useMemo(
    () =>
      StyleSheet.create({
        wrap: { position: 'relative', zIndex: 20 },
        button: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
        pressed: { opacity: 0.6 },
        glyph: { lineHeight: 20 },
        balloon: {
          position: 'absolute',
          top: 40,
          right: 0,
          width: 240,
          padding: 12,
          gap: 4,
          borderRadius: 8,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          shadowColor: colors.shadow,
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
          pointerEvents: 'none',
          zIndex: 30,
        },
        balloonTitle: { color: colors.text, fontSize: 13, lineHeight: 20 },
        balloonHint: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
      }),
    [colors],
  );
