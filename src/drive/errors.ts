import { DriveError } from './client';

/**
 * Turns Google's error payloads into something a shop owner can act on.
 * The raw bodies are extremely terse ("Login Required", "accessNotConfigured").
 */
export function describeDriveError(error: unknown): string {
  if (error instanceof DriveError) {
    const detail = error.message;

    if (error.status === 401) {
      return 'Sessão do Google expirada. Toque em Reconectar em Configurações.';
    }
    if (error.status === 403) {
      if (/accessNotConfigured|has not been used in project|is disabled/i.test(detail)) {
        return 'A Google Drive API não está ativada para este projeto. Ative-a no Google Cloud Console.';
      }
      if (/Login Required|insufficient|scope/i.test(detail)) {
        return 'Esta sessão não tem acesso ao Google Drive. Reconecte em Configurações e conceda acesso.';
      }
      return `O Google Drive recusou a requisição. ${detail}`;
    }
    if (error.status === 404) return 'O arquivo do Google Drive não existe mais.';
    if (error.status === 412) return 'Outro dispositivo alterou o arquivo. Tente sincronizar novamente.';
    if (error.status === 429) return 'Muitas requisições ao Google. Aguarde um momento e tente novamente.';
    if (error.status >= 500) return 'O Google Drive está instável no momento. Tente novamente em breve.';

    return detail;
  }

  if (error instanceof Error) {
    if (/Network request failed|Failed to fetch|NetworkError/i.test(error.message)) {
      return 'Não foi possível alcançar o Google Drive. Verifique sua conexão com a internet.';
    }
    return error.message;
  }

  return 'Ocorreu um erro inesperado.';
}

/** Maps OAuth `error` codes from the consent screen to a fix. */
export function describeAuthError(code: string | undefined, redirectUri: string): string {
  switch (code) {
    case 'access_denied':
      return 'Acesso negado. O catálogo precisa de acesso ao Google Drive para sincronizar.';
    case 'redirect_uri_mismatch':
      return `Incompatibilidade de URI de redirecionamento. Adicione ${redirectUri} aos URIs autorizados do cliente OAuth.`;
    case 'invalid_request':
      return 'O Google rejeitou a requisição. Verifique se o cliente OAuth é do tipo "Aplicativo da Web" e se o URI está registrado.';
    case 'admin_policy_enforced':
      return 'O administrador do Google Workspace bloqueou o acesso deste aplicativo ao Google Drive.';
    case 'org_internal':
      return 'Este cliente OAuth é restrito a uma única organização.';
    case 'disallowed_useragent':
      return 'O Google bloqueia login em navegadores embutidos. Abra o aplicativo em uma aba normal do navegador.';
    case 'deleted_client':
      return 'Este cliente OAuth foi excluído. Crie um novo no Google Cloud Console.';
    case 'invalid_grant':
      return 'O código de autorização expirou ou já foi usado. Tente conectar novamente.';
    case 'unsupported_grant_type':
    case 'invalid_scope':
      return `O Google rejeitou os escopos solicitados (${code}). Verifique os escopos na tela de consentimento OAuth.`;
    default:
      return code ? `Falha ao fazer login: ${code}` : 'O login não foi concluído. Tente novamente.';
  }
}
