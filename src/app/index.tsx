import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import { Link, Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { ProductPhoto } from '../components/ProductPhoto';
import { SyncStatusButton } from '../components/SyncStatusButton';
import { CATEGORIES, type Category } from '../data/categories';
import { formatPrice } from '../data/money';
import type { Product } from '../data/types';
import { useCatalog } from '../state/CatalogContext';
import { useRole } from '../state/RoleContext';
import { useViewPreference } from '../state/useViewPreference';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/tokens';

const GRID_CELL_PADDING = 8;
const SCREEN_PADDING = 16;

/** 2 columns on phones, 3 on tablets, 4 on desktop; follows window size. */
function columnsForWidth(width: number): number {
  if (width >= 1200) return 4;
  if (width >= 768) return 3;
  return 2;
}

/** Uses "from" when filling prices differ from the base price. */
function priceLabel(product: Product): string {
  const prices = [product.priceCents, ...product.fillings.map((filling) => filling.priceCents)];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatPrice(product.priceCents) : `a partir de ${formatPrice(min)}`;
}

export default function CatalogScreen() {
  const { products, loading } = useCatalog();
  const { isAdmin } = useRole();
  const { view, setView } = useViewPreference();
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const { width } = useWindowDimensions();

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      if (category && product.category !== category) return false;
      if (!needle) return true;
      const haystack = [
        product.name,
        product.description,
        ...product.fillings.map((filling) => filling.name),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [products, query, category]);

  const gridColumns = columnsForWidth(width);

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerActions}>
              <SyncStatusButton />
              <Link href="/settings" asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Configurações"
                  hitSlop={8}
                  style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}
                >
                  <Ionicons name="settings-outline" size={20} color={colors.primary} style={styles.settingsIcon} />
                </Pressable>
              </Link>
            </View>
          ),
        }}
      />

      <View style={styles.toolbar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por nome, recheio ou descrição"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={view === 'grid' ? 'Exibir em lista' : 'Exibir em grade'}
          onPress={() => setView(view === 'grid' ? 'list' : 'grid')}
          style={styles.viewToggle}
        >
          <Text style={styles.viewToggleLabel}>{view === 'grid' ? 'Lista' : 'Grade'}</Text>
        </Pressable>
      </View>

      <View style={styles.filters}>
        {CATEGORIES.map((option) => {
          const selected = category === option.value;
          const IconComponent =
            option.iconLibrary === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={`Filtrar por: ${option.label}`}
              accessibilityState={{ selected }}
              onPress={() => setCategory(selected ? null : option.value)}
              style={[styles.filterChip, selected && styles.filterChipActive]}
            >
              <IconComponent
                // @ts-expect-error dynamic icon name across icon sets
                name={option.iconName}
                size={16}
                color={selected ? colors.onPrimary : colors.primary}
                style={styles.filterIcon}
              />
              <Text style={[styles.filterLabel, selected && styles.filterLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : view === 'grid' ? (
        <FlashList
          // numColumns cannot change in place: remount when the layout changes.
          key={`grid-${gridColumns}`}
          data={visible}
          masonry
          numColumns={gridColumns}
          keyExtractor={(product) => product.id}
          style={styles.listFill}
          contentContainerStyle={[styles.gridList, visible.length === 0 && styles.emptyList]}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {products.length === 0
                ? 'Nenhum produto cadastrado ainda. Toque em + para adicionar.'
                : 'Nenhum produto encontrado com essa busca.'}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.gridCell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${priceLabel(item)}`}
                onPress={() => router.push(`/product/${item.id}`)}
                style={styles.gridCard}
              >
                <ProductPhoto photo={item.photos[0] ?? null} style={styles.gridPhoto} />
                <View style={styles.gridBody}>
                  <Text style={styles.gridName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.gridPrice}>{priceLabel(item)}</Text>

                  {item.fillings.length > 0 ? (
                    <Text style={styles.gridFillings} numberOfLines={1}>
                      {item.fillings.map((filling) => filling.name).join(' · ')}
                    </Text>
                  ) : null}

                  {item.description ? (
                    <Text style={styles.gridDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </View>
          )}
        />
      ) : (
        <FlatList
          key="list"
          data={visible}
          keyExtractor={(product) => product.id}
          style={styles.listFill}
          contentContainerStyle={[styles.list, visible.length === 0 && styles.emptyList]}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {products.length === 0
                ? 'Nenhum produto cadastrado ainda. Toque em + para adicionar.'
                : 'Nenhum produto encontrado com essa busca.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${priceLabel(item)}`}
              style={styles.card}
              onPress={() => router.push(`/product/${item.id}`)}
            >
              <ProductPhoto photo={item.photos[0] ?? null} style={styles.photo} />
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.price}>{priceLabel(item)}</Text>
                </View>

                {item.fillings.length > 0 ? (
                  <Text style={styles.fillings} numberOfLines={1}>
                    {item.fillings.map((filling) => filling.name).join(' · ')}
                  </Text>
                ) : null}

                {item.description ? (
                  <Text style={styles.description} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}

      {isAdmin ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adicionar produto"
          onPress={() => router.push('/product/new')}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <Ionicons name="add" size={28} color={colors.onPrimary} style={styles.fabIcon} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = (colors: ThemeColors) =>
  useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        headerActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          // Mirror the monogram's web-only 8px margin (doubled on right to 16px).
          ...(Platform.OS === 'web' ? { marginRight: 16 } : null),
        },
        settingsButton: {
          width: 32,
          height: 32,
          alignItems: 'center',
          justifyContent: 'center',
        },
        settingsButtonPressed: { opacity: 0.6 },
        settingsIcon: { lineHeight: 20 },
        toolbar: { flexDirection: 'row', gap: 8, margin: 16, marginBottom: 8 },
        filters: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginHorizontal: 16,
          marginBottom: 8,
        },
        filterChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: colors.surfaceAlt,
        },
        filterChipActive: { backgroundColor: colors.primary },
        filterIcon: { lineHeight: 16 },
        filterLabel: { color: colors.primary, fontWeight: '600', fontSize: 13 },
        filterLabelActive: { color: colors.onPrimary },
        search: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          color: colors.text,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 12,
        },
        viewToggle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 16,
          borderRadius: 8,
          backgroundColor: colors.surfaceAlt,
        },
        viewToggleLabel: { color: colors.primary, fontWeight: '600', fontSize: 13 },
        loader: { marginTop: 24 },
        listFill: { flex: 1 },
        list: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 96, gap: 12 },
        // FlashList masonry assigns one column per item and packs each column
        // independently, so cards of different heights leave no row gaps.
        gridList: {
          paddingHorizontal: GRID_CELL_PADDING,
          paddingTop: GRID_CELL_PADDING,
          paddingBottom: 96,
        },
        gridCell: { padding: GRID_CELL_PADDING },
        emptyList: { flexGrow: 1, justifyContent: 'center' },
        empty: { textAlign: 'center', color: colors.textMuted, paddingHorizontal: 24 },
        card: {
          flexDirection: 'row',
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        },
        photo: {
          width: 120,
          aspectRatio: 1,
          borderRadius: 0,
          alignSelf: 'stretch',
        },
        cardBody: {
          flex: 1,
          padding: 12,
          justifyContent: 'center',
          gap: 4,
        },
        cardHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
        name: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
        price: { fontSize: 15, fontWeight: '600', color: colors.primary },
        fillings: { fontSize: 13, color: colors.text },
        description: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
        gridCard: {
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        },
        gridPhoto: { width: '100%', aspectRatio: 1, borderRadius: 0 },
        gridBody: { padding: 12, gap: 4 },
        gridName: { fontSize: 15, fontWeight: '600', color: colors.text },
        gridPrice: { fontSize: 14, fontWeight: '600', color: colors.primary },
        gridFillings: { fontSize: 12, color: colors.text },
        gridDescription: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
        fab: {
          position: 'absolute',
          right: 16,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
          shadowColor: colors.shadow,
          shadowOpacity: 0.24,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
          zIndex: 10,
        },
        fabPressed: { opacity: 0.85 },
        fabIcon: { lineHeight: 28 },
      }),
    [colors],
  );
