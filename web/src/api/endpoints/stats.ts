import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { formatCount, formatMoney } from '@/lib/utils';

/**
 * 统计数据
 */
export interface StatsMetrics {
    input_token: number;
    cache_read_token: number;
    cache_write_token: number;
    output_token: number;
    input_cost: number;
    cache_read_cost: number;
    cache_write_cost: number;
    output_cost: number;
    request_success: number;
    request_failed: number;
}

export interface StatsMetricsFormatted {
    input_token: ReturnType<typeof formatCount>;
    cache_read_token: ReturnType<typeof formatCount>;
    cache_write_token: ReturnType<typeof formatCount>;
    output_token: ReturnType<typeof formatCount>;
    input_cost: ReturnType<typeof formatMoney>;
    cache_read_cost: ReturnType<typeof formatMoney>;
    cache_write_cost: ReturnType<typeof formatMoney>;
    output_cost: ReturnType<typeof formatMoney>;
    request_success: ReturnType<typeof formatCount>;
    request_failed: ReturnType<typeof formatCount>;

    request_count: ReturnType<typeof formatCount>;
    total_token: ReturnType<typeof formatCount>;
    total_cost: ReturnType<typeof formatMoney>;
}

export function formatMetrics(item: StatsMetrics): StatsMetricsFormatted {
    return {
        input_token: formatCount(item.input_token),
        cache_read_token: formatCount(item.cache_read_token),
        cache_write_token: formatCount(item.cache_write_token),
        output_token: formatCount(item.output_token),
        input_cost: formatMoney(item.input_cost),
        cache_read_cost: formatMoney(item.cache_read_cost),
        cache_write_cost: formatMoney(item.cache_write_cost),
        output_cost: formatMoney(item.output_cost),
        request_success: formatCount(item.request_success),
        request_failed: formatCount(item.request_failed),
        request_count: formatCount(item.request_success + item.request_failed),
        total_token: formatCount(item.input_token + item.cache_read_token + item.cache_write_token + item.output_token),
        total_cost: formatMoney(item.input_cost + item.cache_read_cost + item.cache_write_cost + item.output_cost),
    };
}

export interface StatsChannel extends StatsMetrics {
    channel_id: number;
}

/**
 * 密钥侧统计格式化(销售侧计价,使用硬币单位,不带美元符号)
 */
export interface StatsMetricsFormattedCoin {
    input_token: ReturnType<typeof formatCount>;
    cache_read_token: ReturnType<typeof formatCount>;
    cache_write_token: ReturnType<typeof formatCount>;
    output_token: ReturnType<typeof formatCount>;
    input_cost: ReturnType<typeof formatCount>;
    cache_read_cost: ReturnType<typeof formatCount>;
    cache_write_cost: ReturnType<typeof formatCount>;
    output_cost: ReturnType<typeof formatCount>;
    request_success: ReturnType<typeof formatCount>;
    request_failed: ReturnType<typeof formatCount>;

    request_count: ReturnType<typeof formatCount>;
    total_token: ReturnType<typeof formatCount>;
    total_cost: ReturnType<typeof formatCount>;
}

export function formatMetricsCoin(item: StatsMetrics): StatsMetricsFormattedCoin {
    return {
        input_token: formatCount(item.input_token),
        cache_read_token: formatCount(item.cache_read_token),
        cache_write_token: formatCount(item.cache_write_token),
        output_token: formatCount(item.output_token),
        input_cost: formatCount(item.input_cost),
        cache_read_cost: formatCount(item.cache_read_cost),
        cache_write_cost: formatCount(item.cache_write_cost),
        output_cost: formatCount(item.output_cost),
        request_success: formatCount(item.request_success),
        request_failed: formatCount(item.request_failed),
        request_count: formatCount(item.request_success + item.request_failed),
        total_token: formatCount(item.input_token + item.cache_read_token + item.cache_write_token + item.output_token),
        total_cost: formatCount(item.input_cost + item.cache_read_cost + item.cache_write_cost + item.output_cost),
    };
}

