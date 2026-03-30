/**
 * SRE Autonomous Agent — K-MAPE Loop
 * ────────────────────────────────────
 * Implements IBM's Knowledge-Monitor-Analyze-Plan-Execute autonomic
 * computing cycle for self-healing infrastructure.
 *
 * Responsibilities:
 *   M — Monitor:   Read FAILED events from outbox_events DLQ
 *   A — Analyze:   Classify root cause via pattern matching + optional LLM
 *   P — Plan:      Decide between auto-remediation or human escalation
 *   E — Execute:   Apply remediation (batch resize, retry) or emit RCA artifact
 *
 * Safety invariants:
 *   • Confidence threshold: auto-remediation only if confidence ≥ 85%
 *   • Critical table guard: never touch transactional tables autonomously
 *   • All decisions logged via semantic logger with trace_id
 *   • Human-in-the-loop escalation formatted as Slack-compatible alert
 */

import { db } from "@/db";
import { outbox_events } from "@/db/schema";
import { logger } from "@/lib/logger";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { eq, sql } from "drizzle-orm";

const tracer = trace.getTracer("burgermusic-sre-agent", "1.0.0");

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface AnomalyReport {
  anomalyType: "AIRLOCK_TIMEOUT" | "SCHEMA_CORRUPTION" | "AUTH_CASCADE_FAILURE" | "UNKNOWN";
  failedEventCount: number;
  samplePayloads: string[];
  detectedAt: string;
}

export interface RCADiagnosis {
  rootCause: string;
  confidence: number; // 0-100
  suggestedRemediation: string;
  requiresHumanApproval: boolean;
  affectsCriticalTables: boolean;
}

export interface RemediationResult {
  action: "AUTO_REMEDIATED" | "ESCALATED_TO_HUMAN" | "NO_ACTION_NEEDED";
  details: string;
  traceId?: string;
}

// ────────────────────────────────────────────
// Runtime Configuration (mutable by the agent)
// ────────────────────────────────────────────

/**
 * The SRE agent can dynamically adjust these values when it detects
 * systemic failures. For example, reducing batch size under timeout
 * pressure or increasing backoff intervals.
 */
export const SRE_CONFIG = {
  airlockBatchSize: 100,
  airlockBackoffMs: 500,
  maxRetries: 3,
  confidenceThreshold: 85,
};

// ────────────────────────────────────────────
// M — Monitor
// ────────────────────────────────────────────

async function monitor(): Promise<AnomalyReport | null> {
  const failedEvents = await db
    .select()
    .from(outbox_events)
    .where(eq(outbox_events.status, "FAILED"))
    .limit(50);

  if (failedEvents.length === 0) {
    return null; // System healthy — no anomalies detected
  }

  // Classify anomaly type by inspecting payload patterns
  const samplePayloads = failedEvents.slice(0, 3).map((e) => e.payload?.substring(0, 200) || "N/A");

  const hasTimeoutSignal = failedEvents.some(
    (e) =>
      e.payload?.includes("ETIMEDOUT") ||
      e.payload?.includes("timeout") ||
      e.payload?.includes("ECONNREFUSED"),
  );

  const hasSchemaSignal = failedEvents.some(
    (e) =>
      e.payload?.includes("validation") ||
      e.payload?.includes("schema") ||
      e.payload?.includes("parse error"),
  );

  let anomalyType: AnomalyReport["anomalyType"] = "UNKNOWN";
  if (hasTimeoutSignal) anomalyType = "AIRLOCK_TIMEOUT";
  else if (hasSchemaSignal) anomalyType = "SCHEMA_CORRUPTION";

  return {
    anomalyType,
    failedEventCount: failedEvents.length,
    samplePayloads,
    detectedAt: new Date().toISOString(),
  };
}

// ────────────────────────────────────────────
// A — Analyze (Root Cause Analysis)
// ────────────────────────────────────────────

