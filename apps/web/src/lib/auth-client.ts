'use client';
import { createAuthClient } from 'better-auth/react';
import { apiOrigin } from './api';

export const authClient = createAuthClient({
  baseURL: `${apiOrigin()}/api/auth`,
  fetchOptions: { credentials: 'include' },
});
export const { useSession, signIn, signUp, signOut } = authClient;
