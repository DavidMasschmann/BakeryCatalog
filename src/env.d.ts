/// <reference types="expo/types" />

// Metro resolves image imports to a module id; TypeScript needs to be told.
declare module '*.png' {
  const source: number;
  export default source;
}

declare namespace NodeJS {
  interface ProcessEnv {
    /** Google OAuth client id used by the Drive sync. Public, never a secret. */
    EXPO_PUBLIC_GOOGLE_CLIENT_ID?: string;
  }
}
