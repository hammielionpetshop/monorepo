import { NextResponse } from 'next/server';

type LoginUser = {
  id: number;
  name: string;
  role: string;
  branch: string;
};

const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 24;
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

export function createLoginResponse(user: LoginUser, accessToken: string, refreshToken: string) {
  const response = NextResponse.json({ user });

  response.cookies.set('accessToken', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  response.cookies.set('refreshToken', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });

  return response;
}
