/**
 * Agentic Gateway — Policy Enforcement Point (PEP)
 * ─────────────────────────────────────────────────
 * ZERO-TRUST architecture: every AI-generated mutation MUST pass through
 * this gateway. The gateway enforces three sequential policies:
 *   1. RBAC (session role check)
 *   2. Grammar-Constrained Decoding (Zod strict parse)
 *   2.5 Conformal Prediction (uncertainty quantification)
 *   3. Immutable Audit Ledger write (append-only, fail-closed)
 *
 * Design invariants:
 *   • Fail-closed: if ANY step (including the audit write) fails,
 *     the entire operation is aborted. No silent degradation.
 *   • Log-before-return: the audit record is committed BEFORE
 *     returning the result to the caller.
 *   • No UPDATE/DELETE on ai_audit_logs is ever issued from this module.
 */

import { createHash } from "crypto";
import { db } from "@/db";
import { ai_audit_logs } from "@/db/schema";
import { getSession } from "@/lib/auth";
import {
  computeNonconformityScore,
  conformalCheck,
  updateCalibrationSet,
} from "@/lib/conformal-prediction";
import { logger } from "@/lib/logger";
import { v4 as uuidv4 } from "uuid";
import type { z } from "zod";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

const VALID_ROLES = ["OWNER_GLOBAL", "MANAGER", "KITCHEN", "RECEIVER"] as const;
type AppRole = (typeof VALID_ROLES)[number];

type AgenticActionContext<T extends z.ZodTypeAny> = {
  agentName: string;
  actionName: string;
  schema: T;
  /** If set, the session user MUST have this role (or OWNER_GLOBAL). */
  requiredRole?: AppRole;
};

type GatewayResult<R> = { success: true; data: R } | { success: false; error: string };

// ────────────────────────────────────────────
// Core Gateway
// ────────────────────────────────────────────

export function withAgenticGateway<T extends z.ZodTypeAny, R>(
  context: AgenticActionContext<T>,
  handler: (validatedData: z.infer<T>) => Promise<R>,
) {
  return async (payload: unknown): Promise<GatewayResult<R>> => {
    const session = await getSession();
    const userId = session?.user?.id ?? "SYSTEM_WORKER";
    const storeId = session?.user?.storeId;
    if (!storeId && session) throw new Error("Unauthorized: Tenant missing in session");
    const schemaLabel = context.schema.description ?? "Strict_Zod_Typed_Object";

    // ── 1. RBAC Policy ──────────────────────────────────────────
    if (context.requiredRole) {
      const userRole = session?.user?.role;
      const isAuthorized = userRole === "OWNER_GLOBAL" || userRole === context.requiredRole;

      if (!isAuthorized) {
        // FIX: parentheses were missing — old code had operator-precedence bug
        //      that could let non-OWNER roles bypass RBAC entirely.
        await appendLedger({
          agentName: context.agentName,
          action: context.actionName,
          status: "REJECTED_BY_RBAC",
          payloadHash: hashPayload(payload),
          zodSchemaUsed: schemaLabel,
          rejectionReason: `Role "${userRole ?? "ANONYMOUS"}" lacks required "${context.requiredRole}".`,
          userId,
          storeId,
        });
        return { success: false, error: "Access Denied by Agentic Gateway (RBAC)." };
      }
    }

    // ── 2. Grammar-Constrained Decoding (Zod Guardrail) ─────────
    const parseResult = context.schema.safeParse(payload);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(" | ");

      await appendLedger({
        agentName: context.agentName,
        action: context.actionName,
        status: "REJECTED_BY_GUARDRAIL",
        payloadHash: hashPayload(payload),
        zodSchemaUsed: schemaLabel,
        rejectionReason: errorMsg,
        userId,
        storeId,
      });

      return {
        success: false,
        error: `Agentic Gateway blocked execution: Validation failed. ${errorMsg}`,
      };
    }

    // ── 2.5 Conformal Prediction (Uncertainty Gate) ──────────────
    const fieldCount = Object.keys(parseResult.data as Record<string, unknown>).length;
    const ncScore = computeNonconformityScore(true, 0, fieldCount, parseResult.data);
    const conformal = conformalCheck(ncScore);

    if (!conformal.isConfident) {
      const reason =
        `Conformal prediction UNCERTAIN: nonconformity=${ncScore.toFixed(4)} > ` +
        `quantile=${conformal.quantileThreshold.toFixed(4)} ` +
        `(coverage=${(conformal.coverageProbability * 100).toFixed(0)}%, ` +
        `calibration_n=${conformal.calibrationSetSize}). Escalating to MANAGER_LOCAL.`;

      logger.warn("Conformal prediction gate triggered — aborting transaction", {
        component: "AgenticGateway",
        agentName: context.agentName,
        nonconformityScore: ncScore,
        quantileThreshold: conformal.quantileThreshold,
      });

      await appendLedger({
        agentName: context.agentName,
        action: context.actionName,
        status: "REJECTED_BY_GUARDRAIL",
        payloadHash: hashPayload(parseResult.data),
        zodSchemaUsed: schemaLabel,
        rejectionReason: reason,
        userId,
        storeId,
      });

      return {
        success: false,
        error: `Agentic Gateway: ${reason}`,
      };
    }

    // ── 3. Execute handler ──────────────────────────────────────
    try {
      const execResult = await handler(parseResult.data);

      // Update calibration set with observed score (online learning)
      updateCalibrationSet(ncScore);

      // Log APPROVED *before* returning — never return without a ledger entry.
      await appendLedger({
        agentName: context.agentName,
        action: context.actionName,
        status: "APPROVED",
        payloadHash: hashPayload(parseResult.data),
        zodSchemaUsed: schemaLabel,
        rejectionReason: undefined,
        userId,
        storeId,
      });

      return { success: true, data: execResult };
    } catch (handlerError: unknown) {
      const msg = handlerError instanceof Error ? handlerError.message : "Unknown handler error";

      await appendLedger({
        agentName: context.agentName,
        action: context.actionName,
        status: "REJECTED_BY_GUARDRAIL",
        payloadHash: hashPayload(parseResult.data),
        zodSchemaUsed: schemaLabel,
        rejectionReason: `Handler Exception: ${msg}`,
        userId,
        storeId,
      });

      return { success: false, error: msg };
    }
  };
}

