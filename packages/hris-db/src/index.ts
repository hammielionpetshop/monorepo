import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

export * from './schema/index';

export interface CreateHrisDbOptions {
  max?: number;
  idleTimeout?: number;
  connectTimeout?: number;
  maxLifetime?: number;
  prepare?: boolean;
}

// Pilihan bawaan sama dengan createDb di @petshop/db; alasannya dijelaskan di sana.
export function createHrisDb(connectionString: string, options: CreateHrisDbOptions = {}) {
  let url = connectionString;
  if (!url.includes('timezone=')) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}options=-c%20timezone=UTC`;
  }
  const client = postgres(url, {
    max: options.max ?? 3,
    idle_timeout: options.idleTimeout ?? 20,
    connect_timeout: options.connectTimeout ?? 10,
    max_lifetime: options.maxLifetime ?? 60 * 10,
    prepare: options.prepare ?? false,
  });
  return drizzle(client, { schema });
}

export type HrisDb = ReturnType<typeof createHrisDb>;
