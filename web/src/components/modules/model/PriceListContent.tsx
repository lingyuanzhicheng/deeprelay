'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
    RefreshCw,
    Link2,
    Loader2,
    Sparkles,
    RotateCcw,
    Pencil,
    Undo2,
    Check,
    ArrowDownToLine,
    ArrowUpFromLine,
    Wand2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
    useChannelLLMPriceList,
    useChannelLLMPriceUpsert,
    useChannelLLMPriceBind,
    useChannelLLMPriceSyncModelsDev,
    useChannelLLMPriceAutoMatch,
    AutoGroupType,
    type ChannelLLMPrice,
} from '@/api/endpoints/channel_llm_price';
import { toast } from '@/components/common/Toast';
import { getModelIcon } from '@/lib/model-icons';
import { cn } from '@/lib/utils';
import {
    MorphingDialogClose,
    MorphingDialogTitle,
    MorphingDialogDescription,
} from '@/components/ui/morphing-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/animate-ui/components/animate/tooltip';
import { PriceEditDialog } from './PriceEditDialog';
import { useModelsDevFetch } from './useModelsDevFetch';

interface PriceListContentProps {
    channelId: number;
    channelName: string;
}

export function PriceListContent({ channelId, channelName }: PriceListContentProps) {
    const t = useTranslations('model');
    const { data: prices = [], isLoading } = useChannelLLMPriceList(channelId);
    const upsert = useChannelLLMPriceUpsert();
    const bind = useChannelLLMPriceBind();
    const sync = useChannelLLMPriceSyncModelsDev();
    const autoMatch = useChannelLLMPriceAutoMatch();

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [autoMatchExpanded, setAutoMatchExpanded] = useState(false);
    const [autoMatchProvider, setAutoMatchProvider] = useState('');
    const [autoMatchMode, setAutoMatchMode] = useState<number>(AutoGroupType.Fuzzy);
    const [editingPrice, setEditingPrice] = useState<ChannelLLMPrice | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editAnchorRect, setEditAnchorRect] = useState<DOMRect | null>(null);

    const allSelected = prices.length > 0 && prices.every((p) => selected.has(p.model_name));

    const toggleSelect = useCallback((name: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    }, []);

    const toggleSelectAll = useCallback(() => {
        if (allSelected) setSelected(new Set());
        else setSelected(new Set(prices.map((p) => p.model_name)));
    }, [allSelected, prices]);

    const handleBatchUnbind = useCallback(() => {
        if (selected.size === 0) return;
        Array.from(selected).forEach((name) => {
            bind.mutate({
                channel_id: channelId,
                model_name: name,
                provider: '',
                model_id: '',
            });
        });
        toast.success(t('toast.batchUnbound', { count: selected.size }));
        setSelected(new Set());
    }, [selected, channelId, bind, t]);

    const handleBatchReset = useCallback(() => {
        if (selected.size === 0) return;
        Array.from(selected).forEach((name) => {
            const price = prices.find((p) => p.model_name === name);
            if (!price) return;
            upsert.mutate({
                ...price,
                channel_id: channelId,
                input: 0,
                output: 0,
                cache_read: 0,
                cache_write: 0,
                bind_provider: '',
                bind_model_id: '',
            });
        });
        toast.success(t('toast.batchReset', { count: selected.size }));
        setSelected(new Set());
    }, [selected, prices, channelId, upsert, t]);

    const handleOpenEdit = useCallback((price: ChannelLLMPrice, e: React.MouseEvent) => {
        const target = e.currentTarget as HTMLElement;
        setEditAnchorRect(target.getBoundingClientRect());
        setEditingPrice(price);
        setEditDialogOpen(true);
    }, []);

    const handleCloseEdit = useCallback(() => {
        setEditDialogOpen(false);
    }, []);

    const handleEditExited = useCallback(() => {
        setEditingPrice(null);
        setEditAnchorRect(null);
    }, []);

    const handleUnbind = useCallback(
        (price: ChannelLLMPrice) => {
            bind.mutate(
                {
                    channel_id: channelId,
                    model_name: price.model_name,
                    provider: '',
                    model_id: '',
                },
                {
                    onSuccess: () => toast.success(t('toast.unbound')),
                    onError: (e) => toast.error(t('toast.unbindFailed'), { description: e.message }),
                },
            );
        },
        [channelId, bind, t],
    );

    const handleReset = useCallback(
        (price: ChannelLLMPrice) => {
            upsert.mutate(
                {
                    ...price,
                    channel_id: channelId,
                    input: 0,
                    output: 0,
                    cache_read: 0,
                    cache_write: 0,
                    bind_provider: '',
                    bind_model_id: '',
                },
                {
                    onSuccess: () => toast.success(t('toast.resetDone')),
                    onError: (e) => toast.error(t('toast.updateFailed'), { description: e.message }),
                },
            );
        },
        [channelId, upsert, t],
    );

    const handleBatchAutoMatch = useCallback(() => {
        if (selected.size === 0 || !autoMatchProvider) return;
        autoMatch.mutate(
            {
                channel_id: channelId,
                model_names: Array.from(selected),
                provider: autoMatchProvider,
                mode: autoMatchMode,
            },
            {
                onSuccess: (data) => {
                    const matched = data?.matched ?? 0;
                    toast.success(t('toast.matchedCount', { count: matched }));
                    if (matched > 0) setSelected(new Set());
                },
                onError: (e) => toast.error(t('toast.autoMatchFailed'), { description: e.message }),
            },
        );
    }, [selected, channelId, autoMatchProvider, autoMatchMode, autoMatch, t]);

    return (
        <>
            <MorphingDialogTitle className="shrink-0">
                <header className="mb-3 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-card-foreground">
                        {channelName}
                    </h2>
                    <MorphingDialogClose className="relative right-0 top-0" />
                </header>
            </MorphingDialogTitle>
            <MorphingDialogDescription className="flex flex-col gap-3 px-2 pb-4">
                {/* top bar: select-all (left) + auto-bind/unbind/reset (right) */}
                <div className="flex items-center justify-between gap-2 px-1">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleSelectAll}
                            className={cn(
                                'h-4 w-4 rounded border flex items-center justify-center transition-colors',
                                allSelected ? 'bg-primary border-primary' : 'border-border hover:border-primary',
                            )}
                        >
                            {allSelected && <Check className="size-2.5 text-primary-foreground" />}
                        </button>
                        <span className="text-[10px] text-muted-foreground">{t('drawer.selectAll')}</span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                        <button
                            onClick={() => setAutoMatchExpanded((v) => !v)}
                            className={cn(
                                'h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors',
                                autoMatchExpanded
                                    ? 'bg-primary/20 text-primary'
                                    : 'bg-primary/10 text-primary hover:bg-primary/20',
                            )}
                        >
                            <Wand2 className="size-3" />
                            {t('drawer.batchAutoMatch')}
                        </button>
                        <button
                            onClick={handleBatchUnbind}
                            disabled={selected.size === 0 || bind.isPending}
                            className="h-7 px-2.5 rounded-md bg-muted/40 text-muted-foreground text-xs font-medium hover:bg-muted/60 transition-colors disabled:opacity-30 inline-flex items-center gap-1"
                        >
                            <Undo2 className="size-3" />
                            {t('card.unbind')}
                        </button>
                        <button
                            onClick={handleBatchReset}
                            disabled={selected.size === 0 || upsert.isPending}
                            className="h-7 px-2.5 rounded-md bg-muted/40 text-muted-foreground text-xs font-medium hover:bg-muted/60 transition-colors disabled:opacity-30 inline-flex items-center gap-1"
                        >
                            <RotateCcw className="size-3" />
                            {t('card.reset')}
                        </button>
                    </div>
                </div>

                {/* auto-match slide-out panel (expands below top bar) */}
                <AnimatePresence initial={false}>
                    {autoMatchExpanded && (
                        <AutoMatchSlideOut
                            key="auto-match-slideout"
                            channelId={channelId}
                            selectedCount={selected.size}
                            autoMatchProvider={autoMatchProvider}
                            setAutoMatchProvider={setAutoMatchProvider}
                            autoMatchMode={autoMatchMode}
                            setAutoMatchMode={setAutoMatchMode}
                            onMatch={handleBatchAutoMatch}
                            isMatching={autoMatch.isPending}
                            t={t}
                        />
                    )}
                </AnimatePresence>

                {/* row list */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                ) : prices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <p className="text-sm">{t('drawer.empty')}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        {prices.map((price, index) => (
                            <PriceRow
                                key={price.model_name}
                                price={price}
                                index={index}
                                isSelected={selected.has(price.model_name)}
                                isUpserting={upsert.isPending}
                                isBinding={bind.isPending}
                                onToggleSelect={() => toggleSelect(price.model_name)}
                                onEdit={(e) => handleOpenEdit(price, e)}
                                onUnbind={() => handleUnbind(price)}
                                onReset={() => handleReset(price)}
                                t={t}
                            />
                        ))}
                    </div>
                )}
            </MorphingDialogDescription>

            <PriceEditDialog
                open={editDialogOpen}
                channelId={channelId}
                price={editingPrice}
                anchorRect={editAnchorRect}
                onClose={handleCloseEdit}
                onExitComplete={handleEditExited}
            />
        </>
    );
}

