import { safeFetchJson } from './safeFetch';

export interface TriggerOrderSmsParams {
  orderId: string;
  status: string;
  prevStatus?: string;
  phone?: string;
  customerName?: string;
  orderType?: 'delivery' | 'pickup' | string;
}

/**
 * Triggers automated customer SMS for order lifecycle transitions.
 * Operates purely in the background with safe error handling so failure NEVER breaks orders or UI.
 */
export const triggerOrderSms = async (params: TriggerOrderSmsParams): Promise<{
  success: boolean;
  jobId?: string;
  duplicate?: boolean;
  skipped?: boolean;
  reason?: string;
}> => {
  try {
    const { orderId, status, prevStatus, phone, customerName, orderType } = params;

    if (!orderId || !status) {
      return { success: false, reason: 'orderId and status are required' };
    }

    const res = await safeFetchJson<{
      ok: boolean;
      job?: { id: string };
      duplicate?: boolean;
      skipped?: boolean;
      reason?: string;
    }>('/api/sms-gateway/order-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        status,
        prevStatus,
        phone,
        customerName,
        orderType
      })
    });

    if (res.ok && res.data) {
      if (res.data.duplicate) {
        console.log(`[SMS Gateway] Duplicate order SMS skipped for Order #${orderId}`);
      } else if (res.data.job) {
        console.log(`[SMS Gateway] 📨 Order SMS queued: Job ID ${res.data.job.id} (Order #${orderId}, Status: ${status})`);
      }
      return {
        success: res.data.ok,
        jobId: res.data.job?.id,
        duplicate: res.data.duplicate,
        skipped: res.data.skipped,
        reason: res.data.reason
      };
    }

    return {
      success: false,
      reason: res.error || 'Failed to dispatch order SMS'
    };
  } catch (err: any) {
    // Non-blocking safe catch
    console.warn('[SMS Gateway] Safe catch - order SMS trigger skipped:', err?.message || err);
    return {
      success: false,
      reason: err?.message || 'Network failure'
    };
  }
};