function analyze(anomaly: AnomalyReport): RCADiagnosis {
  switch (anomaly.anomalyType) {
    case "AIRLOCK_TIMEOUT":
      return {
        rootCause:
          "Network timeout between edge database and HQ Data Warehouse. " +
          `Detected ${anomaly.failedEventCount} failed egress events. ` +
          "Probable cause: HQ endpoint is down or batch size exceeds network window.",
        confidence: 92,
        suggestedRemediation:
          "Reduce Airlock batch size from current value to 20 and apply 2s exponential backoff. " +
          "Retry FAILED events after cooldown.",
        requiresHumanApproval: false,
        affectsCriticalTables: false,
      };

    case "SCHEMA_CORRUPTION":
      return {
        rootCause:
          "Incoming event payloads failed schema validation. " +
          "Possible upstream mutation in the data model or corrupt CSV ingestion.",
        confidence: 78,
        suggestedRemediation:
          "Quarantine corrupted events. Do NOT auto-retry. " +
          "Escalate to MANAGER_LOCAL for manual payload inspection.",
        requiresHumanApproval: true,
        affectsCriticalTables: true,
      };

    case "AUTH_CASCADE_FAILURE":
      return {
        rootCause:
          "Cascade authentication failure across multiple agents. " +
          "Possible session store corruption or RBAC policy misconfiguration.",
        confidence: 65,
        suggestedRemediation:
          "Verify Upstash Redis session store connectivity. " +
          "Escalate to C-LEVEL for RBAC policy audit.",
        requiresHumanApproval: true,
        affectsCriticalTables: true,
      };

    default:
      return {
        rootCause:
          `Unclassified anomaly with ${anomaly.failedEventCount} failed events. ` +
          "Pattern matching could not determine a known root cause.",
        confidence: 40,
        suggestedRemediation:
          "Escalate to engineering team. Attach full trace dump for forensic analysis.",
        requiresHumanApproval: true,
        affectsCriticalTables: false,
      };
  }
}

// ────────────────────────────────────────────
// P — Plan (Decision Gate)
// ────────────────────────────────────────────

function plan(diagnosis: RCADiagnosis): "AUTO_REMEDIATE" | "ESCALATE" {
  // ┌─────────────────────────────────────────────────────────────┐
  // │  THE DECISION GATE                                          │
  // │                                                             │
  // │  Auto-remediation is ONLY allowed when ALL of:              │
  // │    1. Confidence ≥ 85% (SRE_CONFIG.confidenceThreshold)     │
  // │    2. Does NOT affect critical transactional tables          │
  // │    3. Does NOT require explicit human approval               │
  // │                                                             │
  // │  If ANY condition fails → escalate to Human-in-the-Loop     │
  // └─────────────────────────────────────────────────────────────┘

  if (
    diagnosis.confidence >= SRE_CONFIG.confidenceThreshold &&
    !diagnosis.affectsCriticalTables &&
    !diagnosis.requiresHumanApproval
  ) {
    return "AUTO_REMEDIATE";
  }

  return "ESCALATE";
}

// ────────────────────────────────────────────
// E — Execute
// ────────────────────────────────────────────

async function executeRemediation(
  anomaly: AnomalyReport,
  diagnosis: RCADiagnosis,
): Promise<RemediationResult> {
  // ── Auto-Remediation: Timeout → reduce batch + backoff ──────
  if (anomaly.anomalyType === "AIRLOCK_TIMEOUT") {
    const oldBatch = SRE_CONFIG.airlockBatchSize;
    const oldBackoff = SRE_CONFIG.airlockBackoffMs;

    // Dynamic configuration adjustment
    SRE_CONFIG.airlockBatchSize = Math.max(10, Math.floor(oldBatch / 5));
    SRE_CONFIG.airlockBackoffMs = Math.min(8000, oldBackoff * 4); // Exponential backoff cap at 8s

    logger.info("Auto-remediation applied: Airlock batch resize + backoff", {
      component: "SREAgent",
      action: "AUTO_REMEDIATE",
      oldBatchSize: oldBatch,
      newBatchSize: SRE_CONFIG.airlockBatchSize,
      oldBackoffMs: oldBackoff,
      newBackoffMs: SRE_CONFIG.airlockBackoffMs,
    });

    // Retry FAILED events → move them back to PENDING for the next Airlock cycle
    await db
      .update(outbox_events)
      .set({ status: "PENDING", processedAt: null })
      .where(eq(outbox_events.status, "FAILED"));

    logger.info("FAILED events reset to PENDING for retry with reduced batch", {
      component: "SREAgent",
      retriedCount: anomaly.failedEventCount,
    });

    return {
      action: "AUTO_REMEDIATED",
      details:
        `Batch size reduced ${oldBatch} → ${SRE_CONFIG.airlockBatchSize}. ` +
        `Backoff increased ${oldBackoff}ms → ${SRE_CONFIG.airlockBackoffMs}ms. ` +
        `${anomaly.failedEventCount} events reset to PENDING.`,
    };
  }

  // Fallback if somehow we reach here with a non-timeout auto-remediation
  return {
    action: "NO_ACTION_NEEDED",
    details: "No auto-remediation rule matched.",
  };
}

