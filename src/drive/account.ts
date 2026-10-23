export type GoogleAccount = {
  email: string | null;
  name: string | null;
  picture: string | null;
};

/**
 * Identifies the signed-in user for the Settings screen.
 * Needs the `email`/`profile` scopes; returns nulls rather than failing if the
 * token cannot read the profile (sync still works without it).
 */
export async function fetchAccount(accessToken: string): Promise<GoogleAccount> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return { email: null, name: null, picture: null };

    const payload = (await response.json()) as {
      email?: string;
      name?: string;
      picture?: string;
    };

    return {
      email: payload.email ?? null,
      name: payload.name ?? null,
      picture: payload.picture ?? null,
    };
  } catch {
    return { email: null, name: null, picture: null };
  }
}
