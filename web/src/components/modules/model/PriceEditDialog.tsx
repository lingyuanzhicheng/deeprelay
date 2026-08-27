'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Loader2, Link2 } from 'lucide-react';
import {
    useChannelLLMPriceUpsert,
    useChannelLLMPriceBind,
    useChannelLLMPriceSyncModelsDev,
    type ChannelLLMPrice,
} from '@/api/endpoints/channel_llm_price';
import { toast } from '@/components/common/Toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useModelsDevFetch } from './useModelsDevFetch';
import {
    Tabs,
    TabsContents,
    TabsContent,
} from '@/components/animate-ui/primitives/animate/tabs';

type PriceMode = 'custom' | 'bound';

type PriceEdit = {
    input: string;
    output: string;
    cache_read: string;
    cache_write: string;
};

interface PriceEditDialogProps {
    open: boolean;
    channelId: number;
    price: ChannelLLMPrice | null;
    anchorRect: DOMRect | null;
    onClose: () => void;
    onExitComplete?: () => void;
}

export function PriceEditDialog({ open, channelId, price, anchorRect, onClose, onExitComplete }: PriceEditDialogProps) {
    const t = useTranslations('model');
    const upsert = useChannelLLMPriceUpsert();
    const bind = useChannelLLMPriceBind();
    const sync = useChannelLLMPriceSyncModelsDev();

    const [mode, setMode] = useState<PriceMode>('custom');
    const [priceEdits, setPriceEdits] = useState<PriceEdit>({ input: '', output: '', cache_read: '', cache_write: '' });
    const [bindProvider, setBindProvider] = useState('');
    const [bindModelId, setBindModelId] = useState('');
    const [showProviderSuggest, setShowProviderSuggest] = useState(false);
    const [showModelSuggest, setShowModelSuggest] = useState(false);

    const md = useModelsDevFetch();
    const providerInputRef = useRef<HTMLInputElement>(null);
    const modelInputRef = useRef<HTMLInputElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open || !price) return;
        setPriceEdits({
            input: price.input.toString(),
            output: price.output.toString(),
            cache_read: price.cache_read.toString(),
            cache_write: price.cache_write.toString(),
        });
        setBindProvider(price.bind_provider || '');
        setBindModelId(price.bind_model_id || '');
        setMode(price.bind_provider && price.bind_model_id ? 'bound' : 'custom');
    }, [open, price]);

    // 在按下 Escape 时关闭
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose]);

    const handleProviderFocus = useCallback(() => {
        md.ensureLoaded();
        setShowProviderSuggest(true);
    }, [md]);

    const handleModelFocus = useCallback(() => {
        md.ensureLoaded();
        setShowModelSuggest(true);
    }, [md]);

    const providerSuggestions = useMemo(
        () => md.getProviderSuggestions(bindProvider),
        [md, bindProvider],
    );
    const modelSuggestions = useMemo(
        () => md.getModelSuggestions(bindProvider, bindModelId),
        [md, bindProvider, bindModelId],
    );

    // 当用户在 binding 模式下选了完整 provider+modelId, 自动填充 4 个价格
    const lookupResult = useMemo(() => {
        if (mode !== 'bound' || !bindProvider || !bindModelId) return null;
        return md.lookupModel(bindProvider, bindModelId);
    }, [md, mode, bindProvider, bindModelId]);

    useEffect(() => {
        if (lookupResult) {
            setPriceEdits({
                input: lookupResult.input.toString(),
                output: lookupResult.output.toString(),
                cache_read: lookupResult.cache_read.toString(),
                cache_write: lookupResult.cache_write.toString(),
            });
        }
    }, [lookupResult]);

    const canSubmit = mode === 'custom' ? true : !!(bindProvider && bindModelId);

    const handleSubmit = () => {
        if (!price) return;

        if (mode === 'custom') {
            upsert.mutate(
                {
                    ...price,
                    channel_id: channelId,
                    input: parseFloat(priceEdits.input) || 0,
                    output: parseFloat(priceEdits.output) || 0,
                    cache_read: parseFloat(priceEdits.cache_read) || 0,
                    cache_write: parseFloat(priceEdits.cache_write) || 0,
                    bind_provider: '',
                    bind_model_id: '',
                },
                {
                    onSuccess: () => {
                        toast.success(t('toast.priceUpdated'));
                        onClose();
                    },
                    onError: (e) => toast.error(t('toast.updateFailed'), { description: e.message }),
                },
            );
        } else {
            if (!bindProvider || !bindModelId) {
                toast.warning(t('toast.bothRequired'));
                return;
            }
            // 先 bind, 再 sync (sync 从 modelsdev 拉取最新价格一起写 DB)
            bind.mutate(
                {
                    channel_id: channelId,
                    model_name: price.model_name,
                    provider: bindProvider,
                    model_id: bindModelId,
                },
                {
                    onSuccess: () => {
                        sync.mutate(channelId, {
                            onSuccess: () => {
                                toast.success(t('toast.bindSaved'));
                                onClose();
                            },
                            onError: (e) => toast.error(t('toast.syncFailed'), { description: e.message }),
                        });
                    },
                    onError: (e) => toast.error(t('toast.bindFailed'), { description: e.message }),
                },
            );
        }
    };

    if (!price) return null;

    const dialogWidth = 420;
    const anchorRight = anchorRect ? anchorRect.right : 200;
    const anchorTop = anchorRect ? anchorRect.top : 100;
    const right = Math.max(8, window.innerWidth - anchorRight);
    const adjustedTop = Math.max(8, Math.min(anchorTop, window.innerHeight - 400));

    return (
        <AnimatePresence onExitComplete={onExitComplete}>
            {open && (
                <>
                    <motion.div
                        key="edit-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-[70]"
                        onClick={onClose}
                    />
                    <motion.div
                        key="edit-dialog"
                        ref={dialogRef}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        style={{
                            position: 'fixed',
                            right,
                            top: adjustedTop,
                            width: dialogWidth,
                            zIndex: 71,
                            transformOrigin: '100% 0%',
                        }}
                        className="bg-card border border-border rounded-2xl shadow-2xl flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                <header className="flex items-center justify-between px-4 py-2.5 shrink-0">
                    <h2 className="text-sm font-bold text-card-foreground truncate">
                        {price.model_name}
                    </h2>
                    <button
                        onClick={onClose}
                        className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted transition-colors shrink-0"
                    >
                        <X className="size-4" />
                    </button>
                </header>

                <div className="px-4 pt-3 pb-1 shrink-0">
                    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/30 relative">
                        <motion.div
                            className="absolute inset-y-1 rounded-md bg-card shadow-sm"
                            style={{ width: 'calc(50% - 4px)' }}
                            animate={{
                                x: mode === 'custom' ? 0 : 'calc(100% + 8px)',
                            }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                        <button
                            onClick={() => setMode('custom')}
                            className={cn(
                                'flex-1 h-7 rounded-md text-xs font-medium transition-colors relative z-10',
                                mode === 'custom' ? 'text-card-foreground' : 'text-muted-foreground',
                            )}
                        >
                            {t('edit.custom')}
                        </button>
                        <button
                            onClick={() => setMode('bound')}
                            className={cn(
                                'flex-1 h-7 rounded-md text-xs font-medium transition-colors relative z-10',
                                mode === 'bound' ? 'text-card-foreground' : 'text-muted-foreground',
                            )}
                        >
                            {t('edit.bound')}
                        </button>
                    </div>
                </div>

                <Tabs value={mode} onValueChange={(v) => setMode(v as PriceMode)} className="flex flex-col">
                    <TabsContents initial={false}>
                        <TabsContent value="custom">
                            <div className="px-4 py-3 flex flex-col gap-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="grid gap-1 text-[10px] text-muted-foreground">
                                        {t('overlay.input')}
                                        <input
                                            type="number"
                                            step="any"
                                            value={priceEdits.input}
                                            onChange={(e) => setPriceEdits({ ...priceEdits, input: e.target.value })}
                                            className="h-8 text-xs rounded-md border border-border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </label>
                                    <label className="grid gap-1 text-[10px] text-muted-foreground">
                                        {t('overlay.output')}
                                        <input
                                            type="number"
                                            step="any"
                                            value={priceEdits.output}
                                            onChange={(e) => setPriceEdits({ ...priceEdits, output: e.target.value })}
                                            className="h-8 text-xs rounded-md border border-border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </label>
                                    <label className="grid gap-1 text-[10px] text-muted-foreground">
                                        {t('overlay.cacheWrite')}
                                        <input
                                            type="number"
                                            step="any"
                                            value={priceEdits.cache_write}
                                            onChange={(e) => setPriceEdits({ ...priceEdits, cache_write: e.target.value })}
                                            className="h-8 text-xs rounded-md border border-border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </label>
                                    <label className="grid gap-1 text-[10px] text-muted-foreground">
                                        {t('overlay.cacheRead')}
                                        <input
                                            type="number"
                                            step="any"
                                            value={priceEdits.cache_read}
                                            onChange={(e) => setPriceEdits({ ...priceEdits, cache_read: e.target.value })}
                                            className="h-8 text-xs rounded-md border border-border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </label>
                                </div>
                            </div>
                            <footer className="flex items-center gap-3 pt-1 px-4 pb-3">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={onClose}
                                    className="flex-1 rounded-2xl h-9"
                                >
                                    {t('overlay.cancel')}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={upsert.isPending}
                                    className="flex-1 rounded-2xl h-9"
                                >
                                    {upsert.isPending ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                        <Check className="size-3.5" />
                                    )}
                                    {t('overlay.save')}
                                </Button>
                            </footer>
                        </TabsContent>

                        <TabsContent value="bound">
                            <div className="px-4 py-3 flex flex-col gap-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="grid gap-1 text-[10px] text-muted-foreground">
                                        {t('overlay.input')}
                                        <input
                                            type="number"
                                            step="any"
                                            value={priceEdits.input}
                                            disabled
                                            className="h-8 text-xs rounded-md border border-border bg-background px-2 opacity-50 cursor-not-allowed"
                                        />
                                    </label>
                                    <label className="grid gap-1 text-[10px] text-muted-foreground">
                                        {t('overlay.output')}
                                        <input
                                            type="number"
                                            step="any"
                                            value={priceEdits.output}
                                            disabled
                                            className="h-8 text-xs rounded-md border border-border bg-background px-2 opacity-50 cursor-not-allowed"
                                        />
                                    </label>
                                    <label className="grid gap-1 text-[10px] text-muted-foreground">
                                        {t('overlay.cacheWrite')}
                                        <input
                                            type="number"
                                            step="any"
                                            value={priceEdits.cache_write}
                                            disabled
                                            className="h-8 text-xs rounded-md border border-border bg-background px-2 opacity-50 cursor-not-allowed"
                                        />
                                    </label>
                                    <label className="grid gap-1 text-[10px] text-muted-foreground">
                                        {t('overlay.cacheRead')}
                                        <input
                                            type="number"
                                            step="any"
                                            value={priceEdits.cache_read}
                                            disabled
                                            className="h-8 text-xs rounded-md border border-border bg-background px-2 opacity-50 cursor-not-allowed"
                                        />
                                    </label>
                                </div>

                                <div className="relative">
                                    <label className="text-[10px] text-muted-foreground">{t('overlay.provider')}</label>
                                    <div className="relative">
                                        <input
                                            ref={providerInputRef}
                                            value={bindProvider}
                                            onChange={(e) => setBindProvider(e.target.value)}
                                            onFocus={handleProviderFocus}
                                            onBlur={() => setTimeout(() => setShowProviderSuggest(false), 150)}
                                            placeholder={t('overlay.selectProvider')}
                                            className="h-8 w-full text-xs rounded-md border border-border bg-background px-2 pr-7 focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                        {md.loading && (
                                            <Loader2 className="size-3 animate-spin text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2" />
                                        )}
                                    </div>
                                    {showProviderSuggest && !md.loading && providerSuggestions.length > 0 && (
                                        <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                                            {providerSuggestions.slice(0, 50).map((p) => (
                                                <button
                                                    key={p}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setBindProvider(p);
                                                        setShowProviderSuggest(false);
                                                        modelInputRef.current?.focus();
                                                    }}
                                                    className="block w-full text-left px-2 py-1 text-xs hover:bg-accent/10 truncate"
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="relative">
                                    <label className="text-[10px] text-muted-foreground">{t('overlay.modelId')}</label>
                                    <div className="relative">
                                        <input
                                            ref={modelInputRef}
                                            value={bindModelId}
                                            onChange={(e) => setBindModelId(e.target.value)}
                                            onFocus={handleModelFocus}
                                            onBlur={() => setTimeout(() => setShowModelSuggest(false), 150)}
                                            placeholder={t('overlay.selectModelId')}
                                            disabled={!bindProvider}
                                            className="h-8 w-full text-xs rounded-md border border-border bg-background px-2 pr-7 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                                        />
                                        {md.loading && (
                                            <Loader2 className="size-3 animate-spin text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2" />
                                        )}
                                    </div>
                                    {showModelSuggest && !md.loading && modelSuggestions.length > 0 && (
                                        <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                                            {modelSuggestions.slice(0, 50).map((m) => (
                                                <button
                                                    key={`${m.provider}/${m.modelId}`}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setBindModelId(m.modelId);
                                                        setShowModelSuggest(false);
                                                    }}
                                                    className="block w-full text-left px-2 py-1 text-xs hover:bg-accent/10 truncate"
                                                >
                                                    <span className="text-muted-foreground">{m.provider}/</span>
                                                    <span className="text-card-foreground font-medium">{m.modelId}</span>
                                                    <span className="text-muted-foreground ml-2 tabular-nums">
                                                        {m.input}/{m.output}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {lookupResult && (
                                    <div className="rounded-md bg-muted/30 p-2 text-[10px] text-muted-foreground inline-flex items-center gap-1">
                                        <Link2 className="size-2.5" />
                                        {t('overlay.autoFilled')}
                                    </div>
                                )}
                            </div>
                            <footer className="flex items-center gap-3 pt-1 px-4 pb-3">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={onClose}
                                    className="flex-1 rounded-2xl h-9"
                                >
                                    {t('overlay.cancel')}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={
                                        !canSubmit ||
                                        bind.isPending ||
                                        sync.isPending
                                    }
                                    className="flex-1 rounded-2xl h-9"
                                >
                                    {bind.isPending || sync.isPending ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                        <Check className="size-3.5" />
                                    )}
                                    {t('overlay.bind')}
                                </Button>
                            </footer>
                        </TabsContent>
                    </TabsContents>
                </Tabs>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
