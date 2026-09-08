import type { InfiniteData } from '@tanstack/react-query';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, API_BASE_URL } from '../client';
import { logger } from '@/lib/logger';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * 尝试状态
 */
export type AttemptStatus = 'success' | 'failed' | 'circuit_break' | 'skipped';

/**
 * 单次渠道尝试信息
 */
export interface ChannelAttempt {
    channel_id: number;
    channel_key_id?: number;
    channel_name: string;
    model_name: string;
    attempt_num: number;    // 第几次尝试
    status: AttemptStatus;
    duration: number;       // 耗时(毫秒)
    sticky?: boolean;
    msg?: string;
}

/**
 * 日志数据
 */
export interface RelayLog {
    id: number;
    time: number;                // 时间戳
    request_model_name: string;  // 请求模型名称
    request_api_key_name?: string; // 请求使用的 API Key 名称
    channel: number;             // 实际使用的渠道ID
    channel_name: string;        // 渠道名称
    actual_model_name: string;   // 实际使用模型名称
    input_tokens: number;        // 输入Token
    output_tokens: number;       // 输出Token
    cache_read_tokens: number;   // 缓存读取Token
    cache_write_tokens: number;  // 缓存写入Token
    ftut: number;                // 首字时间(毫秒)
    use_time: number;            // 总用时(毫秒)
    tps: number;                // 输出速度 (tokens/sec)
    cost: number;               // 消耗费用
    channel_input_cost: number;
    channel_output_cost: number;
    channel_cache_read_cost: number;
    channel_cache_write_cost: number;
    apikey_input_cost: number;
    apikey_output_cost: number;
    apikey_cache_read_cost: number;
    apikey_cache_write_cost: number;
    request_content: string;     // 请求内容
    response_content: string;    // 响应内容
    error: string;               // 错误信息
    attempts?: ChannelAttempt[]; // 所有尝试记录
    total_attempts?: number;     // 总尝试次数
    status?: 'pending' | 'streaming'; // 进行中标记（仅 SSE 实时推送，落库日志为空）
}

/**
 * 日志列表查询参数
 */
export interface LogListParams {
    page?: number;
    page_size?: number;
    start_time?: number;
    end_time?: number;
}

/**
 * 清空日志 Hook
 * 
 * @example
 * const clearLogs = useClearLogs();
 * 
 * clearLogs.mutate();
 */
export function useClearLogs() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            return apiClient.delete<null>('/api/v1/log/clear');
        },
        onSuccess: () => {
            logger.log('日志清空成功');
            queryClient.invalidateQueries({ queryKey: ['logs'] });
        },
        onError: (error) => {
            logger.error('日志清空失败:', error);
        },
    });
}

const logsInfiniteQueryKey = (pageSize: number, startTime?: number, endTime?: number) =>
    ['logs', 'infinite', pageSize, startTime ?? null, endTime ?? null] as const;

/**
 * 日志管理 Hook
 * 整合初始加载、SSE 实时推送、滚动加载更多
 *
 * @example
 * const { logs, isConnected, hasMore, isLoadingMore, loadMore, clear } = useLogs();
 *
 * // logs 自动包含历史日志和实时日志，按时间倒序
 * logs.forEach(log => console.log(log.request_model_name));
 *
 * // 滚动到底部时加载更多
 * if (hasMore && !isLoadingMore) loadMore();
 */
