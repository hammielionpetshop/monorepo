import { cache } from 'react';
import { verifyAccessToken } from './auth';

export const verifyAccessTokenCached = cache(async (token: string) => {
  return verifyAccessToken(token);
});
