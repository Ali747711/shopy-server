import { z } from "zod";

export const addressInputSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(5).max(20),
  address1: z.string().trim().min(3).max(200),
  address2: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : undefined)),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(2).max(20),
  country: z.string().trim().min(1).max(100),
  label: z.string().trim().max(40).optional(),
  isDefault: z.boolean().optional(),
});

/** All fields optional for PATCH; "at least one present" is enforced in the service. */
export const addressUpdateSchema = addressInputSchema.partial();

export type AddressInputDto = z.infer<typeof addressInputSchema>;
