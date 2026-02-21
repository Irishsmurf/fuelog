import { z } from 'zod';

export const FuelLogSchema = z.object({
  timestamp: z.any().transform((val) => /* logic to handle Firestore Timestamp */ val),
  brand: z.string().min(1).default('Unknown'),
  cost: z.number().positive(),
  distanceKm: z.number().positive(),
  fuelAmountLiters: z.number().positive(),
  userId: z.string(),
  // For modern LLM integration, we expect these from the AI
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type FuelLog = z.infer<typeof FuelLogSchema>;