'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import { Loader2, Link2, AlertTriangle } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import {
    useChannelLLMPriceUpsert,
    useChannelLLMPriceBind,
    useChannelLLMPriceSyncModelsDev,
    useModelsDevProviders,
    useModelsDevModels,
    type ChannelLLMPrice,
} from '@/api/endpoints/channel_llm_price';
import { toast } from '@/components/common/Toast';
import { cn } from '@/lib/utils';
import { useNavStore } from '@/components/modules/navbar';
import { HttpStatus } from '@/api/types';
import { Combobox } from '@/components/ui/combobox';
import {
    Tabs,
    TabsContents,
    TabsContent,
} from '@/components/animate-ui/primitives/animate/tabs';

const PRICE_FIELDS = [
    { key: 'input', labelKey: 'overlay.input' as const },
    { key: 'output', labelKey: 'overlay.output' as const },
    { key: 'cache_write', labelKey: 'overlay.cacheWrite' as const },
    { key: 'cache_read', labelKey: 'overlay.cacheRead' as const },
] as const;

type PriceMode = 'custom' | 'bound';

type PriceEdit = {
    input: string;
    output: string;
    cache_read: string;
    cache_write: string;
};

interface PriceEditDialogProps {
    price: ChannelLLMPrice;
    channelId: number;
    onBack: () => void;
}

