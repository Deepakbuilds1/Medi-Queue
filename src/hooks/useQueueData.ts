import { useState, useEffect, useRef, useMemo } from 'react';
import { QueueToken } from '../types';
import { subscribePublicQueue } from '../services/clinicService';
import { playTokenCallSound } from '../lib/sound';
import { useClinic } from '../context/ClinicContext';

export interface UseQueueDataOptions {
  /**
   * Whether to play sound chime and highlight when a doctor calls a new token.
   * Defaults to true.
   */
  enableSound?: boolean;
}

/**
 * Privacy-safe token interface stripping sensitive patient identifying fields.
 */
export interface PrivacyPreservingToken {
  id: string;
  tokenNumber: string;
  status: QueueToken['status'];
  roomNumber?: string;
  doctorName?: string;
  doctorId?: string;
  createdAt: string;
  calledAt?: string | null;
  completedAt?: string | null;
}

export interface UseQueueDataReturn {
  /** All tokens currently called or being served */
  nowServing: QueueToken[];
  /** All tokens currently waiting in queue */
  upNext: QueueToken[];
  /** Dynamic count of currently waiting tokens */
  waitingCount: number;
  /** Primary active token being served */
  activeServing: QueueToken | undefined;
  /** Additional active tokens if multiple doctors are consulting simultaneously */
  otherServing: QueueToken[];
  /** Privacy-preserved waiting tokens (patient name, phone, email, notes omitted) */
  privacySafeUpNext: PrivacyPreservingToken[];
  /** Privacy-preserved currently serving tokens */
  privacySafeNowServing: PrivacyPreservingToken[];
  /** Token ID currently highlighted after being called */
  highlightingId: string | null;
  /** True while the initial subscription is establishing */
  loading: boolean;
  /** Any connection or subscription error */
  error: Error | null;
  /** Raw public queue object for backwards compatibility */
  publicQueue: {
    nowServing: QueueToken[];
    upNext: QueueToken[];
  };
}

/**
 * Strips sensitive patient data (name, phone, email, medical notes)
 * keeping strictly token identifiers, status, and room assignment.
 */
export function sanitizeToPrivacyPreservingToken(token: QueueToken): PrivacyPreservingToken {
  return {
    id: token.id,
    tokenNumber: token.tokenNumber,
    status: token.status,
    roomNumber: token.roomNumber,
    doctorName: token.doctorName,
    doctorId: token.doctorId,
    createdAt: token.createdAt,
    calledAt: token.calledAt,
    completedAt: token.completedAt,
  };
}

/**
 * Hook to consume real-time clinic queue data.
 * Automatically synchronizes with the active clinic's queue in Firestore,
 * tracks waiting counts, multi-doctor call chimes, and provides privacy-safe tokens.
 *
 * @param clinicId Optional explicit clinic ID. If omitted, uses active clinic from ClinicContext.
 * @param options Configuration options such as chime sound toggles.
 */
export function useQueueData(
  clinicIdOrOptions?: string | UseQueueDataOptions,
  maybeOptions?: UseQueueDataOptions
): UseQueueDataReturn {
  // Support both useQueueData('clinic-123', options) and useQueueData(options)
  const explicitClinicId = typeof clinicIdOrOptions === 'string' ? clinicIdOrOptions : undefined;
  const options = (typeof clinicIdOrOptions === 'object' ? clinicIdOrOptions : maybeOptions) || {};
  const { enableSound = true } = options;

  let contextClinicId: string | undefined;
  try {
    const clinicContext = useClinic();
    contextClinicId = clinicContext.activeClinicId;
  } catch {
    // If used outside ClinicProvider
    contextClinicId = undefined;
  }

  const effectiveClinicId = explicitClinicId || contextClinicId;

  const [publicQueue, setPublicQueue] = useState<{
    nowServing: QueueToken[];
    upNext: QueueToken[];
  }>({ nowServing: [], upNext: [] });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [highlightingId, setHighlightingId] = useState<string | null>(null);

  // Multi-doctor active token tracking map: doctorId -> tokenId
  const doctorActiveTokenMapRef = useRef<Map<string, string>>(new Map());
  const isInitialMountRef = useRef<boolean>(true);

  useEffect(() => {
    isInitialMountRef.current = true;
    doctorActiveTokenMapRef.current.clear();
    setLoading(true);
    setError(null);
    const abortController = new AbortController();

    try {
      const unsubscribe = subscribePublicQueue(
        effectiveClinicId,
        (data) => {
          setPublicQueue(data);
          setLoading(false);

          if (isInitialMountRef.current) {
            // Record current serving tokens on initial load without chiming
            const initialMap = new Map<string, string>();
            for (const token of data.nowServing) {
              const docKey = token.doctorId || token.id;
              initialMap.set(docKey, token.id);
            }
            doctorActiveTokenMapRef.current = initialMap;
            isInitialMountRef.current = false;
          } else {
            // Multi-doctor check: detect if ANY doctor called a new token
            let newlyCalledToken: QueueToken | null = null;
            for (const token of data.nowServing) {
              const docKey = token.doctorId || token.id;
              const previousTokenId = doctorActiveTokenMapRef.current.get(docKey);
              if (previousTokenId !== token.id) {
                newlyCalledToken = token;
                break;
              }
            }

            // Update tracking map with the latest active tokens
            const updatedMap = new Map<string, string>();
            for (const token of data.nowServing) {
              const docKey = token.doctorId || token.id;
              updatedMap.set(docKey, token.id);
            }
            doctorActiveTokenMapRef.current = updatedMap;

            // Play chime and trigger highlight if a new patient token was called
            if (newlyCalledToken) {
              if (enableSound) {
                playTokenCallSound();
              }
              setHighlightingId(newlyCalledToken.id);
              const timer = setTimeout(() => setHighlightingId(null), 5000);
              return () => clearTimeout(timer);
            }
          }
        },
        undefined,
        { signal: abortController.signal }
      );

      return () => {
        abortController.abort();
        unsubscribe();
      };
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
      return () => {
        abortController.abort();
      };
    }
  }, [effectiveClinicId, enableSound]);

  const waitingCount = publicQueue.upNext.length;
  const activeServing = publicQueue.nowServing[0];
  const otherServing = publicQueue.nowServing.slice(1);

  const privacySafeUpNext = useMemo(() => {
    return publicQueue.upNext.map(sanitizeToPrivacyPreservingToken);
  }, [publicQueue.upNext]);

  const privacySafeNowServing = useMemo(() => {
    return publicQueue.nowServing.map(sanitizeToPrivacyPreservingToken);
  }, [publicQueue.nowServing]);

  return {
    nowServing: publicQueue.nowServing,
    upNext: publicQueue.upNext,
    waitingCount,
    activeServing,
    otherServing,
    privacySafeUpNext,
    privacySafeNowServing,
    highlightingId,
    loading,
    error,
    publicQueue,
  };
}
