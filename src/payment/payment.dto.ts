import z from 'zod';

export const CreateBillSchema = z.object({
  category: z.enum(['subscription', 'purchase']).optional().default('purchase'),
});
