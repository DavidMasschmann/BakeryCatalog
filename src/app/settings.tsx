import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DB_FILE_NAME } from '../drive/config';
import { findDatabaseFile } from '../drive/client';
import { describeDriveError } from '../drive/errors';
import { useAuth } from '../state/AuthContext';
import { useCatalog } from '../state/CatalogContext';
import { useRole, type UserRole } from '../state/RoleContext';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors, ThemeMode } from '../theme/tokens';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  {
    value: 'viewer',
    label: 'Visualizador padrão',
    description: 'Acesso somente leitura. Navegue e busque produtos no catálogo sem permissões de edição.',
  },
  {
    value: 'admin',
    label: 'Painel do administrador',
    description: 'Acesso completo. Adicionar, editar, gerenciar fotos, alterar preços e excluir produtos.',
  },
];

export default function SettingsScreen() {
  const { configured, accessToken, email, error, ready, redirectUri, signIn, signOut } = useAuth();
  const { products, message, syncing, sync } = useCatalog();
  const { role, setRole } = useRole();
  const { colors, mode, setMode } = useTheme();
  const styles = useStyles(colors);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function testConnection() {
    if (!accessToken) return;

    setTesting(true);
    setTestResult(null);
    try {
      const file = await findDatabaseFile(accessToken);
      setTestResult({
        ok: true,
        text: file
          ? `Conectado ao Drive com sucesso. O arquivo ${DB_FILE_NAME} existe na pasta do aplicativo.`
          : `Conectado ao Drive com sucesso. O arquivo ${DB_FILE_NAME} será criado na primeira sincronização.`,
      });
    } catch (cause) {
      setTestResult({ ok: false, text: describeDriveError(cause) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Google Drive</Text>

        {!configured ? (
          <>
            <Text style={styles.body}>
              ID de cliente OAuth não configurado. Para habilitar a conexão:
            </Text>
            <Text style={styles.step}>1. No Google Cloud Console, ative a Google Drive API.</Text>
            <Text style={styles.step}>2. Crie um cliente OAuth do tipo “Aplicativo da Web”.</Text>
            <Text style={styles.step}>3. Adicione este URI de redirecionamento autorizado:</Text>
            <Text selectable style={styles.code}>
              {redirectUri}
            </Text>
            <Text style={styles.step}>
              4. Insira o client ID no arquivo .env como EXPO_PUBLIC_GOOGLE_CLIENT_ID e reinicie com
              `npx expo start --clear`.
            </Text>
            <Text style={styles.hint}>
              O client secret nunca é necessário. Instruções completas em README.md.
            </Text>
          </>
        ) : accessToken ? (
          <>
            <Text style={styles.body}>
              Conectado{email ? ` como ${email}` : ''}. O catálogo e as fotos são sincronizados na pasta oculta do aplicativo no Google Drive.
            </Text>

            <View style={styles.buttonRow}>
              <Pressable
                onPress={testConnection}
                disabled={testing}
                style={[styles.button, styles.secondary, testing && styles.disabled]}
              >
                {testing ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.secondaryLabel}>Testar conexão</Text>
                )}
              </Pressable>
              <Pressable onPress={signOut} style={[styles.button, styles.danger]}>
                <Text style={styles.dangerLabel}>Desconectar</Text>
              </Pressable>
            </View>

            {testResult ? (
              <Text style={[styles.result, { color: testResult.ok ? colors.primary : colors.danger }]}>
                {testResult.text}
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.body}>
              Não conectado. Apenas os arquivos criados por este aplicativo ficam acessíveis.
              Fotos exigem conexão para sincronização com o Google Drive.
            </Text>
            <Pressable
              onPress={signIn}
              disabled={!ready}
              style={[styles.button, styles.primary, !ready && styles.disabled]}
            >
              <Text style={styles.primaryLabel}>Conectar Google Drive</Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.hint}>URI de redirecionamento: {redirectUri}</Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Catálogo</Text>
        <Text style={styles.body}>
          {products.length} {products.length === 1 ? 'produto salvo' : 'produtos salvos'} neste dispositivo.
        </Text>
        <Text style={styles.hint}>{message}</Text>
        <Pressable
          onPress={sync}
          disabled={syncing}
          style={[styles.button, styles.primary, syncing && styles.disabled]}
        >
          <Text style={styles.primaryLabel}>{syncing ? 'Sincronizando...' : 'Sincronizar agora'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Modo de acesso</Text>
        <Text style={styles.body}>
          Alterne entre visualização padrão e o painel de administração com recursos de edição.
        </Text>
        <View style={styles.roleOptions}>
          {ROLE_OPTIONS.map((option) => {
            const selected = role === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setRole(option.value)}
                style={[styles.roleCard, selected && styles.roleCardActive]}
              >
                <View style={styles.roleHeader}>
                  <Text style={[styles.roleTitle, selected && styles.roleTitleActive]}>
                    {option.label}
                  </Text>
                  <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
                    {selected ? <View style={styles.radioInner} /> : null}
                  </View>
                </View>
                <Text style={styles.roleDescription}>{option.description}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Aparência</Text>
        <View style={styles.segment}>
          {THEME_OPTIONS.map((option) => {
            const selected = mode === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setMode(option.value)}
                style={[styles.segmentItem, selected && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentLabel, selected && styles.segmentLabelActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const useStyles = (colors: ThemeColors) =>
  useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { padding: 16, gap: 12 },
        card: {
          backgroundColor: colors.surface,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: 16,
          gap: 12,
        },
        cardTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
        body: { color: colors.text, lineHeight: 20 },
        hint: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
        step: { color: colors.text, lineHeight: 20, fontSize: 13 },
        code: {
          color: colors.chipText,
          backgroundColor: colors.chipBackground,
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 8,
          fontSize: 12,
        },
        error: { color: colors.danger, lineHeight: 18 },
        result: { lineHeight: 18, fontSize: 13 },
        buttonRow: { flexDirection: 'row', gap: 8 },
        button: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
        primary: { backgroundColor: colors.primary },
        primaryLabel: { color: colors.onPrimary, fontWeight: '600' },
        secondary: { backgroundColor: colors.surfaceAlt, flex: 1 },
        secondaryLabel: { color: colors.primary, fontWeight: '600' },
        danger: { backgroundColor: colors.surfaceAlt },
        dangerLabel: { color: colors.danger, fontWeight: '600' },
        disabled: { opacity: 0.5 },
        segment: {
          flexDirection: 'row',
          backgroundColor: colors.surfaceAlt,
          borderRadius: 8,
          padding: 4,
          gap: 4,
        },
        segmentItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
        segmentItemActive: { backgroundColor: colors.surface },
        segmentLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
        segmentLabelActive: { color: colors.text, fontWeight: '600' },
        roleOptions: { gap: 8 },
        roleCard: {
          padding: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceAlt,
          gap: 4,
        },
        roleCardActive: {
          borderColor: colors.primary,
          backgroundColor: colors.surface,
        },
        roleHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        roleTitle: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.text,
        },
        roleTitleActive: {
          color: colors.primary,
        },
        roleDescription: {
          fontSize: 12,
          color: colors.textMuted,
          lineHeight: 16,
        },
        radioOuter: {
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 2,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        radioOuterActive: {
          borderColor: colors.primary,
        },
        radioInner: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.primary,
        },
      }),
    [colors],
  );
