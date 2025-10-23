import { BusApiMeta, BusRawError } from "@/lib/types/cta";
import { parseCtaDate } from "@/lib/utilities/timeUtils";

const CTA_BUS_TRACKER_API_KEY = process.env.CTA_BUS_TRACKER_API_KEY;
const CTA_BUS_RTPIDATAFEED = process.env.CTA_BUS_RTPIDATAFEED ?? "ctabus";
const CTA_BUS_API_BASE_URL = "https://www.ctabustracker.com/bustime/api/v3";

const DEFAULT_TIMEOUT_MS = 7000;
const DEFAULT_MAX_RETRIES = 2;

const responseCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<BusApiClientResult<BustimePayloadBase>>>();

export interface BusRequestOptions {
    endpoint: string;
    params?: Record<string, string | number | undefined>;
    requiredParams?: string[];
    cacheKey?: string;
    cacheTtlMs?: number;
    timeoutMs?: number;
    maxRetries?: number;
}

interface CacheEntry {
    value: BusApiClientResult<BustimePayloadBase>;
    expiresAt: number;
}

export interface BustimePayloadBase {
    tmst?: string;
    [key: string]: unknown;
}

export interface BusClientMeta {
    endpoint: string;
    params: Record<string, string>;
    cacheKey: string;
    cacheTtlMs?: number;
    cacheExpiresAt?: number;
    servedFromCache: boolean;
    sourceTimestamp?: string;
    reason?: string;
}

export interface BusApiClientResult<T extends BustimePayloadBase> {
    payload: T;
    meta: BusClientMeta;
}

export interface BusClientErrorOptions {
    status?: number;
    reason?: string;
    details?: string;
    endpoint?: string;
    params?: Record<string, string>;
    rawErrors?: BusRawError[];
    sourceTimestamp?: string;
    cacheKey?: string;
    cacheTtlMs?: number;
    servedFromCache?: boolean;
    cause?: unknown;
}

export class BusClientError extends Error {
    code: string;
    status: number;
    reason?: string;
    details?: string;
    endpoint?: string;
    params?: Record<string, string>;
    rawErrors?: BusRawError[];
    sourceTimestamp?: string;
    cacheKey?: string;
    cacheTtlMs?: number;
    servedFromCache?: boolean;

    constructor(code: string, message: string, options: BusClientErrorOptions = {}) {
        super(message);
        this.name = "BusClientError";
        this.code = code;
        this.status = options.status ?? 502;
        this.reason = options.reason;
        this.details = options.details;
        this.endpoint = options.endpoint;
        this.params = options.params;
        this.rawErrors = options.rawErrors;
        this.sourceTimestamp = options.sourceTimestamp;
        this.cacheKey = options.cacheKey;
        this.cacheTtlMs = options.cacheTtlMs;
        this.servedFromCache = options.servedFromCache;
        if (options.cause) {
            this.cause = options.cause;
        }
    }
}

const SOFT_ERROR_PATTERNS: Array<{ test: RegExp; reason: string }> = [
    { test: /no data found/i, reason: "No data found for parameters." },
    { test: /no service scheduled/i, reason: "No service scheduled at this time." },
    { test: /no arrival times/i, reason: "No arrival times available." },
    { test: /no predictions/i, reason: "No predictions are currently available." },
    { test: /no buses were found/i, reason: "No active vehicles found." },
];

const classifySoftError = (errors: BusRawError[]): string | undefined => {
    for (const err of errors) {
        if (!err?.msg) continue;
        for (const pattern of SOFT_ERROR_PATTERNS) {
            if (pattern.test.test(err.msg)) {
                return pattern.reason;
            }
        }
    }
    return undefined;
};

const ensureApiKey = () => {
    if (!CTA_BUS_TRACKER_API_KEY) {
        throw new BusClientError("CTA_BUS_CONFIG_MISSING", "CTA bus tracker API key is not configured.", {
            status: 500,
        });
    }
};

const normalizeParams = (params: Record<string, string | number | undefined>): Record<string, string> => {
    const normalized: Record<string, string> = {};
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        normalized[key] = typeof value === "number" ? value.toString() : String(value);
    });
    return normalized;
};

