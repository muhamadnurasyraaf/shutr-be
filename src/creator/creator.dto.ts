import z from 'zod';

export const GetCreatorProfileSchema = z.object({
  userId: z.string(),
});

export type GetCreatorProfileDto = z.infer<typeof GetCreatorProfileSchema>;
