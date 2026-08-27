import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { logger } from '@/lib/logger';
import { AutoGroupType } from './channel';

/**
 * 渠道模型价格记录
 */
export interface ChannelLLMPrice {
    id: number;
    channel_id: number;
    model_name: string;
    input: number;
    output: number;
    cache_read: number;
    cache_write: number;
    bind_provider?: string;
    bind_model_id?: string;
}

/**
 * 单条绑定项
 */
export interface ChannelLLMPriceBind {
    model_name: string;
    provider: string;
    model_id: string;
}

/**
 * modelsdev 模型项（OpenAI 兼容格式）
 */
export interface ModelsDevModel {
    id: string;
    object: string;
    owned_by: string;
}

const QUERY_KEY = 'channel-llm-price';

/**
 * 获取某渠道下的所有模型价格列表
 */
export function useChannelLLMPriceList(channelId: number | null) {
    return useQuery({
        queryKey: [QUERY_KEY, 'list', channelId],
        queryFn: async () => {
            if (channelId == null) return [];
            return apiClient.get<ChannelLLMPrice[]>('/api/v1/channel-llm-price/list', {
                channel_id: channelId,
            });
        },
        enabled: channelId != null,
        refetchInterval: 30000,
    });
}

/**
 * 单条 upsert（增改价格）
 */
export function useChannelLLMPriceUpsert() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: ChannelLLMPrice) => {
            return apiClient.post<ChannelLLMPrice>('/api/v1/channel-llm-price/upsert', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] });
        },
        onError: (error) => {
            logger.error('渠道价格 upsert 失败:', error);
        },
    });
}

/**
 * 批量 upsert
 */
export function useChannelLLMPriceBatchUpsert() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (items: ChannelLLMPrice[]) => {
            return apiClient.post<null>('/api/v1/channel-llm-price/batch-upsert', { items });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] });
        },
        onError: (error) => {
            logger.error('渠道价格批量 upsert 失败:', error);
        },
    });
}

/**
 * 删除单条
 */
export function useChannelLLMPriceDelete() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (params: { channel_id: number; model_name: string }) => {
            return apiClient.post<null>('/api/v1/channel-llm-price/delete', params);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] });
        },
        onError: (error) => {
            logger.error('渠道价格删除失败:', error);
        },
    });
}

/**
 * 单条绑定
 */
export function useChannelLLMPriceBind() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (params: {
            channel_id: number;
            model_name: string;
            provider: string;
            model_id: string;
        }) => {
            return apiClient.post<null>('/api/v1/channel-llm-price/bind', params);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] });
        },
        onError: (error) => {
            logger.error('渠道价格绑定失败:', error);
        },
    });
}

/**
 * 批量绑定
 */
export function useChannelLLMPriceBatchBind() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (params: {
            channel_id: number;
            items: ChannelLLMPriceBind[];
        }) => {
            return apiClient.post<null>('/api/v1/channel-llm-price/batch-bind', params);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] });
        },
        onError: (error) => {
            logger.error('渠道价格批量绑定失败:', error);
        },
    });
}

/**
 * 自动匹配（按 provider + mode 在 modelsdev 中匹配模型名并写绑定+同步价格）
 */
export function useChannelLLMPriceAutoMatch() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (params: {
            channel_id: number;
            model_names: string[];
            provider: string;
            mode: number; // 1=Fuzzy, 2=Exact
        }) => {
            return apiClient.post<{ matched: number }>(
                '/api/v1/channel-llm-price/auto-match',
                params,
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] });
        },
        onError: (error) => {
            logger.error('渠道价格自动匹配失败:', error);
        },
    });
}

/**
 * 触发某渠道 modelsdev 同步（按已有绑定更新价格）
 */
export function useChannelLLMPriceSyncModelsDev() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (channelId: number) => {
            return apiClient.post<null>(
                '/api/v1/channel-llm-price/sync-modelsdev',
                undefined,
                { channel_id: channelId },
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] });
        },
        onError: (error) => {
            logger.error('modelsdev 同步失败:', error);
        },
    });
}

/**
 * 触发全部渠道 modelsdev 同步（设置页手动更新按钮）
 */
export function useChannelLLMPriceSyncAllModelsDev() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            return apiClient.post<null>('/api/v1/channel-llm-price/sync-all-modelsdev', {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] });
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'last-sync-time'] });
        },
        onError: (error) => {
            logger.error('modelsdev 全量同步失败:', error);
        },
    });
}

/**
 * 获取上次 modelsdev 同步时间
 */
export function useLLMPriceLastSyncTime() {
    return useQuery({
        queryKey: [QUERY_KEY, 'last-sync-time'],
        queryFn: async () => {
            return apiClient.get<string>('/api/v1/channel-llm-price/last-sync-time');
        },
        refetchInterval: 30000,
    });
}

/**
 * 获取 modelsdev provider 列表
 */
export function useModelsDevProviders() {
    return useQuery({
        queryKey: [QUERY_KEY, 'modelsdev-providers'],
        queryFn: async () => {
            return apiClient.get<string[]>('/api/v1/channel-llm-price/modelsdev/providers');
        },
        staleTime: 5 * 60 * 1000, // provider 列表稳定，5 分钟缓存
    });
}

/**
 * 获取某 provider 下 modelsdev 模型列表
 */
export function useModelsDevModels(provider: string | null) {
    return useQuery({
        queryKey: [QUERY_KEY, 'modelsdev-models', provider],
        queryFn: async () => {
            if (!provider) return [];
            return apiClient.get<ModelsDevModel[]>(
                '/api/v1/channel-llm-price/modelsdev/models',
                { provider },
            );
        },
        enabled: !!provider,
        staleTime: 5 * 60 * 1000,
    });
}

export function useModelsDevInitData() {
    const queryClient = useQueryClient();
    const providersQuery = useModelsDevProviders();
    return {
        providers: providersQuery.data ?? [],
        isLoading: providersQuery.isLoading,
        prefetch: () => queryClient.prefetchQuery({
            queryKey: [QUERY_KEY, 'modelsdev-providers'],
            queryFn: () => apiClient.get<string[]>('/api/v1/channel-llm-price/modelsdev/providers'),
        }),
    };
}

// 便捷重导出：与 channel.ts 的 AutoGroupType 一致，供价格页选择匹配模式
export { AutoGroupType };
