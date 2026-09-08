'use client';

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useLLMInfoList } from '@/api/endpoints/llminfo';
import { useSearchStore, useToolbarViewOptionsStore } from '@/components/modules/toolbar';
import { VirtualizedGrid } from '@/components/common/VirtualizedGrid';
import { ModelCard } from './ModelCard';

export function LLMInfo() {
    const { data: items, isLoading } = useLLMInfoList();
    const pageKey = 'llminfo' as const;
    const searchTerm = useSearchStore((s) => s.getSearchTerm(pageKey));
    const sortField = useToolbarViewOptionsStore((s) => s.getSortField(pageKey));
    const sortOrder = useToolbarViewOptionsStore((s) => s.getSortOrder(pageKey));

    const sortedItems = useMemo(() => {
        if (!items) return [];
        return [...items].sort((a, b) => {
            const diff = sortField === 'name'
                ? a.group_name.localeCompare(b.group_name)
                : (a.id ?? 0) - (b.id ?? 0);
            return sortOrder === 'asc' ? diff : -diff;
        });
    }, [items, sortField, sortOrder]);

    const visibleItems = useMemo(() => {
        if (!sortedItems) return [];
        const term = searchTerm.toLowerCase().trim();
        if (!term) return sortedItems;
        return sortedItems.filter((item) =>
            item.group_name.toLowerCase().includes(term) ||
            item.family.toLowerCase().includes(term) ||
            item.lab.toLowerCase().includes(term)
        );
    }, [sortedItems, searchTerm]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <VirtualizedGrid
            items={visibleItems}
            columns={{ default: 1, md: 2, lg: 3 }}
            estimateItemHeight={140}
            getItemKey={(item) => `llminfo-${item.group_id}`}
            renderItem={(item) => (
                <ModelCard item={item} />
            )}
        />
    );
}
