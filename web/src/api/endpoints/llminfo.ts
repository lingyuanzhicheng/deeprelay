import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { logger } from '@/lib/logger';
import { StatsMetrics } from './stats';

/**
 * 模型信息（llminfo，1:1 关联 group）
 */
export interface LLMInfo {
    id?: number;
    group_id: number;

    lab: string;
    family: string;
    endpoint: string;
    context_limit: string;
    output_limit: string;
    input_type: string;
    output_type: string;

    tools: boolean;
    reasoning: boolean;
    structured: boolean;
    temperature: boolean;

    input_price: number;
    output_price: number;
    cache_read_price: number;
    cache_write_price: number;

    instruction: string;
}

/**
 * 模型页列表项（llminfo 平铺字段 + group 名称 + 按模型聚合统计）
 */
export interface LLMInfoItem extends LLMInfo {
    group_name: string;
    stats: StatsMetrics;
}

export function emptyLLMInfo(groupId: number): LLMInfo {
    return {
        group_id: groupId,
        lab: '',
        family: '',
        endpoint: '',
        context_limit: '',
        output_limit: '',
        input_type: '',
        output_type: '',
        tools: false,
        reasoning: false,
        structured: false,
        temperature: false,
        input_price: 0,
        output_price: 0,
        cache_read_price: 0,
        cache_write_price: 0,
        instruction: '',
    };
}

/**
 * 获取模型信息列表 Hook
 */
export function useLLMInfoList() {
    return useQuery({
        queryKey: ['llminfo', 'list'],
        queryFn: async () => {
            return apiClient.get<LLMInfoItem[]>('/api/v1/llminfo/list');
        },
        refetchInterval: 30000,
        refetchOnMount: 'always',
    });
}

/**
 * 更新模型信息 Hook（以 group_id 为业务键 upsert）
 */
export function useUpdateLLMInfo() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: LLMInfo) => {
            return apiClient.post<LLMInfo>('/api/v1/llminfo/update', data);
        },
        onSuccess: () => {
            logger.log('模型信息更新成功');
            queryClient.invalidateQueries({ queryKey: ['llminfo', 'list'] });
        },
        onError: (error) => {
            logger.error('模型信息更新失败:', error);
        },
    });
}
