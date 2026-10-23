import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { PhotoRef } from '../data/types';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/tokens';
import { ProductPhoto } from './ProductPhoto';

export type GalleryPhoto = {
  key: string;
  /** A photo already stored in Drive. */
  photo?: PhotoRef | null;
  /** A local pick that has not been uploaded yet. */
  uri?: string;
};

type Props = {
  photos: GalleryPhoto[];
  active: number;
  onChange: (index: number) => void;
  /** Whether to show the clickable thumbnail strip under the main photo. Defaults to true. */
  showThumbnails?: boolean;
};

const GAP = 8;
const GALLERY_INSET = 20;
const THUMB_SIZE = 64;
const THUMB_GAP = 8;

/**
 * Centered horizontal gallery. The active photo sits in the middle of the
 * viewport; neighbours peek in from the sides. Clicking a photo or using the
 * arrow keys moves the active one. It is intentionally not a ScrollView, so no
 * horizontal scrollbar can appear.
 */
export function PhotoGallery({
  photos,
  active,
  onChange,
  showThumbnails = true,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const { height, width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);

  // The gallery sits inside the form's 20px horizontal padding. The fallback
  // keeps the track visible on the first frame; the effect below reads the
  // viewport itself so a web scrollbar cannot skew the centring.
  const width = measuredWidth || Math.max(0, windowWidth - GALLERY_INSET * 2);

  const galleryHeight = Math.max(160, Math.round((height * 0.4) / 4) * 4);
  const slideWidth =
    width > 0 ? Math.max(120, Math.min(680, Math.round((width * 0.9) / 4) * 4)) : 0;
  const step = slideWidth + GAP;

  const [translateX] = useState(() => new Animated.Value(0));
  const positioned = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const frame = requestAnimationFrame(() => {
      const node = document.querySelector('[data-testid="photo-gallery"]');
      const next = node instanceof HTMLElement ? node.clientWidth : 0;
      if (next > 0) setMeasuredWidth(next);
    });
    return () => cancelAnimationFrame(frame);
  }, [photos.length, windowWidth]);

  useEffect(() => {
    if (!width || !slideWidth) return;

    const target = (width - slideWidth) / 2 - active * step;

    if (!positioned.current) {
      translateX.setValue(target);
      positioned.current = true;
      return;
    }

    Animated.timing(translateX, {
      toValue: target,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [active, slideWidth, step, translateX, width]);

  // Arrow keys work on web, but never steal keys from a field the user is typing in.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

      const target = event.target as (EventTarget & {
        tagName?: string;
        isContentEditable?: boolean;
      }) | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }

      if (event.key === 'ArrowLeft' && active > 0) {
        onChange(active - 1);
        event.preventDefault();
      } else if (event.key === 'ArrowRight' && active < photos.length - 1) {
        onChange(active + 1);
        event.preventDefault();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, onChange, photos.length]);

  // PanResponder to handle horizontal swipe gestures on mobile and web touch.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          const dx = Math.abs(gestureState.dx);
          const dy = Math.abs(gestureState.dy);
          return dx > 10 && dx > dy * 1.2;
        },
        onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
          const dx = Math.abs(gestureState.dx);
          const dy = Math.abs(gestureState.dy);
          return dx > 10 && dx > dy * 1.2;
        },
        onPanResponderRelease: (_evt, gestureState) => {
          if (gestureState.dx < -30 || gestureState.vx < -0.3) {
            if (active < photos.length - 1) {
              onChange(active + 1);
            }
          } else if (gestureState.dx > 30 || gestureState.vx > 0.3) {
            if (active > 0) {
              onChange(active - 1);
            }
          }
        },
      }),
    [active, onChange, photos.length],
  );

  return (
    <View style={styles.container}>
      <View
        testID="photo-gallery"
        {...panResponder.panHandlers}
        style={[styles.viewport, { height: galleryHeight }]}
        onLayout={(event) => {
          // On web the testID measurement above is the reliable one; onLayout can
          // fire before the vertical scrollbar appears and report a wider box.
          if (Platform.OS === 'web') return;
          const next = event.nativeEvent.layout.width;
          if (next > 0) setMeasuredWidth(next);
        }}
      >
        {photos.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhuma foto adicionada</Text>
          </View>
        ) : width > 0 ? (
          <Animated.View style={[styles.track, { transform: [{ translateX }] }]}>
            {photos.map((photo, index) => {
              const selected = index === active;
              return (
                <Pressable
                  key={photo.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Foto ${index + 1} de ${photos.length}`}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    if (!selected) onChange(index);
                  }}
                  style={[
                    styles.slide,
                    { width: slideWidth, height: galleryHeight, opacity: selected ? 1 : 0.45 },
                  ]}
                >
                  {photo.uri ? (
                    <Image source={{ uri: photo.uri }} resizeMode="contain" style={styles.image} />
                  ) : (
                    <ProductPhoto photo={photo.photo ?? null} resizeMode="contain" style={styles.image} />
                  )}
                </Pressable>
              );
            })}
          </Animated.View>
        ) : null}
      </View>

      {showThumbnails && photos.length > 1 ? (
        <View style={styles.thumbnailsWrap}>
          {photos.map((photo, index) => {
            const selected = index === active;
            return (
              <Pressable
                key={`thumb-${photo.key}`}
                accessibilityRole="button"
                accessibilityLabel={`Ver foto ${index + 1}`}
                accessibilityState={{ selected }}
                onPress={() => onChange(index)}
                style={[
                  styles.thumbButton,
                  selected && styles.thumbButtonSelected,
                ]}
              >
                {photo.uri ? (
                  <Image source={{ uri: photo.uri }} resizeMode="cover" style={styles.thumbImage} />
                ) : (
                  <ProductPhoto photo={photo.photo ?? null} resizeMode="cover" style={styles.thumbImage} />
                )}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = (colors: ThemeColors) =>
  useMemo(
    () =>
      StyleSheet.create({
        container: { width: '100%', gap: 12 },
        viewport: {
          overflow: 'hidden',
          borderRadius: 12,
          backgroundColor: colors.surfaceAlt,
          width: '100%',
        },
        track: { flexDirection: 'row', alignItems: 'center', gap: GAP },
        slide: { borderRadius: 12, overflow: 'hidden', justifyContent: 'center' },
        image: { width: '100%', height: '100%', borderRadius: 12 },
        empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        emptyText: { color: colors.textMuted, fontSize: 14 },
        thumbnailsWrap: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: THUMB_GAP,
        },
        thumbButton: {
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: colors.border,
          overflow: 'hidden',
          backgroundColor: colors.surfaceAlt,
        },
        thumbButtonSelected: {
          borderColor: colors.primary,
        },
        thumbImage: {
          width: '100%',
          height: '100%',
        },
      }),
    [colors],
  );
