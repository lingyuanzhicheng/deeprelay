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
    const sortField = useToolbarViewOptionsStore((s) => s.getSortField(pageKey));
    const sortOrder = useToolbarViewOptionsStore((s) => s.getSortOrder(pageKey));
    const filter = useToolbarViewOptionsStore((s) => s.channelFilter);

    const sortedChannels = useMemo(() => {
        if (!channelsData) return [];
        return [...channelsData].sort((a, b) => {
            const diff = sortField === 'name'
                ? a.raw.name.localeCompare(b.raw.name)
                : a.raw.id - b.raw.id;
            return sortOrder === 'asc' ? diff : -diff;
        });
    }, [channelsData, sortField, sortOrder]);

    const visibleChannels = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        const byName = !term ? sortedChannels : sortedChannels.filter((c) => c.raw.name.toLowerCase().includes(term));

        if (filter === 'enabled') return byName.filter((c) => c.raw.enabled);
        if (filter === 'disabled') return byName.filter((c) => !c.raw.enabled);

        return byName;
    }, [sortedChannels, searchTerm, filter]);

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
            columns={{ default: 1, md: 2, lg: 3 }}
            estimateItemHeight={220}
            getItemKey={(item) => `model-channel-${item.raw.id}`}
            renderItem={(item) => (
                <ChannelCard channel={item.raw} />
            )}
        />
    );
}