export function PriceEditDialog({ price, channelId, onBack }: PriceEditDialogProps) {
    const t = useTranslations('model');
    const upsert = useChannelLLMPriceUpsert();
    const bind = useChannelLLMPriceBind();
    const sync = useChannelLLMPriceSyncModelsDev();

    const [mode, setMode] = useState<PriceMode>(() =>
        price.bind_provider && price.bind_model_id ? 'bound' : 'custom',
    );
    const [priceEdits, setPriceEdits] = useState<PriceEdit>(() => ({
        input: price.input.toString(),
        output: price.output.toString(),
        cache_read: price.cache_read.toString(),
        cache_write: price.cache_write.toString(),
    }));
    const [bindProvider, setBindProvider] = useState(() => price.bind_provider || '');
    const [bindModelId, setBindModelId] = useState(() => price.bind_model_id || '');
    // 标记用户已开始编辑（任何字段），refetch 不重置已编辑的字段。
    const userDirtyRef = useRef(false);

    const providersQuery = useModelsDevProviders();
    const modelsQuery = useModelsDevModels(bindProvider || null);
    const setActiveNav = useNavStore((s) => s.setActiveItem);

    const close = useCallback(() => onBack(), [onBack]);

    useEffect(() => {
        const err = providersQuery.error as { code?: number } | null;
        if (err && err.code === HttpStatus.SERVICE_UNAVAILABLE) {
            sonnerToast.warning(t('toast.cacheNotReady'), {
                description: t('toast.cacheNotReadyHint'),
                icon: <AlertTriangle className="size-5 text-destructive/70" />,
                position: 'top-left',
                action: {
                    label: t('toast.goToSetting'),
                    onClick: () => setActiveNav('setting'),
                },
            });
        }
    }, [providersQuery.error, setActiveNav, t]);

    // B4 fix: deps 改为 identity-only 字段，避免 30s refetch 触发 price 引用变化时
    // 静默覆盖用户正在编辑的输入。userDirtyRef 确保用户已编辑的字段不被覆盖。
    useEffect(() => {
        setPriceEdits((prev) => ({
            input: userDirtyRef.current ? prev.input : price.input.toString(),
            output: userDirtyRef.current ? prev.output : price.output.toString(),
            cache_read: userDirtyRef.current ? prev.cache_read : price.cache_read.toString(),
            cache_write: userDirtyRef.current ? prev.cache_write : price.cache_write.toString(),
        }));
        setBindProvider(price.bind_provider || '');
        setBindModelId(price.bind_model_id || '');
        setMode(price.bind_provider && price.bind_model_id ? 'bound' : 'custom');
    }, [price.id, price.channel_id]);

    const handleSelectMode = useCallback(
        (next: PriceMode) => {
            if (next === mode) return;
            if (next === 'custom') {
                setBindProvider('');
                setBindModelId('');
            }
            setMode(next);
        },
        [mode],
    );

    const providerOptions = useMemo(
        () => (providersQuery.data ?? []).map((p) => ({ key: p, label: p, filterText: p })),
        [providersQuery.data]
    );

    const modelOptions = useMemo(
        () =>
            (modelsQuery.data ?? []).map((m) => ({
                key: m.id,
                label: m.id,
                filterText: m.id,
                hint: `${m.cost?.input ?? 0}/${m.cost?.output ?? 0}`,
            })),
        [modelsQuery.data]
    );

    const lookupResult = useMemo(() => {
        if (mode !== 'bound' || !bindProvider || !bindModelId) return null;
        const list = modelsQuery.data ?? [];
        const m = list.find((x) => x.id.toLowerCase() === bindModelId.toLowerCase());
        if (!m) return null;
        return {
            input: m.cost?.input ?? 0,
            output: m.cost?.output ?? 0,
            cache_read: m.cost?.cache_read ?? 0,
            cache_write: m.cost?.cache_write ?? 0,
        };
    }, [modelsQuery.data, mode, bindProvider, bindModelId]);

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

    // 空字符串、纯空白 → 视为 0；其它必须为有限非负数。
    const parsePriceInput = (raw: string): number | null => {
        const s = raw.trim();
        if (s === '') return 0;
        const n = Number(s);
        if (!Number.isFinite(n) || n < 0) return null;
        return n;
    };

    const handleSubmit = () => {
        if (mode === 'custom') {
            const input = parsePriceInput(priceEdits.input);
            const output = parsePriceInput(priceEdits.output);
            const cacheRead = parsePriceInput(priceEdits.cache_read);
            const cacheWrite = parsePriceInput(priceEdits.cache_write);
            if (input === null || output === null || cacheRead === null || cacheWrite === null) {
                toast.error(t('toast.invalidPrice'));
                return;
            }
            upsert.mutate(
                {
                    ...price,
                    channel_id: channelId,
                    input,
                    output,
                    cache_read: cacheRead,
                    cache_write: cacheWrite,
                    bind_provider: '',
                    bind_model_id: '',
                },
                {
                    onSuccess: () => {
                        userDirtyRef.current = false;
                        toast.success(t('toast.priceUpdated'));
                        close();
                    },
                    onError: (e) => toast.error(t('toast.updateFailed'), { description: e.message }),
                },
            );
        } else {
            if (!bindProvider || !bindModelId) {
                toast.warning(t('toast.bothRequired'));
                return;
            }
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
                                close();
                            },
                            onError: (e) => toast.error(t('toast.syncFailed'), { description: e.message }),
                        });
                    },
                    onError: (e) => toast.error(t('toast.bindFailed'), { description: e.message }),
                },
            );
        }
    };

    return (
        <div className="grid gap-2 px-1">
            {/* mode toggle: visual highlight slides, drives the nested Tabs value */}
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
                    type="button"
                    onClick={() => handleSelectMode('custom')}
                    className={cn(
                        'flex-1 h-7 rounded-md text-xs font-medium transition-colors relative z-10',
                        mode === 'custom' ? 'text-card-foreground' : 'text-muted-foreground',
                    )}
                >
                    {t('edit.custom')}
                </button>
                <button
                    type="button"
                    onClick={() => handleSelectMode('bound')}
                    className={cn(
                        'flex-1 h-7 rounded-md text-xs font-medium transition-colors relative z-10',
                        mode === 'bound' ? 'text-card-foreground' : 'text-muted-foreground',
                    )}
                >
                    {t('edit.bound')}
                </button>
            </div>

            {/* nested left/right sliding panels: custom (editable prices) ↔ bound (read-only prices echo + provider/model inputs) */}
            <Tabs value={mode} onValueChange={(v) => handleSelectMode(v as PriceMode)}>
                <TabsContents
                    transition={{
                        type: 'spring',
                        stiffness: 320,
                        damping: 32,
                        bounce: 0,
                        restDelta: 0.01,
                    }}
                >
                    {/* custom panel: 4 editable price inputs. p-1 keeps focus ring clear of TabsContent overflow:hidden. */}
                    <TabsContent value="custom" className="outline-none">
                        <div className="grid grid-cols-2 gap-2 p-1">
                            {PRICE_FIELDS.map((field) => (
                                <label key={field.key} className="grid gap-1 text-xs text-muted-foreground">
                                    {t(field.labelKey)}
                                    <input
                                        type="number"
                                        step="any"
                                        value={priceEdits[field.key]}
                                        onChange={(e) => {
                                        setPriceEdits({ ...priceEdits, [field.key]: e.target.value });
                                        userDirtyRef.current = true;
                                    }}
                                        className="h-9 text-sm rounded-xl border border-border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </label>
                            ))}
                        </div>
                    </TabsContent>

                    {/* bound panel: read-only prices (top) + provider/model suggest inputs (below) */}
                    <TabsContent value="bound" className="outline-none">
                        <div className="grid gap-2 p-1">
                            {/* read-only echo of the bound prices — shown on top so user sees the matched prices first */}
                            <div className="grid grid-cols-2 gap-2">
                                {PRICE_FIELDS.map((field) => (
                                    <label key={field.key} className="grid gap-1 text-xs text-muted-foreground">
                                        {t(field.labelKey)}
                                        <input
                                            type="number"
                                            step="any"
                                            value={priceEdits[field.key]}
                                            readOnly
                                            tabIndex={-1}
                                            className="h-9 text-sm rounded-xl border border-border bg-muted/40 px-2 text-muted-foreground cursor-not-allowed focus:outline-none"
                                        />
                                    </label>
                                ))}
                            </div>

                            {lookupResult && (
                                <div className="rounded-xl bg-muted/30 p-2 text-xs text-muted-foreground inline-flex items-center gap-1">
                                    <Link2 className="size-3" />
                                    {t('overlay.autoFilled')}
                                </div>
                            )}

                            <Combobox
                                label={t('overlay.provider')}
                                options={providerOptions}
                                value={bindProvider || undefined}
                                placeholder={t('overlay.selectProvider')}
                                onSelect={(p) => {
                                    setBindProvider(p);
                                    setBindModelId('');
                                }}
                            />

                            <Combobox
                                label={t('overlay.modelId')}
                                options={modelOptions}
                                value={bindModelId || undefined}
                                placeholder={t('overlay.selectModelId')}
                                disabled={!bindProvider}
                                onSelect={(m) => setBindModelId(m)}
                                renderOption={(opt) => (
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="truncate font-medium">{opt.label}</span>
                                        {opt.hint && (
                                            <span className="text-muted-foreground tabular-nums shrink-0">{opt.hint}</span>
                                        )}
                                    </span>
                                )}
                            />
                        </div>
                    </TabsContent>
                </TabsContents>
            </Tabs>

            <div className="flex gap-2 pt-2 mt-3">
                <button
                    type="button"
                    onClick={close}
                    className="flex-1 h-9 rounded-xl bg-muted text-muted-foreground text-sm font-medium transition-all hover:bg-muted/80 active:scale-[0.98]"
                >
                    {t('overlay.cancel')}
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={upsert.isPending || bind.isPending || sync.isPending}
                    className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-medium transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
                >
                    {upsert.isPending || bind.isPending || sync.isPending ? (
                        <span className="flex items-center justify-center gap-1.5">
                            <Loader2 className="size-4 animate-spin" />
                        </span>
                    ) : null}
                    {t('overlay.save')}
                </button>
            </div>
        </div>
    );
}
