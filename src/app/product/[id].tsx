import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PhotoGallery, type GalleryPhoto } from '../../components/PhotoGallery';
import type { ProductFieldErrors } from '../../data/catalog';
import { CATEGORIES, type Category } from '../../data/categories';
import { formatPrice, parsePriceInput, priceToInput } from '../../data/money';
import type { Filling, Product } from '../../data/types';
import { useCatalog, type PendingPhoto } from '../../state/CatalogContext';
import { useRole } from '../../state/RoleContext';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/tokens';

type PhotoDraft = GalleryPhoto & {
  mimeType: string;
};

type FillingDraft = {
  key: string;
  name: string;
  price: string;
};

type FormErrors = ProductFieldErrors & {
  photo?: string;
  fillingRows?: Record<string, string>;
};

let draftCounter = 0;

function nextDraftKey(prefix: string): string {
  draftCounter += 1;
  return `${prefix}-${draftCounter}`;
}

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getProduct, loading } = useCatalog();
  const { isAdmin } = useRole();
  const { colors } = useTheme();

  const isNew = id === 'new';

  if (!isAdmin && isNew) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 20, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <Text style={{ color: colors.danger, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
          Acesso restrito ao administrador
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center' }}>
          A criação de novos produtos é restrita ao painel de administração. Ative o modo Administrador em Configurações.
        </Text>
      </View>
    );
  }

  // Wait for the cached document before mounting the form: the form's fields
  // initialise from the product, so mounting early would leave them blank.
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!isNew) {
    const product = getProduct(id);
    if (!product) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 20 }}>
          <Text style={{ color: colors.danger }}>Este produto não está mais disponível.</Text>
        </View>
      );
    }
    if (!isAdmin) {
      return <ProductViewer product={product} />;
    }
    return <ProductForm key={product.id} id={id} isNew={false} product={product} />;
  }

  return <ProductForm key="new" id={id} isNew product={undefined} />;
}

function priceHeaderLabel(category?: Category | null): string {
  if (category === 'bolos') return 'Preço por KG';
  if (category === 'salgados' || category === 'doces') return 'Preço por cento';
  return 'Preço';
}

