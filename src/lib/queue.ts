import { Redis } from "@upstash/redis";

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

export const isRedisConfigured = redisUrl !== "" && redisToken !== "";

// Inicializar el cliente global de Redis de forma segura
export const redis = isRedisConfigured
  ? new Redis({
      url: redisUrl,
      token: redisToken,
    })
  : (null as any);

export const QUEUE_KEYS = {
  INBOUND_POS: "pos:queue",
  DLQ_POS: "pos:dlq",
  METRICS_VELOCITY: "pos:velocity", // Processed count in the last minute
};

export async function enqueueTransaction(payload: any) {
  if (!isRedisConfigured) return;
  const data = JSON.stringify(payload);
  await redis.lpush(QUEUE_KEYS.INBOUND_POS, data);
}

export async function enqueueToDLQ(payload: any, errorReason: string) {
  if (!isRedisConfigured) return;
  const dlqItem = {
    payload,
    error: errorReason,
    timestamp: new Date().toISOString(),
  };
  await redis.lpush(QUEUE_KEYS.DLQ_POS, JSON.stringify(dlqItem));
}

export async function dequeueTransactions(batchSize = 10): Promise<any[]> {
  if (!isRedisConfigured) return [];

  // Pipeline para hacer RPOP concurrente (simulando extraer un batch)
  // Nota: Aunque RPOP saca de a 1 o N si se pasa count, usamos count
  const batch = await redis.rpop(QUEUE_KEYS.INBOUND_POS, batchSize);

  if (!batch) return [];

  // RPOP con count devuelve un array si son varios, o un null si no hay.
  const items = Array.isArray(batch) ? batch : [batch];

  return items
    .map((item) => {
      try {
        return typeof item === "string" ? JSON.parse(item) : item;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export async function recordVelocityMetric(processedCount: number) {
  if (!isRedisConfigured) return;

  const currentMinute = new Date().getMinutes();
  const key = `${QUEUE_KEYS.METRICS_VELOCITY}:${currentMinute}`;

  const pipeline = redis.pipeline();
  pipeline.incrby(key, processedCount);
  pipeline.expire(key, 120); // Mantener la ventana de velocidad por 2 minutos
  await pipeline.exec();
}

export async function getQueueMetrics() {
  if (!isRedisConfigured) {
    return { depth: 0, dlqDepth: 0, velocity_per_minute: 0 };
  }

  const queueDepth = await redis.llen(QUEUE_KEYS.INBOUND_POS);
  const dlqDepth = await redis.llen(QUEUE_KEYS.DLQ_POS);

  // Sumar velocidad del último minuto o actual
  const currentMinute = new Date().getMinutes();
  const key = `${QUEUE_KEYS.METRICS_VELOCITY}:${currentMinute}`;
  const velocityStr = await redis.get(key);
  const velocity = Number.parseInt(velocityStr as string) || 0;

  return {
    depth: queueDepth,
    dlqDepth: dlqDepth,
    velocity_per_minute: velocity,
  };
}
