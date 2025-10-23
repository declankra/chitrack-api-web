import { BusApiError, BusApiMeta, BusErrorDetail, BusRawError } from "@/lib/types/cta";
import { BusClientError } from "@/lib/bus/ctaBusClient";

interface ErrorContext {
    endpoint: string;
    params: Record<string, string | number>;
    cacheKey?: string;
    cacheTtlMs?: number;
    servedFromCache?: boolean;
    sourceUpdatedAt?: string;
    reason?: string;
    status?: number;
}

type ErrorMapping = {
    test: RegExp;
    code: string;
    reason?: string;
    status?: number;
};

const CTA_ERROR_MAPPINGS: ErrorMapping[] = [
    {
        test: /no service scheduled/i,
        code: "CTA_BUS_NO_SERVICE",
        reason: "No service scheduled at this time.",
        status: 200,
    },
    {
        test: /no data found/i,
        code: "CTA_BUS_NO_DATA",
        reason: "CTA reported no results for the provided parameters.",
        status: 200,
    },
    {
        test: /no arrival times/i,
        code: "CTA_BUS_NO_ARRIVALS",
        reason: "No upcoming arrivals were returned.",
        status: 200,
    },
    {
        test: /no predictions/i,
        code: "CTA_BUS_NO_PREDICTIONS",
        reason: "No live predictions are available right now.",
        status: 200,
    },
    {
        test: /invalid param/i,
        code: "CTA_BUS_INVALID_PARAMETER",
        reason: "CTA rejected one or more parameters.",
        status: 400,
    },
    {
        test: /limit exceeded|daily request limit/i,
        code: "CTA_BUS_RATE_LIMIT",
        reason: "CTA rate limit exceeded.",
        status: 429,
    },
    {
        test: /api key/i,
        code: "CTA_BUS_AUTH_ERROR",
        reason: "CTA bus tracker API key rejected.",
        status: 401,
    },
];

const sanitizeParams = (params: Record<string, string | number>): Record<string, string | number> => {
    const result: Record<string, string | number> = {};
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (typeof value === "number") {
            result[key] = value;
        } else {
            result[key] = value;
        }
    });
    return result;
};

const normalizeErrorDetail = (detail: BusErrorDetail): BusErrorDetail => {
    return {
        code: detail.code,
        message: detail.message,
        details: detail.details,
    };
};

const deriveFromRawErrors = (errors: BusRawError[]): Partial<BusErrorDetail> & { reason?: string; status?: number } => {
    for (const raw of errors) {
        if (!raw?.msg) continue;
        for (const mapping of CTA_ERROR_MAPPINGS) {
            if (mapping.test.test(raw.msg)) {
                return {
                    code: mapping.code,
                    message: raw.msg,
                    reason: mapping.reason,
                    status: mapping.status,
                };
            }
        }
    }
    const first = errors[0];
    if (first?.msg) {
        return {
            code: first.code ?? deriveCodeFromMessage(first.msg),
            message: first.msg,
        };
    }
    return {};
};

const deriveCodeFromMessage = (message: string): string => {
    return message
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60) || "CTA_BUS_ERROR";
};

export const mapBusApiError = (error: unknown, context: ErrorContext): BusApiError => {
    const queriedAt = new Date().toISOString();
    const paramsUsed = sanitizeParams(context.params);

    let detail: BusErrorDetail = {
        code: "CTA_BUS_UNKNOWN_ERROR",
        message: "Unexpected error contacting CTA Bus Tracker.",
    };
    let meta: BusApiMeta = {
        sourceUpdatedAt: context.sourceUpdatedAt,
        queriedAt,
        cacheTtlMs: context.cacheTtlMs,
        cacheExpiresAt:
            context.cacheTtlMs && context.cacheTtlMs > 0
                ? new Date(Date.now() + context.cacheTtlMs).toISOString()
                : undefined,
        cacheKey: context.cacheKey,
        ctaEndpoint: context.endpoint,
        paramsUsed,
        reason: context.reason,
        status: context.status ?? 502,
        servedFromCache: context.servedFromCache ?? false,
    };

    if (error instanceof BusClientError) {
        detail = normalizeErrorDetail({
            code: error.code,
            message: error.message,
            details: error.details,
        });

        if (error.rawErrors && error.rawErrors.length > 0) {
            const rawDetail = deriveFromRawErrors(error.rawErrors);
            if (rawDetail.code) {
                detail.code = rawDetail.code;
            }
            if (rawDetail.message) {
                detail.message = rawDetail.message;
            }
            if (rawDetail.reason) {
                meta.reason = rawDetail.reason;
            }
            if (rawDetail.status) {
                meta.status = rawDetail.status;
            }
        }

        meta.sourceUpdatedAt = meta.sourceUpdatedAt ?? error.sourceTimestamp;
        meta.reason = meta.reason ?? error.reason;
        meta.status = meta.status ?? error.status ?? meta.status;
        meta.servedFromCache = error.servedFromCache ?? meta.servedFromCache;
    } else if (error instanceof Error) {
        detail = normalizeErrorDetail({
            code: deriveCodeFromMessage(error.message),
            message: error.message,
        });
    }

    return {
        data: null,
        error: detail,
        meta,
    };
};