export interface StatsDaily extends StatsMetrics {
    date: string;
}
export interface StatsDailyFormatted extends StatsMetricsFormatted {
    date: string;
}

export interface StatsTotal extends StatsMetrics {
    id: number;
}
export type StatsTotalFormatted = StatsMetricsFormatted;

export interface StatsHourly extends StatsMetrics {
    hour: number;
    date: string;
}
export interface StatsHourlyFormatted extends StatsMetricsFormatted {
    hour: number;
    date: string;
}
/**
 * API Key 统计数据
 */
export interface StatsAPIKey extends StatsMetrics {
    api_key_id: number;
}

export interface StatsAPIKeyFormatted extends StatsMetricsFormattedCoin {
    api_key_id: number;
}
/**
 * 获取今日统计数据 Hook
 */
export function useStatsToday() {
    return useQuery({
        queryKey: ['stats', 'today'],
        queryFn: async () => {
            return apiClient.get<StatsDaily>('/api/v1/stats/today');
        },
        refetchInterval: 30000,
        refetchOnMount: 'always',
    });
}

/**
 * 获取每日统计数据 Hook
 */
export function useStatsDaily() {
    return useQuery({
        queryKey: ['stats', 'daily'],
        queryFn: async () => {
            return apiClient.get<StatsDaily[]>('/api/v1/stats/daily');
        },
        select: (data) => data.map((item): StatsDailyFormatted => ({
            ...formatMetrics(item),
            date: item.date,
        })),
        refetchInterval: 3600000, // 1 小时
        refetchOnMount: 'always',
    });
}
/**
 * 获取总统计数据 Hook
 */
export function useStatsHourly() {
    return useQuery({
        queryKey: ['stats', 'hourly'],
        queryFn: async () => {
            return apiClient.get<StatsHourly[]>('/api/v1/stats/hourly');
        },
        select: (data) => data.map((item): StatsHourlyFormatted => ({
            ...formatMetrics(item),
            hour: item.hour,
            date: item.date,
        })),
        refetchInterval: 10000,// 10 秒
        refetchOnMount: 'always',
    });
}

export function useStatsTotal() {
    return useQuery({
        queryKey: ['stats', 'total'],
        queryFn: async () => {
            return apiClient.get<StatsTotal>('/api/v1/stats/total');
        },
        select: formatMetrics,
        refetchInterval: 10000,// 10 秒
        refetchOnMount: 'always',
    });
}

/**
 * 获取 API Key 统计数据列表 Hook
 */
export function useStatsAPIKey() {
    return useQuery({
        queryKey: ['stats', 'apikey'],
        queryFn: async () => {
            return apiClient.get<StatsAPIKey[]>('/api/v1/stats/apikey');
        },
        select: (data) => data.map((item): StatsAPIKeyFormatted => ({
            ...formatMetricsCoin(item),
            api_key_id: item.api_key_id,
        })),
        refetchInterval: 30000,
        refetchOnMount: 'always',
    });
}

export interface StatsRealtime {
    window_seconds: number;
    request_count: number;
    total_tokens: number;
}

export interface StatsBreaker {
    total: number;
    healthy: number;
}

export function useStatsBreaker() {
    return useQuery({
        queryKey: ['stats', 'breaker'],
        queryFn: async () => {
            return apiClient.get<StatsBreaker>('/api/v1/stats/breaker');
        },
        refetchInterval: 10000,
        refetchOnMount: 'always',
    });
}

export function useStatsRealtime() {
    return useQuery({
        queryKey: ['stats', 'realtime'],
        queryFn: async () => {
            return apiClient.get<StatsRealtime>('/api/v1/stats/realtime');
        },
        refetchInterval: 5000,
        refetchOnMount: 'always',
    });
}
