import { CacheNamespace } from './CacheKeys';

export interface CacheMetadata {
  key: string;
  namespace: CacheNamespace | string;
  version: number;
  sequenceNumber: number;
  serverUpdatedAt?: string | number;
  clientUpdatedAt: string;
  updatedAt: string; // ISO String
  expiresAt: string; // ISO String
  etag?: string;
  checksum?: string;
  sizeBytes?: number;
  isStale?: boolean;
  userId?: string | null;
}

export interface CachedEnvelope<T = any> {
  data: T;
  metadata: CacheMetadata;
}

let globalSequenceCounter = 0;

export function getNextSequence(): number {
  return ++globalSequenceCounter;
}

export function createCacheEnvelope<T>(
  key: string,
  namespace: CacheNamespace | string,
  data: T,
  ttlMs: number,
  version = 1,
  etag?: string,
  userId?: string | null,
  serverUpdatedAt?: string | number
): CachedEnvelope<T> {
  const now = Date.now();
  const updatedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlMs).toISOString();

  let sizeBytes = 0;
  try {
    const serialized = JSON.stringify(data);
    sizeBytes = typeof Blob !== 'undefined' ? new Blob([serialized]).size : serialized.length;
  } catch (_) {}

  return {
    data,
    metadata: {
      key,
      namespace,
      version,
      sequenceNumber: getNextSequence(),
      serverUpdatedAt,
      clientUpdatedAt: updatedAt,
      updatedAt,
      expiresAt,
      etag,
      sizeBytes,
      isStale: false,
      userId: userId || null,
    },
  };
}

export function isEnvelopeFresh(metadata: CacheMetadata): boolean {
  if (!metadata || metadata.isStale) return false;
  const expiry = new Date(metadata.expiresAt).getTime();
  return Date.now() < expiry;
}

/**
 * Validates whether an incoming payload is newer than the current cached envelope
 * to protect against race conditions and out-of-order responses.
 */
export function isResponseNewer(
  incomingServerTimeOrSeq?: number | string,
  currentEnvelope?: CachedEnvelope<any> | null
): boolean {
  if (!currentEnvelope) return true;
  if (!incomingServerTimeOrSeq) return true;

  const currentServerTime = currentEnvelope.metadata?.serverUpdatedAt;
  if (currentServerTime && typeof incomingServerTimeOrSeq === 'string' && typeof currentServerTime === 'string') {
    return new Date(incomingServerTimeOrSeq).getTime() >= new Date(currentServerTime).getTime();
  }

  if (typeof incomingServerTimeOrSeq === 'number' && typeof currentServerTime === 'number') {
    return incomingServerTimeOrSeq >= currentServerTime;
  }

  return true;
}

