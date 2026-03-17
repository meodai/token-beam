import { z } from 'zod';

export const TokenTypeSchema = z.enum(['color', 'number', 'string', 'boolean']);

export const DesignTokenSchema = z.object({
  name: z.string().max(256),
  type: TokenTypeSchema,
  value: z.union([z.string().max(10_000), z.number(), z.boolean()]),
});

export const TokenModeSchema = z.object({
  name: z.string().max(256),
  tokens: z.array(DesignTokenSchema).max(10_000),
});

export const TokenCollectionSchema = z.object({
  name: z.string().max(256),
  modes: z.array(TokenModeSchema).max(100),
});

export const TokenSyncPayloadSchema = z.object({
  collections: z.array(TokenCollectionSchema).max(500),
});

export function validateTokenPayload(payload: unknown) {
  return TokenSyncPayloadSchema.safeParse(payload);
}
