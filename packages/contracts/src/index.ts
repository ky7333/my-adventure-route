import { z } from 'zod';

export const vehicleTypeSchema = z.enum(['motorcycle', 'adv_motorcycle', '4x4']);
export type VehicleType = z.infer<typeof vehicleTypeSchema>;

export const locationInputSchema = z.object({
  label: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});
export type LocationInput = z.infer<typeof locationInputSchema>;

export const routePreferencesSchema = z.object({
  curvy: z.number().min(0).max(100),
  scenic: z.number().min(0).max(100),
  avoidHighways: z.number().min(0).max(100),
  unpavedPreference: z.number().min(0).max(100),
  difficulty: z.number().min(0).max(100),
  distanceInfluence: z.number().min(15).max(100).default(18)
});
export type RoutePreferences = z.infer<typeof routePreferencesSchema>;

export const planRouteRequestSchema = z
  .object({
    start: locationInputSchema,
    end: locationInputSchema.optional(),
    loopRide: z.boolean().default(false),
    vehicleType: vehicleTypeSchema,
    preferences: routePreferencesSchema
  })
  .superRefine((data, ctx) => {
    if (!data.loopRide && !data.end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'end is required when loopRide is false',
        path: ['end']
      });
    }

    if (data.loopRide && data.end !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'end must be omitted when loopRide is true',
        path: ['end']
      });
    }
  });
export type PlanRouteRequest = z.infer<typeof planRouteRequestSchema>;

export const scoreBreakdownSchema = z.object({
  curvature: z.number(),
  roadClass: z.number(),
  surface: z.number(),
  difficulty: z.number(),
  total: z.number()
});
export type RouteScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;

export const surfaceMixSchema = z.object({
  pavedPercent: z.number().min(0).max(100),
  gravelPercent: z.number().min(0).max(100),
  dirtPercent: z.number().min(0).max(100),
  unknownPercent: z.number().min(0).max(100)
}).superRefine((surfaceMix, ctx) => {
  const total =
    surfaceMix.pavedPercent +
    surfaceMix.gravelPercent +
    surfaceMix.dirtPercent +
    surfaceMix.unknownPercent;

  if (Math.abs(total - 100) > 1e-6) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'surfaceMix percentages must sum to 100',
      path: ['unknownPercent']
    });
  }
});
export type SurfaceMix = z.infer<typeof surfaceMixSchema>;

export const routeSurfaceTypeSchema = z.enum(['paved', 'gravel', 'dirt', 'unknown']);
export type RouteSurfaceType = z.infer<typeof routeSurfaceTypeSchema>;

export const routeSurfaceSectionSchema = z.object({
  startCoordinateIndex: z.number().int().min(0),
  endCoordinateIndex: z.number().int().min(1),
  surface: routeSurfaceTypeSchema
}).superRefine((section, ctx) => {
  if (section.startCoordinateIndex >= section.endCoordinateIndex) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'startCoordinateIndex must be strictly less than endCoordinateIndex',
      path: ['startCoordinateIndex']
    });
  }
});
export type RouteSurfaceSection = z.infer<typeof routeSurfaceSectionSchema>;
export const routeSurfaceSectionsSchema = z.array(routeSurfaceSectionSchema);

export const routeAlternativeSchema = z.object({
  id: z.string(),
  rank: z.number().int().min(1),
  label: z.string(),
  distanceKm: z.number().nonnegative(),
  durationMin: z.number().nonnegative(),
  twistinessScore: z.number().min(0).max(100),
  difficultyScore: z.number().min(0).max(100),
  surfaceMix: surfaceMixSchema,
  score: scoreBreakdownSchema,
  geometry: z.object({
    type: z.literal('LineString'),
    coordinates: z.array(z.tuple([z.number(), z.number()])).min(2)
  }),
  surfaceSections: z.array(routeSurfaceSectionSchema).optional()
});
export type RouteAlternative = z.infer<typeof routeAlternativeSchema>;

export const planRouteResponseSchema = z.object({
  routeRequestId: z.string(),
  generatedAt: z.string().datetime(),
  options: z.array(routeAlternativeSchema).min(1).max(3)
});
export type PlanRouteResponse = z.infer<typeof planRouteResponseSchema>;

export const geocodeSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(10).default(5)
});
export type GeocodeSearchQuery = z.infer<typeof geocodeSearchQuerySchema>;

export const geocodeHitSchema = z.object({
  label: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});
export type GeocodeHit = z.infer<typeof geocodeHitSchema>;

export const geocodeSearchResponseSchema = z.object({
  hits: z.array(geocodeHitSchema).max(10)
});
export type GeocodeSearchResponse = z.infer<typeof geocodeSearchResponseSchema>;

export const authRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
export type AuthRegisterRequest = z.infer<typeof authRegisterSchema>;

export const authLoginSchema = authRegisterSchema;
export type AuthLoginRequest = z.infer<typeof authLoginSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email()
  })
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const routeDetailResponseSchema = z.object({
  routeRequestId: z.string(),
  userId: z.string(),
  start: locationInputSchema,
  end: locationInputSchema.nullable(),
  loopRide: z.boolean(),
  vehicleType: vehicleTypeSchema,
  preferences: routePreferencesSchema,
  options: z.array(routeAlternativeSchema)
});
export type RouteDetailResponse = z.infer<typeof routeDetailResponseSchema>;
