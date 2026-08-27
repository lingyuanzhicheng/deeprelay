'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';

const MODELS_DEV_URL = 'https://models.dev/api.json';

interface ModelsDevCost {
    input: number;
    output: number;
    cache_read: number;
    cache_write?: number;
}

interface ModelsDevModelEntry {
    id: string;
    name?: string;
    cost?: ModelsDevCost;
}

interface ModelsDevProviderEntry {
    id: string;
    name?: string;
    models: Record<string, ModelsDevModelEntry>;
}

type ModelsDevRaw = Record<string, ModelsDevProviderEntry>;

export interface ModelsDevSuggestion {
    provider: string;
    modelId: string;
    input: number;
    output: number;
    cache_read: number;
    cache_write: number;
}

let cachedData: ModelsDevRaw | null = null;
let inflight: Promise<ModelsDevRaw> | null = null;

async function fetchModelsDev(): Promise<ModelsDevRaw> {
    if (cachedData) return cachedData;
    if (inflight) return inflight;
    inflight = (async () => {
        const resp = await fetch(MODELS_DEV_URL, {
            headers: { 'Accept': 'application/json' },
        });
        if (!resp.ok) throw new Error(`models.dev fetch failed: ${resp.status}`);
        const data = (await resp.json()) as ModelsDevRaw;
        cachedData = data;
        return data;
    })();
    try {
        return await inflight;
    } finally {
        inflight = null;
    }
}

export interface UseModelsDevFetchResult {
    loading: boolean;
    error: Error | null;
    providers: string[];
    getProviderSuggestions: (query: string) => string[];
    getModelSuggestions: (provider: string, query: string) => ModelsDevSuggestion[];
    lookupModel: (provider: string, modelId: string) => ModelsDevSuggestion | null;
    ensureLoaded: () => void;
}

export function useModelsDevFetch(): UseModelsDevFetchResult {
    const [data, setData] = useState<ModelsDevRaw | null>(cachedData);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const triggeredRef = useRef(false);

    const ensureLoaded = useCallback(() => {
        if (cachedData || loading || triggeredRef.current) return;
        triggeredRef.current = true;
        setLoading(true);
        setError(null);
        fetchModelsDev()
            .then((d) => {
                setData(d);
            })
            .catch((e: unknown) => {
                const err = e instanceof Error ? e : new Error(String(e));
                setError(err);
                logger.error('models.dev fetch error:', err);
            })
            .finally(() => setLoading(false));
    }, [loading]);

    const providers = data ? Object.keys(data).sort() : [];

    const getProviderSuggestions = useCallback((query: string): string[] => {
        if (!cachedData) return [];
        const q = query.toLowerCase().trim();
        const all = Object.keys(cachedData).sort();
        if (!q) return all;
        return all.filter((p) => p.toLowerCase().includes(q));
    }, []);

    const getModelSuggestions = useCallback(
        (provider: string, query: string): ModelsDevSuggestion[] => {
            if (!cachedData) return [];
            const prov = cachedData[provider.toLowerCase()];
            if (!prov || !prov.models) return [];
            const q = query.toLowerCase().trim();
            const entries = Object.values(prov.models);
            const filtered = q
                ? entries.filter((m) => m.id.toLowerCase().includes(q))
                : entries;
            return filtered.map((m) => ({
                provider: provider.toLowerCase(),
                modelId: m.id,
                input: m.cost?.input ?? 0,
                output: m.cost?.output ?? 0,
                cache_read: m.cost?.cache_read ?? 0,
                cache_write: m.cost?.cache_write ?? 0,
            }));
        },
        [],
    );

    const lookupModel = useCallback(
        (provider: string, modelId: string): ModelsDevSuggestion | null => {
            if (!cachedData) return null;
            const prov = cachedData[provider.toLowerCase()];
            if (!prov || !prov.models) return null;
            const m = prov.models[modelId.toLowerCase()];
            if (!m) return null;
            return {
                provider: provider.toLowerCase(),
                modelId: m.id,
                input: m.cost?.input ?? 0,
                output: m.cost?.output ?? 0,
                cache_read: m.cost?.cache_read ?? 0,
                cache_write: m.cost?.cache_write ?? 0,
            };
        },
        [],
    );

    useEffect(() => () => { triggeredRef.current = false; }, []);

    return {
        loading,
        error,
        providers,
        getProviderSuggestions,
        getModelSuggestions,
        lookupModel,
        ensureLoaded,
    };
}
