import z from 'zod';

export const GetCreatorProfileSchema = z.object({
  userId: z.string(),
});

// Step 1: Personal Information (no email - managed by Google OAuth)
export const UpdatePersonalInfoSchema = z.object({
  userId: z.string(),
  name: z.string().min(1, 'Full name is required'),
  displayName: z.string().min(1, 'Display name is required'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
});

// Step 2: Professional Information
export const UpdateProfessionalInfoSchema = z.object({
  userId: z.string(),
  photographyType: z.enum(['Marathon', 'Wildlife', 'Motorsports']),
  location: z.string().min(1, 'Location is required'),
});

// Step 3: Banking Information
export const UpdateBankingInfoSchema = z.object({
  userId: z.string(),
  bankName: z.string().min(1, 'Bank name is required'),
  accountNumber: z.string().min(1, 'Account number is required'),
  holderName: z.string().min(1, 'Account holder name is required'),
});

// Get Photographers (for top photographers page)
export const GetPhotographersSchema = z.object({
  photographyType: z
    .enum(['Marathon', 'Wildlife', 'Motorsports'])
    .optional()
    .nullable(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(9),
});

// Get Photographer Public Profile
export const GetPhotographerProfileSchema = z.object({
  id: z.string(),
  eventId: z.string().optional().nullable(),
});

export type GetCreatorProfileDto = z.infer<typeof GetCreatorProfileSchema>;
export type UpdatePersonalInfoDto = z.infer<typeof UpdatePersonalInfoSchema>;
export type UpdateProfessionalInfoDto = z.infer<
  typeof UpdateProfessionalInfoSchema
>;
export type UpdateBankingInfoDto = z.infer<typeof UpdateBankingInfoSchema>;
export type GetPhotographersDto = z.infer<typeof GetPhotographersSchema>;
export type GetPhotographerProfileDto = z.infer<
  typeof GetPhotographerProfileSchema
>;
