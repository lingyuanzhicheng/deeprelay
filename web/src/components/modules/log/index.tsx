'use client';

import { useCallback, useMemo } from 'react';
import { useLogs } from '@/api/endpoints/log';
import { LogCard } from './Item';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { VirtualizedGrid } from '@/components/common/VirtualizedGrid';
import { useLogViewOptionsStore } from './view-options-store';

function dayStartSeconds(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    return Math.floor(new Date(y, m - 1, d, 0, 0, 0, 0).getTime() / 1000);
}

function dayEndSeconds(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    return Math.floor(new Date(y, m - 1, d, 23, 59, 59, 999).getTime() / 1000);
}

/**
 * 日志页面组件
 * - 初始加载 pageSize 条历史日志
 * - SSE 实时推送新日志
 * - 滚动自动加载更多
 */
export function Log() {
    const t = useTranslations('log');
    const realtime = useLogViewOptionsStore((s) => s.realtime);
    const startDate = useLogViewOptionsStore((s) => s.startDate);
    const endDate = useLogViewOptionsStore((s) => s.endDate);

    const startTime = useMemo(() => (startDate ? dayStartSeconds(startDate) : undefined), [startDate]);
    const endTime = useMemo(() => (endDate ? dayEndSeconds(endDate) : undefined), [endDate]);

    const { logs, hasMore, isLoading, isLoadingMore, loadMore } = useLogs({ pageSize: 10, realtime, startTime, endTime });

    const canLoadMore = hasMore && !isLoading && !isLoadingMore && logs.length > 0;
    const handleReachEnd = useCallback(() => {
        if (!canLoadMore) return;
        void loadMore();
    }, [canLoadMore, loadMore]);

    const footer = useMemo(() => {
        if (hasMore && (isLoading || isLoadingMore)) {
            return (
                <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            );
        }
        if (!hasMore && logs.length > 0) {
            return (
                <div className="flex justify-center py-4">
                    <span className="text-sm text-muted-foreground">{t('list.noMore')}</span>
                </div>
            );
        }
        return null;
    }, [hasMore, isLoading, isLoadingMore, logs.length, t]);

    return (
        <VirtualizedGrid
            items={logs}
            layout="list"
            columns={{ default: 1 }}
            estimateItemHeight={80}
            overscan={8}
            getItemKey={(log) => `log-${log.id}`}
            renderItem={(log) => <LogCard log={log} />}
            footer={footer}
            onReachEnd={handleReachEnd}
            reachEndEnabled={canLoadMore}
            reachEndOffset={2}
        />
    );
}
