import { SessionOptions } from 'iron-session';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'sales';
};

export type SessionData = {
  user?: SessionUser;
};

const password =
  process.env.SESSION_PASSWORD ||
  'this_is_a_dev_only_secret_with_minimum_32_chars_length!';

export const sessionOptions: SessionOptions = {
  cookieName: 'crm_session',
  password,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    httpOnly: true,
    path: '/',
  },
};