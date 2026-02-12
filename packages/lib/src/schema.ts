import { z } from 'zod';

export const TokenTypeSchema = z.enum(['color', 'number', 'string', 'boolean']);

export const DesignTokenSchema = z.object({
  name: z.string(),
  type: TokenTypeSchema,
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const TokenModeSchema = z.object({
  name: z.string(),
  tokens: z.array(DesignTokenSchema),
});

export const TokenCollectionSchema = z.object({
  name: z.string(),
  modes: z.array(TokenModeSchema),
});

export const TokenSyncPayloadSchema = z.object({
  collections: z.array(TokenCollectionSchema),
});

export function validateTokenPayload(payload: unknown) {
  return TokenSyncPayloadSchema.safeParse(payload);
}