function ProductViewer({ product }: { product: Product }) {
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const [activePhoto, setActivePhoto] = useState(0);

  const galleryPhotos: GalleryPhoto[] = useMemo(
    () =>
      product.photos.map((photo, index) => ({
        key: `viewer-photo-${photo.fileId || index}`,
        photo,
        mimeType: photo.mimeType,
      })),
    [product.photos],
  );

  const priceHeader = priceHeaderLabel(product.category);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: product.name }} />

      <PhotoGallery
        photos={galleryPhotos}
        active={activePhoto}
        onChange={setActivePhoto}
      />

      {galleryPhotos.length > 1 ? (
        <Text style={styles.photoHint}>
          Foto {Math.min(activePhoto + 1, galleryPhotos.length)} de {galleryPhotos.length}
          {Platform.OS === 'web' ? ' · use as setas do teclado' : ''}
        </Text>
      ) : null}

      <View style={styles.viewerHeader}>
        <Text style={styles.viewerTitle}>{product.name}</Text>
        <Text style={styles.viewerPrice}>{formatPrice(product.priceCents)}</Text>
      </View>

      {product.description ? (
        <View style={styles.viewerSection}>
          <Text style={styles.viewerSectionTitle}>Descrição</Text>
          <Text style={styles.viewerDescription}>{product.description}</Text>
        </View>
      ) : null}

      {product.fillings.length > 0 ? (
        <View style={styles.viewerSection}>
          <Text style={styles.viewerSectionTitle}>Opções de recheio e preços</Text>
          <View style={styles.viewerTable}>
            <View style={styles.viewerTableHeader}>
              <Text style={styles.viewerTableHeaderCell}>Sabor / Recheio</Text>
              <Text style={[styles.viewerTableHeaderCell, styles.viewerTableHeaderCellRight]}>
                {priceHeader}
              </Text>
            </View>
            {product.fillings.map((filling, idx) => {
              const isLast = idx === product.fillings.length - 1;
              return (
                <View
                  key={`${filling.name}-${idx}`}
                  style={[styles.viewerTableRow, isLast && styles.viewerTableRowLast]}
                >
                  <Text style={styles.viewerTableCell}>{filling.name}</Text>
                  <Text style={[styles.viewerTableCell, styles.viewerTableCellPrice]}>
                    {formatPrice(filling.priceCents)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function ProductForm({
  id,
  isNew,
  product,
}: {
  id: string;
  isNew: boolean;
  product?: Product;
}) {
  const { saveProduct, removeProduct } = useCatalog();
  const { colors, scheme } = useTheme();
  const styles = useStyles(colors);

  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState(product ? priceToInput(product.priceCents) : '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [category, setCategory] = useState<Category | null>(product?.category ?? null);
  const [fillings, setFillings] = useState<FillingDraft[]>(() =>
    (product?.fillings ?? []).map((filling) => ({
      key: nextDraftKey('filling'),
      name: filling.name,
      price: priceToInput(filling.priceCents),
    })),
  );
  const [fillingName, setFillingName] = useState('');
  const [fillingPrice, setFillingPrice] = useState('');
  const [photoDrafts, setPhotoDrafts] = useState<PhotoDraft[]>(() =>
    (product?.photos ?? []).map((photo) => ({
      key: nextDraftKey('photo'),
      photo,
      mimeType: photo.mimeType,
    })),
  );
  const [activePhoto, setActivePhoto] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsedPrice = parsePriceInput(price);

  function clearFieldError(field: 'name' | 'price' | 'description' | 'fillings' | 'photo') {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      return { ...current, [field]: undefined };
    });
  }

  function clearFillingRowError(key: string) {
    setFieldErrors((current) => {
      if (!current.fillingRows?.[key]) return current;
      const fillingRows = { ...current.fillingRows };
      delete fillingRows[key];
      return { ...current, fillingRows };
    });
  }

  function addFilling() {
    const filling = fillingName.trim();
    const parsed = parsePriceInput(fillingPrice);

    if (!filling) {
      setFieldErrors((current) => ({ ...current, fillings: 'Enter a filling name.' }));
      return;
    }
    if (filling.length > 80) {
      setFieldErrors((current) => ({
        ...current,
        fillings: 'Filling names must be 80 characters or fewer.',
      }));
      return;
    }
    if (parsed === null) {
      setFieldErrors((current) => ({ ...current, fillings: 'Enter a price such as 12.50' }));
      return;
    }
    if (fillings.some((entry) => entry.name.trim().toLowerCase() === filling.toLowerCase())) {
      setFieldErrors((current) => ({ ...current, fillings: 'That filling is already listed.' }));
      return;
    }

    setFillings((current) => [
      ...current,
      { key: nextDraftKey('filling'), name: filling, price: priceToInput(parsed) },
    ]);
    setFillingName('');
    setFillingPrice('');
    clearFieldError('fillings');
  }

  function updateFilling(key: string, patch: Partial<Pick<FillingDraft, 'name' | 'price'>>) {
    setFillings((current) =>
      current.map((filling) => (filling.key === key ? { ...filling, ...patch } : filling)),
    );
    clearFillingRowError(key);
    clearFieldError('fillings');
  }

  function removeFilling(key: string) {
    setFillings((current) => current.filter((filling) => filling.key !== key));
    clearFillingRowError(key);
    clearFieldError('fillings');
  }

  function applyPicked(result: ImagePicker.ImagePickerResult) {
    if (result.canceled) return;

    const added = result.assets.map((asset) => ({
      key: nextDraftKey('photo'),
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
    }));
    if (added.length === 0) return;

    setPhotoDrafts((current) => [...current, ...added]);
    setActivePhoto(photoDrafts.length);
    clearFieldError('photo');
  }

  async function pickPhoto(source: 'library' | 'camera') {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setFieldErrors((current) => ({
            ...current,
            photo: 'É necessária permissão da câmera para tirar uma foto.',
          }));
          return;
        }
        applyPicked(
          await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            allowsEditing: true,
            aspect: [1, 1],
          }),
        );
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setFieldErrors((current) => ({
          ...current,
          photo: 'É necessária permissão da galeria para escolher uma foto.',
        }));
        return;
      }
      applyPicked(
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          allowsEditing: true,
          aspect: [1, 1],
        }),
      );
    } catch (cause) {
      setFieldErrors((current) => ({
        ...current,
        photo: cause instanceof Error ? cause.message : 'Não foi possível abrir o seletor de fotos.',
      }));
    }
  }

  function removeActivePhoto() {
    if (photoDrafts.length === 0) return;
    const next = photoDrafts.filter((_, index) => index !== activePhoto);
    setPhotoDrafts(next);
    setActivePhoto(next.length === 0 ? 0 : Math.min(activePhoto, next.length - 1));
  }

  async function onSave() {
    const basePrice = parsePriceInput(price);
    const errors: FormErrors = {};

    const trimmedName = name.trim();
    if (!trimmedName) errors.name = 'Give the product a name.';
    else if (trimmedName.length > 80) errors.name = 'Name must be 80 characters or fewer.';

    if (basePrice === null) errors.price = 'Enter a price such as 12.50';
    if (description.length > 600) {
      errors.description = 'Description must be 600 characters or fewer.';
    }

    const fillingRows: Record<string, string> = {};
    const cleanFillings: Filling[] = [];
    const seenFillings = new Set<string>();

    for (const filling of fillings) {
      const fillingNameValue = filling.name.trim();
      const fillingPriceValue = parsePriceInput(filling.price);

      if (!fillingNameValue) {
        fillingRows[filling.key] = 'Enter a filling name.';
        continue;
      }
      if (fillingNameValue.length > 80) {
        fillingRows[filling.key] = 'Filling names must be 80 characters or fewer.';
        continue;
      }
      if (fillingPriceValue === null) {
        fillingRows[filling.key] = 'Enter a price such as 12.50';
        continue;
      }

      const key = fillingNameValue.toLowerCase();
      if (seenFillings.has(key)) {
        fillingRows[filling.key] = 'Filling names must be unique.';
        continue;
      }

      seenFillings.add(key);
      cleanFillings.push({ name: fillingNameValue, priceCents: fillingPriceValue });
    }

    if (Object.keys(fillingRows).length > 0) errors.fillingRows = fillingRows;
    if (!errors.fillings && !errors.fillingRows && cleanFillings.length !== fillings.length) {
      errors.fillings = 'Fix the highlighted fillings.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || basePrice === null) {
      setError(null);
      return;
    }

    const photos = photoDrafts.flatMap((photo) => (photo.photo ? [photo.photo] : []));
    const pendingPhotos: PendingPhoto[] = photoDrafts.flatMap((photo) =>
      photo.uri ? [{ uri: photo.uri, mimeType: photo.mimeType }] : [],
    );

    setBusy(true);
    setError(null);
    try {
      await saveProduct(
        {
          name: trimmedName,
          description,
          priceCents: basePrice,
          category,
          fillings: cleanFillings,
          photos,
          pendingPhotos,
        },
        isNew ? undefined : id,
      );
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the product.');
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!product) return;
    setBusy(true);
    try {
      await removeProduct(product.id);
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete the product.');
      setBusy(false);
    }
  }

  function onDelete() {
    if (!product) return;

    if (Platform.OS === 'web') {
      const confirmed =
        typeof globalThis.confirm === 'function' ? globalThis.confirm('Excluir este produto?') : true;
      if (confirmed) void doDelete();
      return;
    }

    Alert.alert('Excluir produto', 'Isso removerá o produto do catálogo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => void doDelete() },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: isNew ? 'Novo produto' : 'Editar produto' }} />

      <PhotoGallery
        photos={photoDrafts}
        active={activePhoto}
        onChange={setActivePhoto}
      />

      <View style={styles.photoActions}>
        <Pressable style={styles.secondaryButton} onPress={() => pickPhoto('library')}>
          <Text style={styles.secondaryLabel}>Escolher foto</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => pickPhoto('camera')}>
          <Text style={styles.secondaryLabel}>Tirar foto</Text>
        </Pressable>
        {photoDrafts.length > 0 ? (
          <Pressable onPress={removeActivePhoto} style={styles.removePhotoButton}>
            <Text style={styles.removePhoto}>Remover foto</Text>
          </Pressable>
        ) : null}
      </View>

      {photoDrafts.length > 1 ? (
        <Text style={styles.photoHint}>
          Foto {Math.min(activePhoto + 1, photoDrafts.length)} de {photoDrafts.length}
          {Platform.OS === 'web' ? ' · use as setas do teclado' : ''}
        </Text>
      ) : null}
      {fieldErrors.photo ? <Text style={styles.fieldError}>{fieldErrors.photo}</Text> : null}

      <Text style={styles.label}>Nome</Text>
      <TextInput
        value={name}
        onChangeText={(value) => {
          setName(value);
          clearFieldError('name');
        }}
        placeholder="Ex.: Pão artesanal"
        placeholderTextColor={colors.textMuted}
        keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
        style={[styles.input, fieldErrors.name ? styles.inputError : null]}
      />
      {fieldErrors.name ? <Text style={styles.fieldError}>{fieldErrors.name}</Text> : null}

      <Text style={styles.label}>Preço base</Text>
      <TextInput
        value={price}
        onChangeText={(value) => {
          setPrice(value);
          clearFieldError('price');
        }}
        placeholder="4,50"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
        style={[styles.input, fieldErrors.price ? styles.inputError : null]}
      />
      {fieldErrors.price ? <Text style={styles.fieldError}>{fieldErrors.price}</Text> : null}
      {parsedPrice !== null && <Text style={styles.hint}>Exibido como {formatPrice(parsedPrice)}</Text>}

      <Text style={styles.label}>Descrição</Text>
      <TextInput
        value={description}
        onChangeText={(value) => {
          setDescription(value);
          clearFieldError('description');
        }}
        placeholder="O que torna este produto especial"
        placeholderTextColor={colors.textMuted}
        multiline
        keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
        style={[styles.input, styles.multiline, fieldErrors.description ? styles.inputError : null]}
      />
      {fieldErrors.description ? (
        <Text style={styles.fieldError}>{fieldErrors.description}</Text>
      ) : null}

      <Text style={styles.label}>Categoria</Text>
      <View style={styles.categoryRow}>
        {CATEGORIES.map((option) => {
          const selected = category === option.value;
          const IconComponent =
            option.iconLibrary === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setCategory(selected ? null : option.value)}
              style={[styles.categoryChip, selected && styles.categoryChipActive]}
            >
              <IconComponent
                // @ts-expect-error dynamic icon name across icon sets
                name={option.iconName}
                size={16}
                color={selected ? colors.onPrimary : colors.primary}
                style={styles.categoryIcon}
              />
              <Text style={[styles.categoryLabel, selected && styles.categoryLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Opções de recheio</Text>
      <Text style={styles.help}>Cada sabor pode ter seu próprio preço.</Text>

      {fillings.map((filling) => {
        const rowError = fieldErrors.fillingRows?.[filling.key];
        return (
          <View key={filling.key} style={styles.fillingBlock}>
            <View style={styles.fillingRow}>
              <TextInput
                value={filling.name}
                onChangeText={(value) => updateFilling(filling.key, { name: value })}
                placeholder="Recheio / Sabor"
                placeholderTextColor={colors.textMuted}
                keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
                style={[styles.input, styles.fillingNameInput, rowError ? styles.inputError : null]}
              />
              <TextInput
                value={filling.price}
                onChangeText={(value) => updateFilling(filling.key, { price: value })}
                placeholder="0,00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
                style={[styles.input, styles.fillingPriceInput, rowError ? styles.inputError : null]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remover ${filling.name.trim() || 'recheio'}`}
                onPress={() => removeFilling(filling.key)}
                style={styles.removeFilling}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={colors.textMuted}
                  style={styles.removeFillingIcon}
                />
              </Pressable>
            </View>
            {rowError ? <Text style={styles.fieldError}>{rowError}</Text> : null}
          </View>
        );
      })}

      <View style={styles.fillingRow}>
        <TextInput
          value={fillingName}
          onChangeText={(value) => {
            setFillingName(value);
            clearFieldError('fillings');
          }}
          onSubmitEditing={addFilling}
          placeholder="Recheio / Sabor"
          placeholderTextColor={colors.textMuted}
          keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
          style={[styles.input, styles.fillingNameInput]}
          returnKeyType="done"
        />
        <TextInput
          value={fillingPrice}
          onChangeText={(value) => {
            setFillingPrice(value);
            clearFieldError('fillings');
          }}
          onSubmitEditing={addFilling}
          placeholder="0,00"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
          style={[styles.input, styles.fillingPriceInput]}
          returnKeyType="done"
        />
        <Pressable style={styles.addFillingButton} onPress={addFilling}>
          <Text style={styles.secondaryLabel}>Adicionar</Text>
        </Pressable>
      </View>
      {fieldErrors.fillings ? <Text style={styles.fieldError}>{fieldErrors.fillings}</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.primaryButton, busy && styles.disabled]} onPress={onSave} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.primaryLabel}>{isNew ? 'Adicionar ao catálogo' : 'Salvar alterações'}</Text>
        )}
      </Pressable>

      {!isNew && (
        <Pressable onPress={onDelete} disabled={busy} style={styles.deleteButton}>
          <Text style={styles.deleteLabel}>Excluir produto</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const useStyles = (colors: ThemeColors) =>
  useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { padding: 20, gap: 8, paddingBottom: 40 },
        photoActions: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          marginTop: 8,
        },
        secondaryButton: {
          backgroundColor: colors.surfaceAlt,
          borderRadius: 8,
          paddingVertical: 12,
          paddingHorizontal: 16,
          alignItems: 'center',
        },
        secondaryLabel: { color: colors.primary, fontWeight: '600' },
        removePhotoButton: { paddingHorizontal: 8, paddingVertical: 12 },
        removePhoto: { color: colors.danger, fontSize: 13 },
        photoHint: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
        label: { marginTop: 12, fontSize: 13, fontWeight: '600', color: colors.textMuted },
        help: { color: colors.textMuted, fontSize: 12 },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          color: colors.text,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 12,
        },
        inputError: { borderColor: colors.danger },
        multiline: { minHeight: 88, textAlignVertical: 'top' },
        hint: { color: colors.textMuted, fontSize: 12 },
        fieldError: { color: colors.danger, fontSize: 12 },
        fillingBlock: { gap: 4 },
        fillingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        fillingNameInput: { flex: 1 },
        fillingPriceInput: { width: 88 },
        removeFilling: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
        removeFillingIcon: { lineHeight: 20 },
        addFillingButton: {
          alignSelf: 'stretch',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 16,
          borderRadius: 8,
          backgroundColor: colors.surfaceAlt,
        },
        error: { color: colors.danger, marginTop: 8 },
        primaryButton: {
          marginTop: 20,
          backgroundColor: colors.primary,
          borderRadius: 8,
          paddingVertical: 16,
          alignItems: 'center',
        },
        primaryLabel: { color: colors.onPrimary, fontWeight: '600' },
        disabled: { opacity: 0.6 },
        deleteButton: { marginTop: 8, padding: 12, alignItems: 'center' },
        categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        categoryChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: colors.surfaceAlt,
        },
        categoryChipActive: { backgroundColor: colors.primary },
        categoryIcon: { lineHeight: 16 },
        categoryLabel: { color: colors.primary, fontWeight: '600', fontSize: 13 },
        categoryLabelActive: { color: colors.onPrimary },
        deleteLabel: { color: colors.danger, fontWeight: '600' },
        viewerHeader: {
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginTop: 12,
          gap: 12,
        },
        viewerTitle: {
          flex: 1,
          fontSize: 22,
          fontWeight: '700',
          color: colors.text,
        },
        viewerPrice: {
          fontSize: 20,
          fontWeight: '700',
          color: colors.primary,
        },
        viewerSection: {
          marginTop: 12,
          gap: 6,
        },
        viewerSectionTitle: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        viewerDescription: {
          fontSize: 15,
          color: colors.text,
          lineHeight: 22,
        },
        viewerTable: {
          backgroundColor: colors.surface,
          borderRadius: 8,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          overflow: 'hidden',
        },
        viewerTableHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: colors.surfaceAlt,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        viewerTableHeaderCell: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        viewerTableHeaderCellRight: {
          textAlign: 'right',
        },
        viewerTableRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        viewerTableRowLast: {
          borderBottomWidth: 0,
        },
        viewerTableCell: {
          fontSize: 14,
          color: colors.text,
          fontWeight: '500',
        },
        viewerTableCellPrice: {
          fontWeight: '700',
          color: colors.primary,
          textAlign: 'right',
        },
      }),
    [colors],
  );