const serializeParams = (params: Record<string, string>): string => {
    return Object.keys(params)
        .sort()
        .map((key) => `${key}=${encodeURIComponent(params[key])}`)
        .join("&");
};

const computeCacheKey = (endpoint: string, params: Record<string, string>, suppliedCacheKey?: string): string => {
    if (suppliedCacheKey) return suppliedCacheKey;
    const serialized = serializeParams(params);
    return serialized.length > 0 ? `${endpoint}?${serialized}` : endpoint;
};

export const parseTimestampToIso = (timestamp?: string): string | undefined => {
    if (!timestamp) return undefined;
    const parsed = parseCtaDate(timestamp);
    return parsed ? parsed.toISOString() : undefined;
};

const toCachedResult = (entry: CacheEntry): BusApiClientResult<BustimePayloadBase> => ({
    payload: entry.value.payload,
    meta: {
        ...entry.value.meta,
        servedFromCache: true,
    },
});

const fetchWithRetry = async (url: string, timeoutMs: number, maxRetries: number): Promise<Response> => {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        attempt += 1;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const shouldRetry = attempt <= maxRetries && response.status >= 500;
                if (shouldRetry) continue;
                throw new BusClientError("CTA_BUS_HTTP_ERROR", `CTA bus tracker returned ${response.status}.`, {
                    status: response.status,
                });
            }
            return response;
        } catch (error: any) {
            clearTimeout(timeoutId);
            const isAbort = error?.name === "AbortError";
            const isNetwork = error?.name === "FetchError" || error?.message?.includes("network");
            const shouldRetry = attempt <= maxRetries && (isAbort || isNetwork || error instanceof BusClientError);
            if (!shouldRetry) {
                if (error instanceof BusClientError) throw error;
                throw new BusClientError("CTA_BUS_REQUEST_FAILED", "Failed to reach the CTA Bus Tracker service.", {
                    cause: error,
                });
            }
        }
    }
};

export const buildBusApiMeta = (
    result: BusApiClientResult<any>,
    overrides: Partial<BusApiMeta> = {}
): BusApiMeta => {
    const { meta } = result;
    return {
        sourceUpdatedAt: overrides.sourceUpdatedAt ?? meta.sourceTimestamp,
        queriedAt: overrides.queriedAt ?? new Date().toISOString(),
        cacheTtlMs: overrides.cacheTtlMs ?? meta.cacheTtlMs,
        cacheExpiresAt:
            overrides.cacheExpiresAt ??
            (meta.cacheExpiresAt ? new Date(meta.cacheExpiresAt).toISOString() : undefined),
        cacheKey: overrides.cacheKey ?? meta.cacheKey,
        ctaEndpoint: overrides.ctaEndpoint ?? meta.endpoint,
        paramsUsed: overrides.paramsUsed ?? meta.params,
        reason: overrides.reason ?? meta.reason,
        status: overrides.status,
        servedFromCache: overrides.servedFromCache ?? meta.servedFromCache,
    };
};

export const createBaseMeta = (options: {
    endpoint: string;
    params: Record<string, string | number>;
    cacheKey?: string;
    cacheTtlMs?: number;
    servedFromCache?: boolean;
    sourceUpdatedAt?: string;
    reason?: string;
    status?: number;
}): BusApiMeta => {
    return {
        sourceUpdatedAt: options.sourceUpdatedAt,
        queriedAt: new Date().toISOString(),
        cacheTtlMs: options.cacheTtlMs,
        cacheExpiresAt: options.cacheTtlMs
            ? new Date(Date.now() + options.cacheTtlMs).toISOString()
            : undefined,
        cacheKey: options.cacheKey,
        ctaEndpoint: options.endpoint,
        paramsUsed: normalizeParams(options.params),
        reason: options.reason,
        status: options.status,
        servedFromCache: options.servedFromCache ?? false,
    };
};

