'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
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
    Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
    useChannelLLMPriceList,
    useChannelLLMPriceUpsert,
    useChannelLLMPriceBind,
    useChannelLLMPriceAutoMatch,
    useModelsDevProviders,
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
import { Tabs, TabsContents, TabsContent } from '@/components/animate-ui/primitives/animate/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/animate-ui/components/animate/tooltip';
import { PriceEditDialog } from './PriceEditDialog';
import { Combobox } from '@/components/ui/combobox';

interface PriceListContentProps {
    channelId: number;
    channelName: string;
    editingModelName: string | null;
    onEditingModelNameChange: (modelName: string | null) => void;
}

export function PriceListContent({
    channelId,
    channelName,
    editingModelName,
    onEditingModelNameChange,
}: PriceListContentProps) {
    const t = useTranslations('model');
    const { data: prices = [], isLoading } = useChannelLLMPriceList(channelId);
    const upsert = useChannelLLMPriceUpsert();
    const bind = useChannelLLMPriceBind();
    const autoMatch = useChannelLLMPriceAutoMatch();

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState('');
    const [autoMatchExpanded, setAutoMatchExpanded] = useState(false);
    const [autoMatchProvider, setAutoMatchProvider] = useState('');
    const [autoMatchMode, setAutoMatchMode] = useState<number>(AutoGroupType.Fuzzy);

    const filteredPrices = useMemo(
        () =>
            prices.filter((p) =>
                p.model_name.toLowerCase().includes(filter.toLowerCase()),
            ),
        [prices, filter],
    );

    const editingPrice = editingModelName
        ? prices.find((p) => p.model_name === editingModelName)
        : undefined;

    const allSelected =
        filteredPrices.length > 0 &&
        filteredPrices.every((p) => selected.has(p.model_name));

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
        else setSelected(new Set(filteredPrices.map((p) => p.model_name)));
    }, [allSelected, filteredPrices]);

    const handleBatchUnbind = useCallback(async () => {
        if (selected.size === 0) return;
        const names = Array.from(selected);
        setSelected(new Set());
        const results = await Promise.allSettled(
            names.map((name) =>
                bind.mutateAsync({
                    channel_id: channelId,
                    model_name: name,
                    provider: '',
                    model_id: '',
                }),
            ),
        );
        const errors = results.filter((r) => r.status === 'rejected');
        if (errors.length === 0) {
            toast.success(t('toast.batchUnbound', { count: names.length }));
        } else {
            toast.error(t('toast.batchUnboundFailed', { count: errors.length }));
        }
    }, [selected, channelId, bind, t]);

    const handleBatchReset = useCallback(async () => {
        if (selected.size === 0) return;
        const names = Array.from(selected);
        setSelected(new Set());
        const results = await Promise.allSettled(
            names.map((name) => {
                const price = prices.find((p) => p.model_name === name);
                if (!price) return Promise.reject(new Error('not found'));
                return upsert.mutateAsync({
                    ...price,
                    channel_id: channelId,
                    input: 0,
                    output: 0,
                    cache_read: 0,
                    cache_write: 0,
                    bind_provider: '',
                    bind_model_id: '',
                });
            }),
        );
        const errors = results.filter((r) => r.status === 'rejected');
        if (errors.length === 0) {
            toast.success(t('toast.batchReset', { count: names.length }));
        } else {
            toast.error(t('toast.batchResetFailed', { count: errors.length }));
        }
    }, [selected, prices, channelId, upsert, t]);

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
                <header className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-2xl font-bold text-card-foreground truncate min-w-0 flex-1">
                        {editingPrice ? editingPrice.model_name : channelName}
                    </h2>
                    <MorphingDialogClose className="relative right-0 top-0 shrink-0" />
                </header>
            </MorphingDialogTitle>
            <MorphingDialogDescription className="flex flex-col gap-3 px-2 pb-4">
                <Tabs value={editingModelName ? `edit-${editingModelName}` : 'list'}>
                    <TabsContents>
                        <TabsContent value="list" className="flex flex-col gap-3 outline-none">
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
                            <div className="relative flex-1 min-w-0">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
                                <input
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    placeholder={t('drawer.filter')}
                                    className="h-6 w-full max-w-48 rounded-md border border-border bg-background pl-7 pr-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                />
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
                        ) : filteredPrices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                <p className="text-sm">{t('drawer.noMatch')}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {filteredPrices.map((price, index) => (
                                    <PriceRow
                                        key={price.model_name}
                                        price={price}
                                        index={index}
                                        isSelected={selected.has(price.model_name)}
                                        isUpserting={upsert.isPending}
                                        isBinding={bind.isPending}
                                        onToggleSelect={() => toggleSelect(price.model_name)}
                                        onUnbind={() => handleUnbind(price)}
                                        onReset={() => handleReset(price)}
                                        onEdit={() => onEditingModelNameChange(price.model_name)}
                                        t={t}
                                    />
                                ))}
                            </div>
                        )}
                    </TabsContent>
                        {editingPrice && (
                            <TabsContent
                                key={`edit-${editingPrice.model_name}`}
                                value={`edit-${editingPrice.model_name}`}
                                className="outline-none"
                            >
                                <PriceEditDialog
                                    price={editingPrice}
                                    channelId={channelId}
                                    onBack={() => onEditingModelNameChange(null)}
                                />
                            </TabsContent>
                        )}
                    </TabsContents>
                </Tabs>
            </MorphingDialogDescription>
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
    const providersQuery = useModelsDevProviders();

    const providerOptions = useMemo(
        () => (providersQuery.data ?? []).map((p) => ({ key: p, label: p, filterText: p })),
        [providersQuery.data]
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
                <div className="flex-1 min-w-[160px]">
                    <Combobox
                        options={providerOptions}
                        value={autoMatchProvider || undefined}
                        placeholder={t('drawer.selectProvider')}
                        onSelect={(p) => setAutoMatchProvider(p)}
                        triggerClassName="h-7 px-2 py-1 text-xs rounded-md"
                    />
                </div>
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
    onUnbind: () => void;
    onReset: () => void;
    onEdit: () => void;
    t: ReturnType<typeof useTranslations<'model'>>;
}

function PriceRow({
    price,
    index,
    isSelected,
    isUpserting,
    isBinding,
    onToggleSelect,
    onUnbind,
    onReset,
    onEdit,
    t,
}: PriceRowProps) {
    const { Avatar: ModelAvatar } = getModelIcon(price.model_name);
    const isBound = !!(price.bind_provider && price.bind_model_id);

    return (
        <div className="rounded-lg bg-background border border-border/50 overflow-hidden">
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
                        disabled={isBinding || isUpserting}
                        className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-30"
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
        </div>
    );
}