// ---- AutoMatch slide-out panel ----

interface AutoMatchSlideOutProps {
    channelId: number;
    selectedCount: number;
    autoMatchProvider: string;
    setAutoMatchProvider: (v: string) => void;
    autoMatchMode: number;
    setAutoMatchMode: (m: number) => void;
    onMatch: () => void;
    isMatching: boolean;
    t: ReturnType<typeof useTranslations<'model'>>;
}

function AutoMatchSlideOut({
    selectedCount,
    autoMatchProvider,
    setAutoMatchProvider,
    autoMatchMode,
    setAutoMatchMode,
    onMatch,
    isMatching,
    t,
}: AutoMatchSlideOutProps) {
    const md = useModelsDevFetch();
    const [providerFocused, setProviderFocused] = useState(false);
    const [showSuggest, setShowSuggest] = useState(false);

    const handleFocus = () => {
        setProviderFocused(true);
        md.ensureLoaded();
        setShowSuggest(true);
    };

    const suggestions = useMemo(
        () => md.getProviderSuggestions(autoMatchProvider),
        [md, autoMatchProvider],
    );

    return (
        <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="overflow-hidden"
        >
            <div className="rounded-lg border border-border/50 bg-background px-2.5 py-2 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                    <Sparkles className="size-3.5 text-primary" />
                    <span className="text-xs font-medium">{t('drawer.provider')}</span>
                </div>
                {/* provider input */}
                <div className="relative flex-1 min-w-[160px]">
                    <input
                        value={autoMatchProvider}
                        onChange={(e) => setAutoMatchProvider(e.target.value)}
                        onFocus={handleFocus}
                        onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                        placeholder={t('drawer.selectProvider')}
                        className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    {/* loading spinner */}
                    {md.loading && (
                        <Loader2 className="size-3 animate-spin text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2" />
                    )}
                    {/* suggestions dropdown */}
                    {showSuggest && !md.loading && suggestions.length > 0 && (
                        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                            {suggestions.slice(0, 50).map((p) => (
                                <button
                                    key={p}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        setAutoMatchProvider(p);
                                        setShowSuggest(false);
                                    }}
                                    className="block w-full text-left px-2 py-1 text-xs hover:bg-accent/10 truncate"
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {/* fuzzy / exact toggle */}
                <div className="flex items-center gap-0.5 shrink-0">
                    <button
                        onClick={() => setAutoMatchMode(AutoGroupType.Fuzzy)}
                        className={cn(
                            'h-7 px-2 rounded-md border text-xs font-medium transition-colors',
                            autoMatchMode === AutoGroupType.Fuzzy
                                ? 'border-primary/30 bg-primary text-primary-foreground'
                                : 'border-border bg-muted/20 hover:bg-muted/30',
                        )}
                    >
                        {t('drawer.fuzzy')}
                    </button>
                    <button
                        onClick={() => setAutoMatchMode(AutoGroupType.Exact)}
                        className={cn(
                            'h-7 px-2 rounded-md border text-xs font-medium transition-colors',
                            autoMatchMode === AutoGroupType.Exact
                                ? 'border-primary/30 bg-primary text-primary-foreground'
                                : 'border-border bg-muted/20 hover:bg-muted/30',
                        )}
                    >
                        {t('drawer.exact')}
                    </button>
                </div>
                <button
                    onClick={onMatch}
                    disabled={selectedCount === 0 || isMatching || !autoMatchProvider}
                    className="h-7 px-2.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-30 inline-flex items-center gap-1 shrink-0"
                >
                    {isMatching ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                    {t('drawer.startMatch')}
                </button>
            </div>
        </motion.div>
    );
}

// ---- PriceRow: compact single row with all 8 fields + 3 buttons (unbind, reset, edit[最右]) ----

interface PriceRowProps {
    price: ChannelLLMPrice;
    index: number;
    isSelected: boolean;
    isUpserting: boolean;
    isBinding: boolean;
    onToggleSelect: () => void;
    onEdit: (e: React.MouseEvent) => void;
    onUnbind: () => void;
    onReset: () => void;
    t: ReturnType<typeof useTranslations<'model'>>;
}

function PriceRow({
    price,
    index,
    isSelected,
    isUpserting,
    isBinding,
    onToggleSelect,
    onEdit,
    onUnbind,
    onReset,
    t,
}: PriceRowProps) {
    const { Avatar: ModelAvatar } = getModelIcon(price.model_name);
    const isBound = !!(price.bind_provider && price.bind_model_id);

    return (
        <motion.div layout className="rounded-lg bg-background border border-border/50 overflow-hidden">
            <div className="flex items-center gap-2 px-2.5 py-2 select-none">
                {/* checkbox */}
                <button
                    onClick={onToggleSelect}
                    className={cn(
                        'h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors',
                        isSelected ? 'bg-primary border-primary' : 'border-border hover:border-primary',
                    )}
                >
                    {isSelected && <Check className="size-2.5 text-primary-foreground" />}
                </button>

                {/* index */}
                <span className="size-5 rounded-md text-[10px] font-bold grid place-items-center shrink-0 bg-primary/10 text-primary">
                    {index + 1}
                </span>

                {/* avatar */}
                <ModelAvatar size={18} />

                {/* model name + binding info */}
                <div className="flex flex-col min-w-0 flex-1">
                    <Tooltip side="top" sideOffset={6} align="start">
                        <TooltipTrigger className="text-sm font-medium truncate leading-tight">
                            {price.model_name}
                        </TooltipTrigger>
                        <TooltipContent key={price.model_name}>{price.model_name}</TooltipContent>
                    </Tooltip>
                    <span className="text-[10px] text-muted-foreground truncate leading-tight inline-flex items-center gap-0.5">
                        {isBound ? (
                            <>
                                <Link2 className="size-2.5" />
                                {price.bind_provider}/{price.bind_model_id}
                            </>
                        ) : (
                            t('drawer.unbound')
                        )}
                    </span>
                </div>

                {/* prices: input/output/cache_write/cache_read */}
                <div className="hidden lg:flex items-center gap-3 text-[11px] tabular-nums shrink-0">
                    <span className="inline-flex items-center gap-0.5 text-muted-foreground" title={t('overlay.input')}>
                        <ArrowDownToLine className="size-3" />
                        <span className="text-card-foreground font-medium">{price.input.toFixed(2)}</span>
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-muted-foreground" title={t('overlay.output')}>
                        <ArrowUpFromLine className="size-3" />
                        <span className="text-card-foreground font-medium">{price.output.toFixed(2)}</span>
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-muted-foreground" title={t('overlay.cacheWrite')}>
                        <ArrowDownToLine className="size-3" />
                        <span className="text-card-foreground font-medium">{price.cache_write.toFixed(2)}</span>
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-muted-foreground" title={t('overlay.cacheRead')}>
                        <ArrowUpFromLine className="size-3" />
                        <span className="text-card-foreground font-medium">{price.cache_read.toFixed(2)}</span>
                    </span>
                </div>

                {/* action buttons: unbind -> reset -> edit (edit 最右) */}
                <div className="flex items-center gap-0.5 shrink-0">
                    <button
                        onClick={onUnbind}
                        disabled={isBinding || !isBound}
                        className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-30"
                        title={t('card.unbind')}
                    >
                        <Undo2 className="size-3.5" />
                    </button>
                    <button
                        onClick={onReset}
                        disabled={isUpserting}
                        className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-30"
                        title={t('card.reset')}
                    >
                        <RotateCcw className="size-3.5" />
                    </button>
                    <button
                        onClick={onEdit}
                        className="p-1.5 rounded hover:bg-muted transition-colors"
                        title={t('card.edit')}
                    >
                        <Pencil className="size-3.5" />
                    </button>
                </div>
            </div>

            {/* mobile prices (lg breakpoint fallback) */}
            <div className="lg:hidden flex items-center gap-3 px-2.5 pb-2 text-[11px] tabular-nums text-muted-foreground">
                <span className="inline-flex items-center gap-0.5" title={t('overlay.input')}>
                    <ArrowDownToLine className="size-3" />
                    <span className="text-card-foreground font-medium">{price.input.toFixed(2)}</span>
                </span>
                <span className="inline-flex items-center gap-0.5" title={t('overlay.output')}>
                    <ArrowUpFromLine className="size-3" />
                    <span className="text-card-foreground font-medium">{price.output.toFixed(2)}</span>
                </span>
                <span className="inline-flex items-center gap-0.5" title={t('overlay.cacheWrite')}>
                    <ArrowDownToLine className="size-3" />
                    <span className="text-card-foreground font-medium">{price.cache_write.toFixed(2)}</span>
                </span>
                <span className="inline-flex items-center gap-0.5" title={t('overlay.cacheRead')}>
                    <ArrowUpFromLine className="size-3" />
                    <span className="text-card-foreground font-medium">{price.cache_read.toFixed(2)}</span>
                </span>
            </div>
        </motion.div>
    );
}