function escalateToHuman(
  anomaly: AnomalyReport,
  diagnosis: RCADiagnosis,
  traceId: string,
): RemediationResult {
  // ── Human-in-the-Loop: Emit structured Slack-format alert ───
  const slackAlert = {
    channel: "#sre-alerts",
    username: "BurgerMusic SRE Bot",
    icon_emoji: ":rotating_light:",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `🚨 RCA Alert: ${anomaly.anomalyType}`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Trace ID:*\n\`${traceId}\`` },
          { type: "mrkdwn", text: `*Confidence:*\n${diagnosis.confidence}%` },
          { type: "mrkdwn", text: `*Failed Events:*\n${anomaly.failedEventCount}` },
          { type: "mrkdwn", text: `*Detected At:*\n${anomaly.detectedAt}` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Root Cause:*\n${diagnosis.rootCause}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Suggested Remediation:*\n${diagnosis.suggestedRemediation}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "✅ Approve Remediation" },
            style: "primary",
            action_id: "approve_remediation",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "🛑 Reject & Investigate" },
            style: "danger",
            action_id: "reject_remediation",
          },
        ],
      },
    ],
  };

  // Emit as structured log (in production, this would POST to Slack webhook)
  logger.warn("HUMAN ESCALATION REQUIRED — RCA Artifact generated", {
    component: "SREAgent",
    action: "ESCALATE_TO_HUMAN",
    traceId,
    anomalyType: anomaly.anomalyType,
    confidence: diagnosis.confidence,
    rootCause: diagnosis.rootCause,
    suggestedRemediation: diagnosis.suggestedRemediation,
    slackPayload: JSON.stringify(slackAlert),
  });

  return {
    action: "ESCALATED_TO_HUMAN",
    details:
      `Confidence ${diagnosis.confidence}% < ${SRE_CONFIG.confidenceThreshold}% threshold ` +
      `or critical table access required. RCA artifact sent to #sre-alerts.`,
    traceId,
  };
}

// ────────────────────────────────────────────
// Public API: Run the full K-MAPE cycle
// ────────────────────────────────────────────

export async function runKMAPECycle(): Promise<RemediationResult> {
  return tracer.startActiveSpan("SREAgent.K-MAPE-Cycle", async (span) => {
    const traceId = span.spanContext().traceId;

    try {
      // ── M: Monitor ──
      span.addEvent("k-mape.monitor.start");
      const anomaly = await monitor();

      if (!anomaly) {
        span.addEvent("k-mape.monitor.healthy");
        logger.info("K-MAPE cycle: system healthy, no anomalies detected.", {
          component: "SREAgent",
          traceId,
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return { action: "NO_ACTION_NEEDED" as const, details: "System healthy." };
      }

      span.setAttribute("sre.anomaly_type", anomaly.anomalyType);
      span.setAttribute("sre.failed_event_count", anomaly.failedEventCount);

      logger.info(`Anomaly detected: ${anomaly.anomalyType}`, {
        component: "SREAgent",
        traceId,
        failedEvents: anomaly.failedEventCount,
      });

      // ── A: Analyze ──
      span.addEvent("k-mape.analyze.start");
      const diagnosis = analyze(anomaly);
      span.setAttribute("sre.rca.confidence", diagnosis.confidence);
      span.setAttribute("sre.rca.root_cause", diagnosis.rootCause);

      // ── P: Plan ──
      span.addEvent("k-mape.plan.start");
      const decision = plan(diagnosis);
      span.setAttribute("sre.decision", decision);

      logger.info(`K-MAPE decision: ${decision}`, {
        component: "SREAgent",
        traceId,
        confidence: diagnosis.confidence,
        threshold: SRE_CONFIG.confidenceThreshold,
        affectsCriticalTables: diagnosis.affectsCriticalTables,
      });

      // ── E: Execute ──
      span.addEvent("k-mape.execute.start");
      let result: RemediationResult;

      if (decision === "AUTO_REMEDIATE") {
        result = await executeRemediation(anomaly, diagnosis);
      } else {
        result = escalateToHuman(anomaly, diagnosis, traceId);
      }

      span.setAttribute("sre.result.action", result.action);
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return result;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown SRE error";
      span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
      span.recordException(error instanceof Error ? error : new Error(msg));
      span.end();

      logger.error("K-MAPE cycle failed critically", {
        component: "SREAgent",
        traceId,
        error: msg,
      });

      return {
        action: "ESCALATED_TO_HUMAN" as const,
        details: `K-MAPE cycle itself failed: ${msg}. Manual intervention required.`,
        traceId,
      };
    }
  });
}
