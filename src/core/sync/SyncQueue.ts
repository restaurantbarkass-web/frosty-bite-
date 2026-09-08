export interface SyncQueueItem {
  id: string;
  idempotencyKey: string;
  operation:
    | 'update_cart'
    | 'save_review'
    | 'update_profile'
    | 'toggle_wishlist'
    | 'create_order'
    | 'custom_mutation';
  entity: string;
  entityId?: string;
  payload: any;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: number;
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  status: 'pending' | 'syncing' | 'failed' | 'permanently_failed' | 'completed';
  lastError?: string | null;
  userId?: string | null;
}

const SYNC_QUEUE_KEY = 'fb_persistent_sync_queue';

class MasterSyncQueue {
  private memoryQueue: SyncQueueItem[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      if (typeof window === 'undefined') return;
      const raw = localStorage.getItem(SYNC_QUEUE_KEY);
      if (raw) {
        this.memoryQueue = JSON.parse(raw);
      }
    } catch (_) {}
  }

  private saveToStorage(): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.memoryQueue));
    } catch (_) {}
  }

  enqueue(
    operation: SyncQueueItem['operation'],
    entity: string,
    payload: any,
    options?: {
      entityId?: string;
      idempotencyKey?: string;
      priority?: SyncQueueItem['priority'];
      userId?: string | null;
      maxRetries?: number;
    }
  ): SyncQueueItem {
    const idempotencyKey =
      options?.idempotencyKey ||
      `idemp_${operation}_${options?.entityId || ''}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Check for duplicate in-flight / pending items with same idempotency key
    const existing = this.memoryQueue.find((item) => item.idempotencyKey === idempotencyKey);
    if (existing) {
      return existing;
    }

    const item: SyncQueueItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      idempotencyKey,
      operation,
      entity,
      entityId: options?.entityId,
      payload,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: options?.maxRetries ?? 5,
      nextRetryAt: Date.now(),
      priority: options?.priority ?? 'NORMAL',
      status: 'pending',
      userId: options?.userId || null,
    };

    this.memoryQueue.push(item);
    this.saveToStorage();
    return item;
  }

  getPendingItems(userId?: string | null): SyncQueueItem[] {
    const now = Date.now();
    return this.memoryQueue
      .filter((item) => {
        const matchesStatus = item.status === 'pending' || item.status === 'failed';
        const readyForRetry = item.nextRetryAt <= now;
        const matchesUser = userId === undefined || item.userId === userId || !item.userId;
        return matchesStatus && readyForRetry && matchesUser;
      })
      .sort((a, b) => {
        // Priority sort: CRITICAL -> HIGH -> NORMAL -> LOW
        const priorityWeight = { CRITICAL: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
        const weightA = priorityWeight[a.priority] || 2;
        const weightB = priorityWeight[b.priority] || 2;
        if (weightA !== weightB) return weightB - weightA;
        return a.createdAt - b.createdAt;
      });
  }

  markSyncing(id: string): void {
    const item = this.memoryQueue.find((i) => i.id === id);
    if (item) {
      item.status = 'syncing';
      this.saveToStorage();
    }
  }

  markCompleted(id: string): void {
    this.memoryQueue = this.memoryQueue.filter((i) => i.id !== id);
    this.saveToStorage();
  }

  markFailed(id: string, error: string): void {
    const item = this.memoryQueue.find((i) => i.id === id);
    if (item) {
      item.retryCount += 1;
      item.lastError = error;

      if (item.retryCount >= item.maxRetries) {
        item.status = 'permanently_failed';
      } else {
        item.status = 'failed';
        // Exponential backoff with jitter: 1s, 2s, 4s, 8s, 16s (max 30s) + jitter
        const baseDelay = Math.min(30000, 1000 * Math.pow(2, item.retryCount));
        const jitter = Math.floor(Math.random() * 500);
        item.nextRetryAt = Date.now() + baseDelay + jitter;
      }
      this.saveToStorage();
    }
  }

  clearUserItems(userId: string): void {
    this.memoryQueue = this.memoryQueue.filter((i) => i.userId !== userId);
    this.saveToStorage();
  }

  clearQueue(): void {
    this.memoryQueue = [];
    this.saveToStorage();
  }

  getQueueSize(): number {
    return this.memoryQueue.length;
  }
}

export const SyncQueue = new MasterSyncQueue();

