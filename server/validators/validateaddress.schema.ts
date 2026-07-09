import { z } from "zod";

export const validateAddressSchema = z.object({
  address: z.string().optional(),
  coordinates: z.object({
    lat: z.union([z.number(), z.string()]).optional(),
    lng: z.union([z.number(), z.string()]).optional(),
    latitude: z.union([z.number(), z.string()]).optional(),
    longitude: z.union([z.number(), z.string()]).optional(),
  }).optional(),
  fields: z.object({
    city: z.string().optional(),
    pincode: z.string().optional(),
  }).optional(),
});

export const notifyRequestSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  city: z.string().optional(),
  coords: z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
  }).optional().nullable(),
});