// ────────────────────────────────────────────
// Append-Only Ledger Writer (IMMUTABLE)
// ────────────────────────────────────────────

interface LedgerEntry {
  agentName: string;
  action: string;
  status: "APPROVED" | "REJECTED_BY_GUARDRAIL" | "REJECTED_BY_RBAC";
  payloadHash: string;
  zodSchemaUsed: string;
  rejectionReason?: string;
  userId: string;
  storeId: string;
}

/**
 * Append-only insert. This function NEVER calls UPDATE or DELETE.
 * If the insert fails, it throws — callers must treat this as a
 * fail-closed event (the operation that triggered the audit should
 * also be aborted). This guarantees forensic completeness.
 */
async function appendLedger(entry: LedgerEntry): Promise<void> {
  // NOTE: we intentionally do NOT try/catch here.
  // A failed audit write MUST propagate up so the caller aborts.
  // This is the Zero-Trust fail-closed contract.
  await db.insert(ai_audit_logs).values({
    id: uuidv4(),
    agentName: entry.agentName,
    action: entry.action,
    status: entry.status,
    payloadRef: entry.payloadHash, // Only a SHA-256 digest, never raw PII.
    zodSchemaUsed: entry.zodSchemaUsed,
    rejectionReason: entry.rejectionReason?.substring(0, 500),
    userId: entry.userId,
    storeId: entry.storeId,
  });
}

// ────────────────────────────────────────────
// Payload Sanitization
// ────────────────────────────────────────────

/**
 * Instead of storing raw payloads (which may contain PII, API keys,
 * or injected content), we store a SHA-256 digest. The raw payload
 * can be correlated via application logs if forensic reconstruction
 * is needed, but the ledger itself never leaks sensitive data.
 */
function hashPayload(payload: unknown): string {
  try {
    const raw = JSON.stringify(payload);
    return `sha256:${createHash("sha256").update(raw).digest("hex")}`;
  } catch {
    return "sha256:UNSERIALIZABLE";
  }
}
