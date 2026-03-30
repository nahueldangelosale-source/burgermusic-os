import type { z } from "zod";
import type { DetectedItemSchema } from "./schema";

export type DetectedItem = z.infer<typeof DetectedItemSchema>;
