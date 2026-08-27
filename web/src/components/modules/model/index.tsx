'use client';

import { useMemo } from 'react';
import { useChannelList } from '@/api/endpoints/channel';
import { ChannelCard } from './ChannelCard';
import { useSearchStore, useToolbarViewOptionsStore } from '@/components/modules/toolbar';
import { VirtualizedGrid } from '@/components/common/VirtualizedGrid';
import { Loader2 } from 'lucide-react';

export function Model() {
    const { data: channelsData, isLoading } = useChannelList();
    const pageKey = 'model' as const;
    const searchTerm = useSearchStore((s) => s.getSearchTerm(pageKey));
    const layout = useToolbarViewOptionsStore((s) => s.getLayout(pageKey));
    const sortOrder = useToolbarViewOptionsStore((s) => s.getSortOrder(pageKey));

    const sortedChannels = useMemo(() => {
        if (!channelsData) return [];
        return [...channelsData].sort((a, b) =>
            sortOrder === 'asc'
                ? a.raw.name.localeCompare(b.raw.name)
                : b.raw.name.localeCompare(a.raw.name),
        );
    }, [channelsData, sortOrder]);

    const visibleChannels = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return sortedChannels;
        return sortedChannels.filter((c) => c.raw.name.toLowerCase().includes(term));
    }, [sortedChannels, searchTerm]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <VirtualizedGrid
            items={visibleChannels}
            layout={layout}
            columns={{ default: 1, md: 2, lg: 3 }}
            estimateItemHeight={220}
            getItemKey={(item) => `model-channel-${item.raw.id}`}
            renderItem={(item) => (
                <ChannelCard channel={item.raw} layout={layout} />
            )}
        />
    );
}
