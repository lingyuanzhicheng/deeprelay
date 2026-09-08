'use client';

import { memo, useCallback, useState } from 'react';
import { Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type Channel } from '@/api/endpoints/channel';
import { useChannelLLMPriceList } from '@/api/endpoints/channel_llm_price';
import { Badge } from '@/components/ui/badge';
import {
    MorphingDialog,
    MorphingDialogTrigger,
    MorphingDialogContainer,
    MorphingDialogContent,
} from '@/components/ui/morphing-dialog';
import { PriceListContent } from './PriceListContent';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/animate-ui/components/animate/tooltip';

interface ChannelCardProps {
    channel: Channel;
}

export const ChannelCard = memo(function ChannelCard({ channel }: ChannelCardProps) {
    const t = useTranslations('model');
    const { data: prices = [] } = useChannelLLMPriceList(channel.id);
    const [isOpen, setIsOpen] = useState(false);
    const [editingModelName, setEditingModelName] = useState<string | null>(null);

    const handleOpenChange = useCallback((next: boolean) => {
        setIsOpen(next);
        if (!next) setEditingModelName(null);
    }, []);

    const isEditing = editingModelName !== null;

    return (
        <MorphingDialog open={isOpen} onOpenChange={handleOpenChange}>
            <MorphingDialogTrigger className="w-full">
                <article className="flex flex-col gap-4 rounded-3xl border border-border bg-card text-card-foreground p-4 transition-all duration-300 hover:border-primary/30">
                    <header className="relative flex items-center justify-between gap-2">
                        <Tooltip side="top" sideOffset={10} align="center">
                            <TooltipTrigger asChild>
                                <h3 className="text-lg font-bold truncate min-w-0">{channel.name}</h3>
                            </TooltipTrigger>
                            <TooltipContent key={channel.name}>{channel.name}</TooltipContent>
                        </Tooltip>
                        {channel.enabled ? (
                            <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shrink-0">
                                {t('card.enabled')}
                            </Badge>
                        ) : (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground shrink-0">
                                {t('card.disabled')}
                            </Badge>
                        )}
                    </header>

                    <dl className="grid grid-cols-1 gap-3">
                        <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 p-2">
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Layers className="h-5 w-5" />
                                </span>
                                <dt className="text-sm text-muted-foreground">{t('card.totalModels')}</dt>
                            </div>
                            <dd className="text-base font-semibold">{prices.length}</dd>
                        </div>
                    </dl>
                </article>
            </MorphingDialogTrigger>

            <MorphingDialogContainer>
                <MorphingDialogContent
                    enableLayout
                    className={
                        isEditing
                            ? 'w-full md:max-w-md bg-card text-card-foreground px-4 py-2 rounded-3xl max-h-[90vh] overflow-y-auto'
                            : 'w-full md:max-w-3xl bg-card text-card-foreground px-4 py-2 rounded-3xl max-h-[90vh] overflow-y-auto'
                    }
                >
                    <PriceListContent
                        channelId={channel.id}
                        channelName={channel.name}
                        editingModelName={editingModelName}
                        onEditingModelNameChange={setEditingModelName}
                    />
                </MorphingDialogContent>
            </MorphingDialogContainer>
        </MorphingDialog>
    );
});
