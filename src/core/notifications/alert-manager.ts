/**
 * AlertManager Service - BurgerMusic OS
 * Integrates with external providers (Twilio / WhatsApp Business API)
 * to push proactive notifications to store managers and owners.
 */

interface AlertPayload {
  storeId: string;
  message: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  channel?: "WHATSAPP" | "SMS" | "EMAIL";
}

export class AlertManager {
  /**
   * Dispatches an alert using the configured transport.
   * Currently mocked pending actual Twilio/WABA credentials.
   */
  static async dispatch(payload: AlertPayload) {
    // [PENDING IDENTIFICATION] Here we would resolve storeId to a manager's phone number
    const targetPhone = process.env.MANAGER_PHONE_OVERRIDE || "+5491100000000";

    console.log(
      `[ALERT MANAGER] [${payload.severity}] Dispatching to ${payload.storeId} via ${payload.channel || "WHATSAPP"}`,
    );
    console.log(`[ALERT MANAGER] \uD83D\uDEA8 MESSAGE: ${payload.message}`);

    // Mock Implementation of Twilio WhatsApp API
    /*
        const twilioClient = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
        await twilioClient.messages.create({
            body: payload.message,
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to: `whatsapp:${targetPhone}`
        });
        */

    return { success: true, timestamp: new Date().toISOString() };
  }

  /**
   * Trigger 1: Variance Alert
   * Fires if the difference between theoretical stock and actual counted stock
   * exceeds the 5% tolerance threshold.
   */
  static async checkInventoryVariance(
    storeId: string,
    sku: string,
    theoreticalStock: number,
    actualStock: number,
  ) {
    if (theoreticalStock <= 0) return; // Prevent division by zero

    const varianceDelta = Math.abs(actualStock - theoreticalStock);
    const variancePercentage = varianceDelta / theoreticalStock;

    if (variancePercentage > 0.05) {
      const pctString = (variancePercentage * 100).toFixed(1);
      await this.dispatch({
        storeId,
        severity: "CRITICAL",
        message: `⚠️ ALERTA DE INVENTARIO: Varianza del ${pctString}% detectada en el SKU ${sku}. 
Teórico: ${theoreticalStock.toFixed(2)} | Real: ${actualStock.toFixed(2)}. 
Por favor, revisar inmediatamente en sucursal.`,
      });
    }
  }

  /**
   * Trigger 2: Threshold / Days of Inventory Alert
   * Fires if the remaining stock based on recent burn rate implies fewer days
   * of availability than the store's safety threshold.
   */
  static async checkSafetyThreshold(
    storeId: string,
    sku: string,
    currentStock: number,
    dailyBurnRate: number,
    minimumDaysThreshold = 3, // Default alert if less than 3 days remaining
  ) {
    if (dailyBurnRate <= 0) return; // Not enough data to burn or no burn

    const daysRemaining = currentStock / dailyBurnRate;

    if (daysRemaining < minimumDaysThreshold) {
      await this.dispatch({
        storeId,
        severity: "WARNING",
        message: `📉 ALERTA DE QUIEBRE STOCK: El SKU ${sku} podría agotarse pronto. 
Stock Actual: ${currentStock.toFixed(2)} | Burn Rate: ${dailyBurnRate.toFixed(2)}/día. 
Días estimados restantes: ${daysRemaining.toFixed(1)} días. (Umbral: ${minimumDaysThreshold})`,
      });
    }
  }
}
