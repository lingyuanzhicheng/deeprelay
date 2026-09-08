'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Loader } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import {
    useAPIKeyList,
    useUpdateAPIKey,
    useDeleteAPIKey,
    type APIKey,
} from '@/api/endpoints/apikey';
import { useStatsAPIKey } from '@/api/endpoints/stats';
import { useSearchStore, useToolbarViewOptionsStore } from '@/components/modules/toolbar';
import {
    MorphingDialog,
    MorphingDialogTrigger,
    MorphingDialogContainer,
    MorphingDialogContent,
} from '@/components/ui/morphing-dialog';
import { APIKeyKeyItem, APIKeyDetailContent } from '@/components/modules/setting/APIKey';
import { toast } from '@/components/common/Toast';
import type { ApiError } from '@/api/types';

export function APIKey() {
    const t = useTranslations('setting');
    const pageKey = 'apikey' as const;
    const { data: apiKeys, isLoading: apiKeysLoading, error: apiKeysError } = useAPIKeyList();
    const { data: statsList = [] } = useStatsAPIKey();
    const updateAPIKey = useUpdateAPIKey();
    const deleteAPIKey = useDeleteAPIKey();
    const searchTerm = useSearchStore((s) => s.getSearchTerm(pageKey));
    const sortField = useToolbarViewOptionsStore((s) => s.getSortField(pageKey));
    const sortOrder = useToolbarViewOptionsStore((s) => s.getSortOrder(pageKey));
    const layout = useToolbarViewOptionsStore((s) => s.getLayout(pageKey));

    const statsMap = useMemo(() => {
        const m = new Map<number, (typeof statsList)[number]>();
        for (const s of statsList) m.set(s.api_key_id, s);
        return m;
    }, [statsList]);

    const sortedApiKeys = useMemo(() => {
        if (!apiKeys) return [];
        return [...apiKeys].sort((a, b) => {
            const diff = sortField === 'name'
                ? a.name.localeCompare(b.name)
                : a.id - b.id;
            return sortOrder === 'asc' ? diff : -diff;
        });
    }, [apiKeys, sortField, sortOrder]);

    const visibleApiKeys = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return sortedApiKeys;
        return sortedApiKeys.filter(
            (k) => k.name.toLowerCase().includes(term) || k.api_key.toLowerCase().includes(term),
        );
    }, [sortedApiKeys, searchTerm]);

    const handleEnabledChange = useCallback(
        (apiKey: APIKey, enabled: boolean) => {
            updateAPIKey.mutate(
                { id: apiKey.id, name: apiKey.name, enabled, expire_at: apiKey.expire_at, max_cost: apiKey.max_cost, supported_models: apiKey.supported_models },
                {
                    onSuccess: () => {
                        toast.success(enabled ? t('apiKey.toast.enabled') : t('apiKey.toast.disabled'));
                    },
                    onError: (error) => {
                        const msg = (error as unknown as ApiError)?.message;
                        toast.error(t('apiKey.toast.updateError'), { description: msg });
                    },
                },
            );
        },
        [updateAPIKey, t],
    );

    return (
        <div className="h-full min-h-0 overflow-y-auto overscroll-contain rounded-t-3xl p-4">
            <div
                className={cn(
                    'relative grid gap-3',
                    layout === 'list' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
                )}
            >
                {apiKeysLoading ? (
                    <div className="flex items-center justify-center h-32 text-sm text-muted-foreground col-span-full">
                        <Loader className="size-4 animate-spin" />
                    </div>
                ) : apiKeysError ? (
                    <div className="flex items-center justify-center h-32 text-sm text-destructive col-span-full">
                        {t('apiKey.loadFailed')}
                    </div>
                ) : (
                    <AnimatePresence>
                        {visibleApiKeys.map((apiKey) => {
                            const stats = statsMap.get(apiKey.id) ?? null;
                            return (
                                <MorphingDialog key={apiKey.id}>
                                    <MorphingDialogTrigger className="w-full text-left">
                                        <APIKeyKeyItem
                                            apiKey={apiKey}
                                            stats={stats}
                                            layout={layout}
                                            onEnabledChange={(enabled) => handleEnabledChange(apiKey, enabled)}
                                            isUpdating={updateAPIKey.isPending}
                                        />
                                    </MorphingDialogTrigger>
                                    <MorphingDialogContainer>
                                        <MorphingDialogContent className="w-full md:max-w-xl bg-card text-card-foreground px-4 py-2 rounded-3xl max-h-[90vh] overflow-y-auto">
                                            <APIKeyDetailContent apiKey={apiKey} stats={stats} />
                                        </MorphingDialogContent>
                                    </MorphingDialogContainer>
                                </MorphingDialog>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