export function useLogs(options: { pageSize?: number; realtime?: boolean; startTime?: number; endTime?: number } = {}) {
    const { pageSize = 20, realtime = false, startTime, endTime } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    const queryClient = useQueryClient();

    const logsQuery = useInfiniteQuery({
        queryKey: logsInfiniteQueryKey(pageSize, startTime, endTime),
        initialPageParam: 1,
        queryFn: async ({ pageParam }) => {
            const params = new URLSearchParams();
            params.set('page', String(pageParam));
            params.set('page_size', String(pageSize));
            if (startTime !== undefined) params.set('start_time', String(startTime));
            if (endTime !== undefined) params.set('end_time', String(endTime));
            const result = await apiClient.get<RelayLog[] | null>(`/api/v1/log/list?${params.toString()}`);
            return result ?? [];
        },
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage || lastPage.length < pageSize) return undefined;
            return allPages.length + 1;
        },
        staleTime: Infinity,
        refetchOnMount: 'always',
    });

    const logs = useMemo(() => {
        const pages = logsQuery.data?.pages ?? [];
        const seen = new Set<number>();
        const merged: RelayLog[] = [];

        for (const page of pages) {
            for (const log of page) {
                if (seen.has(log.id)) continue;
                seen.add(log.id);
                merged.push(log);
            }
        }

        merged.sort((a, b) => b.time - a.time);
        return merged;
    }, [logsQuery.data]);

    const loadMore = useCallback(async () => {
        if (!logsQuery.hasNextPage) return;
        if (logsQuery.isFetchingNextPage) return;

        try {
            await logsQuery.fetchNextPage();
        } catch (e) {
            logger.error('加载更多日志失败:', e);
        }
    }, [logsQuery]);

    const mergeIncomingLogs = useCallback((incoming: RelayLog[]) => {
        if (incoming.length === 0) return;
        queryClient.setQueryData(
            logsInfiniteQueryKey(pageSize, startTime, endTime),
            (old: InfiniteData<RelayLog[], number> | undefined) => {
                const fresh = incoming.filter((log) =>
                    (startTime === undefined || log.time >= startTime) &&
                    (endTime === undefined || log.time <= endTime)
                );
                if (fresh.length === 0) return old;
                if (!old) return { pages: [fresh], pageParams: [1] };

                // 终态日志（status 为空）替换同 ID 的进行中条目；进行中条目不覆盖已存在的终态
                const finalized = new Map(fresh.filter((x) => !x.status).map((x) => [x.id, x]));
                const seen = new Set(old.pages.flat().map((x) => x.id));

                const pages = old.pages.map((page) =>
                    page.map((existing) => finalized.get(existing.id) ?? existing)
                );

                const add = fresh.filter((x) => !seen.has(x.id));
                if (add.length > 0) {
                    const sorted = [...add].sort((a, b) => b.time - a.time);
                    pages[0] = [...sorted, ...(pages[0] ?? [])];
                }

                return { ...old, pages };
            },
        );
    }, [queryClient, pageSize, startTime, endTime]);

    useEffect(() => {
        if (!realtime) return;
        let cancelled = false;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        let attempts = 0;

        const scheduleRetry = () => {
            if (cancelled) return;
            attempts += 1;
            const delay = Math.min(1000 * 2 ** (attempts - 1), 10_000);
            retryTimer = setTimeout(() => {
                if (!cancelled) void connect();
            }, delay);
        };

        const connect = async () => {
            try {
                const { token } = await apiClient.get<{ token: string }>('/api/v1/log/stream-token');
                if (cancelled) return;

                const eventSource = new EventSource(`${API_BASE_URL}/api/v1/log/stream?token=${token}`);
                eventSourceRef.current = eventSource;

                eventSource.onopen = () => {
                    attempts = 0;
                    setIsConnected(true);
                    setError(null);
                };

                eventSource.onmessage = (event) => {
                    try {
                        const log: RelayLog = JSON.parse(event.data);
                        mergeIncomingLogs([log]);
                    } catch (e) {
                        logger.error('解析日志数据失败:', e);
                    }
                };

                eventSource.onerror = () => {
                    setIsConnected(false);
                    setError(new Error('SSE 连接断开'));
                    eventSource.close();
                    eventSourceRef.current = null;
                    scheduleRetry();
                };
            } catch (e) {
                if (cancelled) return;
                setError(e instanceof Error ? e : new Error('获取 stream token 失败'));
                logger.error('获取 stream token 失败:', e);
                scheduleRetry();
            }
        };

        connect();

        return () => {
            cancelled = true;
            if (retryTimer) clearTimeout(retryTimer);
            eventSourceRef.current?.close();
            eventSourceRef.current = null;
            setIsConnected(false);
        };
    }, [realtime, pageSize, startTime, endTime, queryClient, mergeIncomingLogs]);

    // SSE 兜底轮询：代理缓冲或连接中断时仍能拉到新日志（每 5s 只拉第一页，新日志按 id 去重后合入）
    useEffect(() => {
        if (!realtime) return;

        const poll = async () => {
            try {
                const params = new URLSearchParams();
                params.set('page', '1');
                params.set('page_size', String(pageSize));
                if (startTime !== undefined) params.set('start_time', String(startTime));
                if (endTime !== undefined) params.set('end_time', String(endTime));
                const result = await apiClient.get<RelayLog[] | null>(`/api/v1/log/list?${params.toString()}`);
                mergeIncomingLogs(result ?? []);
            } catch (e) {
                logger.error('实时轮询日志失败:', e);
            }
        };

        const timer = setInterval(() => {
            void poll();
        }, isConnected ? 5000 : 2000);

        return () => clearInterval(timer);
    }, [realtime, pageSize, startTime, endTime, mergeIncomingLogs, isConnected]);

    const refetch = logsQuery.refetch;
    const prevRealtimeRef = useRef(realtime);
    useEffect(() => {
        if (realtime && !prevRealtimeRef.current) {
            void refetch();
        }
        prevRealtimeRef.current = realtime;
    }, [realtime, refetch]);

    const clear = useCallback(() => {
        queryClient.removeQueries({ queryKey: logsInfiniteQueryKey(pageSize) });
    }, [pageSize, queryClient]);

    return {
        logs,
        isConnected,
        error,
        hasMore: !!logsQuery.hasNextPage,
        isLoading: logsQuery.isLoading,
        isLoadingMore: logsQuery.isFetchingNextPage,
        loadMore,
        clear,
    };
}
