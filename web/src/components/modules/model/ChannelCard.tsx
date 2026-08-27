'use client';

import { memo } from 'react';
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
    layout?: 'grid' | 'list';
}

export const ChannelCard = memo(function ChannelCard({ channel, layout = 'grid' }: ChannelCardProps) {
    const t = useTranslations('model');
    const isListLayout = layout === 'list';
    const { data: prices = [] } = useChannelLLMPriceList(channel.id);

    return (
        <MorphingDialog>
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

                    {isListLayout ? (
                        <dl className="grid grid-cols-1 gap-2">
                            <div className="rounded-2xl border border-border/70 bg-background/80 p-2 flex items-center justify-between">
                                <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Layers className="size-3.5 text-primary" />
                                    {t('card.totalModels')}
                                </dt>
                                <dd className="text-sm font-semibold">{prices.length}</dd>
                            </div>
                        </dl>
                    ) : (
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
                    )}
                </article>
            </MorphingDialogTrigger>

            <MorphingDialogContainer>
                <MorphingDialogContent className="w-full md:max-w-3xl bg-card text-card-foreground px-4 py-2 rounded-3xl max-h-[90vh] overflow-y-auto">
                    <PriceListContent channelId={channel.id} channelName={channel.name} />
                </MorphingDialogContent>
            </MorphingDialogContainer>
        </MorphingDialog>
    );
});