export const callBusApi = async <TPayload extends BustimePayloadBase>(
    options: BusRequestOptions
): Promise<BusApiClientResult<TPayload>> => {
    ensureApiKey();

    const params: Record<string, string | number | undefined> = {
        ...options.params,
    };

    const requiredKeys = options.requiredParams ?? [];
    for (const key of requiredKeys) {
        const value = params[key];
        if (value === undefined || value === null || value === "") {
            throw new BusClientError("CTA_BUS_BAD_REQUEST", `Missing required parameter: ${key}`, {
                status: 400,
                endpoint: options.endpoint,
                params: normalizeParams(params),
            });
        }
    }

    const normalizedParams = normalizeParams(params);

    if (!normalizedParams.rtpidatafeed && CTA_BUS_RTPIDATAFEED) {
        normalizedParams.rtpidatafeed = CTA_BUS_RTPIDATAFEED;
    }
    if (!normalizedParams.format) {
        normalizedParams.format = "json";
    }

    const cacheKey = computeCacheKey(options.endpoint, normalizedParams, options.cacheKey);
    const cacheTtlMs = options.cacheTtlMs ?? 0;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

    const requestParams = {
        ...normalizedParams,
        key: CTA_BUS_TRACKER_API_KEY!,
        format: "json",
    };

    if (cacheTtlMs > 0) {
        const cached = responseCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return toCachedResult(cached) as BusApiClientResult<TPayload>;
        }
    }

    if (inFlightRequests.has(cacheKey)) {
        return inFlightRequests.get(cacheKey) as Promise<BusApiClientResult<TPayload>>;
    }

    const requestPromise = (async () => {
        const searchParams = new URLSearchParams(requestParams);
        const url = `${CTA_BUS_API_BASE_URL}/${options.endpoint}?${searchParams.toString()}`;
        const response = await fetchWithRetry(url, timeoutMs, maxRetries);
        const body = await response.json().catch((err: unknown) => {
            throw new BusClientError("CTA_BUS_INVALID_RESPONSE", "CTA bus tracker returned invalid JSON.", {
                cause: err,
                endpoint: options.endpoint,
                params: normalizedParams,
            });
        });

        const envelope = body?.["bustime-response"];
        if (!envelope || typeof envelope !== "object") {
            throw new BusClientError("CTA_BUS_UNEXPECTED_SHAPE", "Unexpected CTA bus tracker response shape.", {
                endpoint: options.endpoint,
                params: normalizedParams,
            });
        }

        const payload = { ...envelope } as TPayload & { error?: BusRawError[]; tmst?: string };
        const sourceTimestamp = parseTimestampToIso(payload.tmst);

        let reason: string | undefined;
        if (Array.isArray(payload.error) && payload.error.length > 0) {
            reason = classifySoftError(payload.error);
            if (!reason) {
                throw new BusClientError(
                    payload.error[0]?.code ?? "CTA_BUS_API_ERROR",
                    payload.error[0]?.msg ?? "CTA bus tracker returned an error.",
                    {
                        endpoint: options.endpoint,
                        params: normalizedParams,
                        rawErrors: payload.error,
                        sourceTimestamp,
                    }
                );
            }
            delete (payload as any).error;
        }

        const clientResult: BusApiClientResult<TPayload> = {
            payload: payload as unknown as TPayload,
            meta: {
                endpoint: options.endpoint,
                params: normalizedParams,
                cacheKey,
                cacheTtlMs,
                cacheExpiresAt: cacheTtlMs > 0 ? Date.now() + cacheTtlMs : undefined,
                servedFromCache: false,
                sourceTimestamp,
                reason,
            },
        };

        if (cacheTtlMs > 0) {
            responseCache.set(cacheKey, {
                value: clientResult as unknown as BusApiClientResult<BustimePayloadBase>,
                expiresAt: Date.now() + cacheTtlMs,
            });
        }

        return clientResult;
    })()
        .finally(() => {
            inFlightRequests.delete(cacheKey);
        });

    inFlightRequests.set(cacheKey, requestPromise as Promise<BusApiClientResult<BustimePayloadBase>>);

    return requestPromise;
};

export const invalidateBusCache = (predicate?: (key: string) => boolean) => {
    const keys = Array.from(responseCache.keys());
    for (const key of keys) {
        if (!predicate || predicate(key)) {
            responseCache.delete(key);
        }
    }
};
