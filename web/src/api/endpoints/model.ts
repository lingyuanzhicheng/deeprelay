import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

/**
 * LLM 价格信息
 */
export interface LLMPrice {
    input: number;
    output: number;
    cache_read: number;
    cache_write: number;
}

/**
 * LLM 模型信息（保留旧表，Q6：旧 LLMInfo 表/数据暂留）
 */
export interface LLMInfo extends LLMPrice {
    name: string;
}

/**
 * LLM 渠道关联信息
 * 用于价格页渠道卡片渲染（与 group 的渠道模型列表来源一致，Q3）
 */
export interface LLMChannel {
    name: string;
    enabled: boolean;
    channel_id: number;
    channel_name: string;
}

/**
 * 获取 LLM 模型与渠道关联列表 Hook
 *
 * @example
 * const { data: channelModels, isLoading, error } = useModelChannelList();
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error.message} />;
 *
 * channelModels?.forEach(item => console.log(item.name, item.channel_name));
 */
export function useModelChannelList() {
    return useQuery({
        queryKey: ['models', 'channel'],
        queryFn: async () => {
            return apiClient.get<LLMChannel[]>('/api/v1/model/channel');
        },
        refetchInterval: 30000,
    });
}
