import { z } from "zod";
import { DetectedItemSchema } from "./schema";

export type DetectedItem = z.infer<typeof DetectedItemSchema>;
