import { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageResizeMode,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import type { PhotoRef } from '../data/types';
import { resolvePhotoUri } from '../drive/photos';
import { useAuth } from '../state/AuthContext';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  photo: PhotoRef | null;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
};

/**
 * Photos live in Drive, so rendering one is an async fetch plus a local cache
 * lookup. Until it resolves, show a neutral placeholder.
 */
export function ProductPhoto({ photo, style, resizeMode = 'cover' }: Props) {
  const { accessToken } = useAuth();
  const { colors } = useTheme();
  const [loaded, setLoaded] = useState<{ fileId: string; uri: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!photo || !accessToken) return;

    let cancelled = false;
    void resolvePhotoUri(accessToken, photo)
      .then((uri) => {
        if (!cancelled) setLoaded({ fileId: photo.fileId, uri });
      })
      .catch(() => {
        if (!cancelled) setFailed(photo.fileId);
      });

    return () => {
      cancelled = true;
    };
  }, [photo, accessToken]);

  const src = photo && loaded?.fileId === photo.fileId ? loaded.uri : null;

  if (src) {
    return <Image source={{ uri: src }} resizeMode={resizeMode} style={[styles.photo, style]} />;
  }

  const label = !photo ? 'Sem foto' : failed === photo.fileId ? 'Indisponível' : '...';

  return (
    <View style={[styles.photo, styles.placeholder, { backgroundColor: colors.surfaceAlt }, style]}>
      <Text style={[styles.placeholderText, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { borderRadius: 12 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 11 },
});
