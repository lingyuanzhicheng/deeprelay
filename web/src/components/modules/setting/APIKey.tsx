'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
    Loader,
    Trash2,
    Info,
    CalendarDays,
    Pencil,
    Activity,
    FileText,
    Coins,
    TrendingUp,
    CheckCircle2,
    XCircle,
    Clock,
    Key,
    Hash,
    RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
    MorphingDialog,
    MorphingDialogTrigger,
    MorphingDialogContainer,
    MorphingDialogContent,
    MorphingDialogTitle,
    MorphingDialogDescription,
    MorphingDialogClose,
    useMorphingDialog,
} from '@/components/ui/morphing-dialog';
import { Tabs, TabsContents, TabsContent } from '@/components/animate-ui/primitives/animate/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/animate-ui/components/animate/tooltip';
import {
    useUpdateAPIKey,
    useDeleteAPIKey,
    useResetAPIKey,
    type APIKey,
} from '@/api/endpoints/apikey';
import { useGroupList } from '@/api/endpoints/group';
import { useStatsAPIKey, type StatsAPIKeyFormatted } from '@/api/endpoints/stats';
import { cn, formatCount } from '@/lib/utils';
import { CopyIconButton } from '@/components/common/CopyButton';
import { toast } from '@/components/common/Toast';
import type { ApiError } from '@/api/types';

function normalizeMoneyInput(input: string): string {
    const cleaned = input.replace(/[^\d.]/g, '');
    const [intPart, ...rest] = cleaned.split('.');
    return rest.length > 0 ? `${intPart}.${rest.join('').slice(0, 6)}` : intPart;
}

function toggleModel(current: string | undefined, model: string): string | undefined {
    const models = current ? current.split(',').filter(Boolean) : [];
    const next = models.includes(model)
        ? models.filter((m) => m !== model)
        : [...models, model];
    return next.length ? next.join(',') : undefined;
}

function hasModel(supported: string | undefined, model: string): boolean {
    return supported ? supported.split(',').includes(model) : false;
}

// ---- APIKeyForm ----

export interface APIKeyFormProps {
    apiKey?: APIKey;
    isPending: boolean;
    submitLabel: string;
    onSubmit: (data: Omit<APIKey, 'id' | 'api_key'>) => void;
    onClose: () => void;
}

export function APIKeyForm({ apiKey, isPending, submitLabel, onSubmit, onClose }: APIKeyFormProps) {
    const t = useTranslations('setting');
    const { data: groups = [] } = useGroupList();
    const resetAPIKey = useResetAPIKey();
    const [form, setForm] = useState<Omit<APIKey, 'id' | 'api_key'>>(() => ({
        name: apiKey?.name ?? '',
        enabled: apiKey?.enabled ?? true,
        expire_at: apiKey?.expire_at,
        max_cost: apiKey?.max_cost,
        supported_models: apiKey?.unlimited_models ? '' : apiKey?.supported_models,
        unlimited_models: apiKey?.unlimited_models ?? false,
        model_pro: apiKey?.model_pro ?? '',
        model_flash: apiKey?.model_flash ?? '',
        model_vision: apiKey?.model_vision ?? '',
    }));
    const [maxCostInput, setMaxCostInput] = useState(() =>
        apiKey?.max_cost != null ? String(apiKey.max_cost) : ''
    );
    const [expireDatetime, setExpireDatetime] = useState<string>(() => {
        if (!apiKey?.expire_at) return '';
        const d = new Date(apiKey.expire_at * 1000);
        if (isNaN(d.getTime())) return '';
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    });
    const [currentApiKey, setCurrentApiKey] = useState(apiKey?.api_key ?? '');

    const availableModels = useMemo(() => {
        const names = groups.map((g) => g.name).filter(Boolean);
        return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    }, [groups]);

    const neverExpire = expireDatetime === '';
    const isUnlimitedCost = maxCostInput.trim() === '';

    const updateForm = useCallback((updater: Partial<Omit<APIKey, 'id' | 'api_key'>>) => {
        setForm((prev) => ({ ...prev, ...updater }));
    }, []);

    const handleDatetimeChange = useCallback((value: string) => {
        setExpireDatetime(value);
        if (!value) {
            updateForm({ expire_at: undefined });
            return;
        }
        const ts = Math.floor(new Date(value).getTime() / 1000);
        updateForm({ expire_at: ts });
    }, [updateForm]);

    const handleToggleNeverExpire = useCallback(() => {
        if (neverExpire) {
            const now = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const defaultDt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59`;
            setExpireDatetime(defaultDt);
            updateForm({ expire_at: Math.floor(new Date(defaultDt).getTime() / 1000) });
        } else {
            setExpireDatetime('');
            updateForm({ expire_at: undefined });
        }
    }, [neverExpire, updateForm]);

    const handleMaxCostChange = useCallback((val: string) => {
        const normalized = normalizeMoneyInput(val);
        setMaxCostInput(normalized);
        const num = parseFloat(normalized);
        updateForm({ max_cost: Number.isFinite(num) ? num : undefined });
    }, [updateForm]);

    const handleClearMaxCost = useCallback(() => {
        setMaxCostInput('');
        updateForm({ max_cost: undefined });
    }, [updateForm]);

    const handleResetKey = useCallback(() => {
        if (!apiKey) return;
        if (!window.confirm(t('apiKey.form.resetConfirm'))) return;
        resetAPIKey.mutate(apiKey.id, {
            onSuccess: (data) => {
                setCurrentApiKey(data.api_key);
                toast.success(t('apiKey.toast.resetSuccess'));
            },
            onError: (error) => {
                const msg = (error as unknown as ApiError)?.message;
                toast.error(t('apiKey.toast.resetError'), { description: msg });
            },
        });
    }, [apiKey, resetAPIKey, t]);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSubmit(form);
    }, [form, onSubmit]);

    return (
        <form onSubmit={handleSubmit} className="grid gap-2 px-1">
            <label className="grid gap-1 text-xs text-muted-foreground">
                {t('apiKey.form.name')}
                <Input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateForm({ name: e.target.value })}
                    className="h-9 text-sm rounded-xl"
                    disabled={isPending}
                    required
                />
            </label>

            {apiKey && (
                <div className="grid gap-1 text-xs text-muted-foreground">
                    {t('apiKey.form.apiKeyValue')}
                    <div className="flex items-center gap-2">
                        <Input
                            type="text"
                            value={currentApiKey}
                            readOnly
                            disabled
                            className="h-9 text-xs font-mono rounded-xl flex-1"
                        />
                        <button
                            type="button"
                            onClick={handleResetKey}
                            disabled={isPending || resetAPIKey.isPending}
                            className={cn(
                                'h-9 px-3 rounded-xl border text-sm transition-colors shrink-0 inline-flex items-center gap-1',
                                'border-border bg-muted/20 text-foreground hover:bg-muted/30',
                                (isPending || resetAPIKey.isPending) && 'opacity-50 cursor-not-allowed'
                            )}
                            title={t('apiKey.form.resetKey')}
                        >
                            {resetAPIKey.isPending ? (
                                <Loader className="size-3.5 animate-spin" />
                            ) : (
                                <RotateCcw className="size-3.5" />
                            )}
                            {t('apiKey.form.resetKey')}
                        </button>
                    </div>
                </div>
            )}

            <div className="grid gap-1 text-xs text-muted-foreground">
                {t('apiKey.form.maxCost')}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2"><Coins className="size-3.5 text-muted-foreground" /></span>
                        <Input
                            type="text"
                            inputMode="decimal"
                            placeholder={t('apiKey.form.maxCostPlaceholder')}
                            value={maxCostInput}
                            onChange={(e) => handleMaxCostChange(e.target.value)}
                            className="h-9 text-sm rounded-xl pl-7"
                            disabled={isPending}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleClearMaxCost}
                        disabled={isPending}
                        aria-pressed={isUnlimitedCost}
                        className={cn(
                            'h-9 px-3 rounded-xl border text-sm transition-colors shrink-0',
                            isUnlimitedCost
                                ? 'bg-primary text-primary-foreground border-primary/30'
                                : 'border-border bg-muted/20 text-foreground hover:bg-muted/30',
                            isPending && 'opacity-50 cursor-not-allowed'
                        )}
                    >
                        {t('apiKey.form.unlimited')}
                    </button>
                </div>
            </div>

            <div className="grid gap-1 text-xs text-muted-foreground">
                {t('apiKey.form.expireAt')}
                <div className="flex items-center gap-2">
                    <Input
                        type="datetime-local"
                        value={expireDatetime}
                        onChange={(e) => handleDatetimeChange(e.target.value)}
                        disabled={isPending}
                        className="h-9 flex-1 text-sm rounded-xl"
                    />
                    <button
                        type="button"
                        onClick={handleToggleNeverExpire}
                        disabled={isPending}
                        aria-pressed={neverExpire}
                        className={cn(
                            'h-9 px-3 rounded-xl border text-sm transition-colors whitespace-nowrap shrink-0',
                            neverExpire
                                ? 'bg-primary text-primary-foreground border-primary/30'
                                : 'border-border bg-muted/20 text-foreground hover:bg-muted/30',
                            isPending && 'opacity-50 cursor-not-allowed'
                        )}
                    >
                        {t('apiKey.form.neverExpire')}
                    </button>
                </div>
            </div>

            <div className="grid gap-2">
                <div className="text-xs text-muted-foreground">{t('apiKey.form.routingModel')}</div>
                <div className="grid gap-3">
                    {([
                        { key: 'model_pro', label: 'Pro', value: form.model_pro },
                        { key: 'model_flash', label: 'Flash', value: form.model_flash },
                        { key: 'model_vision', label: 'Vision', value: form.model_vision },
                    ] as const).map(({ key, label, value }) => {
                        const aliasName = `deeprelay-${label.toLowerCase()}`;
                        return (
                            <div key={key} className="grid grid-cols-2 gap-3 items-center">
                                <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 min-w-0">
                                    <span className="text-xs text-muted-foreground font-mono truncate min-w-0">{aliasName}</span>
                                    <CopyIconButton
                                        text={aliasName}
                                        className="shrink-0 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                                        copyIconClassName="size-3"
                                        checkIconClassName="size-3"
                                    />
                                </div>
                                <Combobox
                                    options={availableModels.map((m) => ({ key: m, label: m, filterText: m }))}
                                    value={value}
                                    placeholder={t('apiKey.form.selectGroup')}
                                    disabledLabel={t('apiKey.form.disabled')}
                                    onSelect={(v) => updateForm({ [key]: v })}
                                    triggerClassName="w-full rounded-xl border border-border px-3 py-2 text-sm"
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            <AnimatePresence initial={false}>
                {!form.unlimited_models && (
                    <motion.div
                        key="supported-models"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="overflow-hidden"
                    >
                        <div className="grid gap-1">
                            <div className="text-xs text-muted-foreground">{t('apiKey.form.supportedModels')}</div>
                            <div className="max-h-40 overflow-auto rounded-xl p-2">
                                {availableModels.length === 0 ? (
                                    <div className="text-xs text-muted-foreground py-2 text-center">
                                        {t('apiKey.form.noModels')}
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {availableModels.map((m) => {
                                            const checked = hasModel(form.supported_models, m);
                                            return (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    disabled={isPending}
                                                    onClick={() => updateForm({ supported_models: toggleModel(form.supported_models, m) })}
                                                    className="text-left disabled:opacity-50"
                                                >
                                                    <Badge
                                                        variant={checked ? 'default' : 'outline'}
                                                        className={cn(
                                                            'cursor-pointer select-none',
                                                            !checked && 'bg-background/40 hover:bg-background/70'
                                                        )}
                                                    >
                                                        {m}
                                                    </Badge>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-muted/20 border border-border/50">
                <label className="flex items-center gap-2 cursor-pointer">
                    <Switch
                        checked={form.enabled ?? true}
                        onCheckedChange={(checked) => updateForm({ enabled: checked })}
                        disabled={isPending}
                    />
                    <span className="text-sm font-medium text-card-foreground">{t('apiKey.form.enabled')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <Switch
                        checked={form.unlimited_models ?? false}
                        onCheckedChange={(checked) => {
                            updateForm({
                                unlimited_models: checked,
                                supported_models: checked ? '' : form.supported_models,
                            });
                        }}
                        disabled={isPending}
                    />
                    <span className="text-sm font-medium text-card-foreground">{t('apiKey.form.modelUnlimited')}</span>
                </label>
            </div>

            <div className="flex gap-2 pt-2 mt-3">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isPending}
                    className="flex-1 h-9 rounded-xl bg-muted text-muted-foreground text-sm font-medium transition-all hover:bg-muted/80 active:scale-[0.98] disabled:opacity-50"
                >
                    {t('apiKey.form.cancel')}
                </button>
                <button
                    type="submit"
                    disabled={isPending || !form.name.trim()}
                    className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-medium transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
                >
                    {isPending ? <Loader className="size-4 animate-spin inline-block" /> : null}
                    {submitLabel}
                </button>
            </div>
        </form>
    );
}

// ---- APIKeyItem (channel-card style) ----

export interface APIKeyKeyItemProps {
    apiKey: APIKey;
    stats: StatsAPIKeyFormatted | null | undefined;
    layout: 'grid' | 'list';
    supportedModelCount?: number;
    onEnabledChange: (enabled: boolean) => void;
    isUpdating: boolean;
}

export function APIKeyKeyItem({
    apiKey,
    stats,
    layout,
    supportedModelCount = 0,
    onEnabledChange,
    isUpdating,
}: APIKeyKeyItemProps) {
    const t = useTranslations('apiKeyItem');

    const modelCount = useMemo(() => {
        if (supportedModelCount > 0) return supportedModelCount;
        if (!apiKey.supported_models) return 0;
        return apiKey.supported_models.split(',').filter(Boolean).length;
    }, [apiKey.supported_models, supportedModelCount]);

    const requestCount = stats?.request_count.formatted.value ?? '0';
    const requestUnit = stats?.request_count.formatted.unit ?? '';
    const successCount = stats?.request_success.formatted.value ?? '0';
    const failedCount = stats?.request_failed.formatted.value ?? '0';
    const totalTokenValue = stats?.total_token.formatted.value ?? '0';
    const totalTokenUnit = stats?.total_token.formatted.unit ?? '';

    const balance = apiKey.max_cost != null ? formatCount(apiKey.max_cost) : null;

    const expireLabel = apiKey.expire_at
        ? new Date(apiKey.expire_at * 1000).toLocaleString()
        : t('neverExpire');

    const isListLayout = layout === 'list';

    return (
        <article
            className="flex flex-col gap-4 rounded-3xl border border-border bg-card text-card-foreground p-4 transition-all duration-300"
        >
            <header className="relative flex items-center justify-between gap-2">
                <Tooltip side="top" sideOffset={10} align="center">
                    <TooltipTrigger asChild>
                        <h3 className="text-lg font-bold truncate min-w-0">{apiKey.name}</h3>
                    </TooltipTrigger>
                    <TooltipContent key={apiKey.name}>{apiKey.name}</TooltipContent>
                </Tooltip>
                <Switch
                    checked={apiKey.enabled}
                    onCheckedChange={onEnabledChange}
                    disabled={isUpdating}
                    onClick={(e) => e.stopPropagation()}
                />
            </header>

            {isListLayout ? (
                <dl className="grid grid-cols-2 gap-2 lg:grid-cols-6">
                    <StatTile icon={<Activity className="size-3.5 text-primary" />} label={t('requestCount')} value={requestCount} unit={requestUnit} />
                    <StatTile icon={<Hash className="size-3.5 text-primary" />} label={t('totalToken')} value={totalTokenValue} unit={totalTokenUnit} />
                    <StatTile icon={<CheckCircle2 className="size-3.5 text-blue-500" />} label={t('successRequests')} value={successCount} />
                    <StatTile icon={<XCircle className="size-3.5 text-destructive" />} label={t('failedRequests')} value={failedCount} />
                    <StatTile
                        icon={<Coins className="size-3.5 text-primary" />}
                        label={t('balance')}
                        value={balance ? balance.formatted.value : t('unlimited')}
                        unit={balance?.formatted.unit}
                    />
                    <StatTile icon={<CalendarDays className="size-3.5 text-primary" />} label={t('expireAt')} value={expireLabel} small />
                </dl>
            ) : (
                <dl className="grid grid-cols-1 gap-3 w-full">
                    <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 p-2">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Coins className="h-5 w-5" />
                            </span>
                            <dt className="text-sm text-muted-foreground">{t('balance')}</dt>
                        </div>
                        <dd className="text-base">
                            {balance ? `${balance.formatted.value}${balance.formatted.unit}` : t('unlimited')}
                        </dd>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 p-2">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <CalendarDays className="h-5 w-5" />
                            </span>
                            <dt className="text-sm text-muted-foreground">{t('expireAt')}</dt>
                        </div>
                        <dd className="text-base">{expireLabel}</dd>
                    </div>
                </dl>
            )}
        </article>
    );
}

function StatTile({ icon, label, value, unit, small }: { icon: React.ReactNode; label: string; value: string; unit?: string; small?: boolean }) {
    return (
        <div className="rounded-2xl border border-border/70 bg-background/80 p-2">
            <dt className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                {icon}
                {label}
            </dt>
            <dd className={cn('font-semibold', small ? 'text-xs' : 'text-sm')}>
                {value}
                {unit ? <span className="ml-1 text-xs text-muted-foreground">{unit}</span> : null}
            </dd>
        </div>
    );
}

// ---- APIKeyDetailContent (CardContent-like) ----

export function APIKeyDetailContent({ apiKey, stats }: { apiKey: APIKey; stats: StatsAPIKeyFormatted | null | undefined }) {
    const { setIsOpen } = useMorphingDialog();
    const updateAPIKey = useUpdateAPIKey();
    const deleteAPIKey = useDeleteAPIKey();
    const [isEditing, setIsEditing] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const t = useTranslations('apiKeyDetail');
    const tForm = useTranslations('setting');

    const currentView = isEditing ? 'editing' : 'viewing';

    const handleUpdate = (data: Omit<APIKey, 'id' | 'api_key'>) => {
        updateAPIKey.mutate(
            { id: apiKey.id, ...data },
            {
                onSuccess: () => {
                    toast.success(tForm('apiKey.toast.updateSuccess'));
                    setIsEditing(false);
                },
                onError: (error) => {
                    const msg = (error as unknown as ApiError)?.message;
                    toast.error(tForm('apiKey.toast.updateError'), { description: msg });
                },
            }
        );
    };

    const handleDeleteClick = () => {
        if (!isConfirmingDelete) {
            setIsConfirmingDelete(true);
            return;
        }
        setIsOpen(false);
        setTimeout(() => {
            deleteAPIKey.mutate(apiKey.id, {
                onSuccess: () => toast.success(tForm('apiKey.toast.deleteSuccess')),
                onError: (error) => {
                    const msg = (error as unknown as ApiError)?.message;
                    toast.error(tForm('apiKey.toast.deleteError'), { description: msg });
                },
            });
        }, 300);
    };

    const balance = apiKey.max_cost != null ? formatCount(apiKey.max_cost) : null;
    const expireLabel = apiKey.expire_at
        ? new Date(apiKey.expire_at * 1000).toLocaleString()
        : t('neverExpire');

    return (
        <>
            <MorphingDialogTitle>
                <header className="mb-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-card-foreground">
                        {isEditing ? t('title.edit') : t('title.view')}
                    </h2>
                    <MorphingDialogClose
                        className="relative top-0 right-0"
                        variants={{
                            initial: { opacity: 0, scale: 0.8 },
                            animate: { opacity: 1, scale: 1 },
                            exit: { opacity: 0, scale: 0.8 },
                        }}
                    />
                </header>
            </MorphingDialogTitle>

            <MorphingDialogDescription>
                <Tabs value={currentView}>
                    <TabsContents>
                        <TabsContent value="viewing">
                            <div className="max-h-[60vh] overflow-y-auto space-y-4 sm:space-y-5">
                                <dl className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                                    <BigStat
                                        icon={<Activity className="size-4 text-chart-1" />}
                                        label={t('metrics.totalRequests')}
                                        value={stats?.request_count.formatted.value ?? '0'}
                                        unit={stats?.request_count.formatted.unit}
                                        colorClass="text-chart-1"
                                        bgClass="from-chart-1/10 to-chart-1/5"
                                    />
                                    <BigStat
                                        icon={<FileText className="size-4 text-chart-3" />}
                                        label={t('metrics.totalToken')}
                                        value={stats?.total_token.formatted.value ?? '0'}
                                        unit={stats?.total_token.formatted.unit}
                                        colorClass="text-chart-3"
                                        bgClass="from-chart-3/10 to-chart-3/5"
                                    />
                                    <BigStat
                                        icon={<Coins className="size-4 text-chart-5" />}
                                        label={t('metrics.totalCost')}
                                        value={stats?.total_cost.formatted.value ?? '0'}
                                        unit={stats?.total_cost.formatted.unit}
                                        colorClass="text-chart-5"
                                        bgClass="from-chart-5/10 to-chart-5/5"
                                    />
                                </dl>

                                <section className="space-y-3">
                                    <SectionTitle icon={<TrendingUp className="size-3.5" />} title={t('sections.requests')} />
                                    <dl className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                        <SmallStat
                                            icon={<CheckCircle2 className="size-4 text-accent" />}
                                            label={t('metrics.successRequests')}
                                            value={stats?.request_success.formatted.value ?? '0'}
                                            unit={stats?.request_success.formatted.unit}
                                            valueClass="text-accent"
                                        />
                                        <SmallStat
                                            icon={<XCircle className="size-4 text-destructive" />}
                                            label={t('metrics.failedRequests')}
                                            value={stats?.request_failed.formatted.value ?? '0'}
                                            unit={stats?.request_failed.formatted.unit}
                                            valueClass="text-destructive"
                                        />
                                    </dl>
                                </section>

                                <section className="space-y-3">
                                    <SectionTitle icon={<FileText className="size-3.5" />} title={t('sections.tokens')} />
                                    <dl className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                        <SmallStat
                                            dot="bg-chart-1"
                                            label={t('metrics.inputToken')}
                                            value={stats?.input_token.formatted.value ?? '0'}
                                            unit={stats?.input_token.formatted.unit}
                                        />
                                        <SmallStat
                                            dot="bg-chart-3"
                                            label={t('metrics.outputToken')}
                                            value={stats?.output_token.formatted.value ?? '0'}
                                            unit={stats?.output_token.formatted.unit}
                                        />
                                        <SmallStat
                                            dot="bg-chart-4"
                                            label={t('metrics.cacheReadToken')}
                                            value={stats?.cache_read_token.formatted.value ?? '0'}
                                            unit={stats?.cache_read_token.formatted.unit}
                                        />
                                        <SmallStat
                                            dot="bg-chart-2"
                                            label={t('metrics.cacheWriteToken')}
                                            value={stats?.cache_write_token.formatted.value ?? '0'}
                                            unit={stats?.cache_write_token.formatted.unit}
                                        />
                                    </dl>
                                </section>

                                <section className="space-y-3">
                                    <SectionTitle icon={<Coins className="size-3.5" />} title={t('sections.costs')} />
                                    <dl className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                        <SmallStat
                                            dot="bg-chart-2"
                                            label={t('metrics.inputCost')}
                                            value={stats?.input_cost.formatted.value ?? '0'}
                                            unit={stats?.input_cost.formatted.unit}
                                        />
                                        <SmallStat
                                            dot="bg-chart-5"
                                            label={t('metrics.outputCost')}
                                            value={stats?.output_cost.formatted.value ?? '0'}
                                            unit={stats?.output_cost.formatted.unit}
                                        />
                                        <SmallStat
                                            dot="bg-chart-4"
                                            label={t('metrics.cacheReadCost')}
                                            value={stats?.cache_read_cost.formatted.value ?? '0'}
                                            unit={stats?.cache_read_cost.formatted.unit}
                                        />
                                        <SmallStat
                                            dot="bg-chart-1"
                                            label={t('metrics.cacheWriteCost')}
                                            value={stats?.cache_write_cost.formatted.value ?? '0'}
                                            unit={stats?.cache_write_cost.formatted.unit}
                                        />
                                    </dl>
                                </section>

                                <section className="space-y-3">
                                    <SectionTitle icon={<Key className="size-3.5" />} title={t('sections.apiKeyValue')} />
                                    <div className="rounded-2xl border bg-card p-3 sm:p-4 flex items-center gap-2">
                                        <span className="font-mono text-sm truncate min-w-0 flex-1 select-all">
                                            {apiKey.api_key}
                                        </span>
                                        <CopyIconButton
                                            text={apiKey.api_key}
                                            className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground active:scale-95"
                                            copyIconClassName="size-4"
                                            checkIconClassName="size-4"
                                        />
                                    </div>
                                </section>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl border bg-card p-3 sm:p-4 space-y-1.5">
                                        <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Coins className="size-4 text-chart-5" />
                                            {t('metrics.balance')}
                                        </dt>
                                        <dd className="text-base font-semibold">
                                            {balance ? `${balance.formatted.value}${balance.formatted.unit}` : t('unlimited')}
                                        </dd>
                                    </div>
                                    <div className="rounded-2xl border bg-card p-3 sm:p-4 space-y-1.5">
                                        <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <CalendarDays className="size-4 text-primary" />
                                            {t('metrics.expireAt')}
                                        </dt>
                                        <dd className="text-sm font-medium">{expireLabel}</dd>
                                    </div>
                                </div>

                                {!stats && (
                                    <dl className="rounded-2xl border bg-card p-3 sm:p-4">
                                        <dt className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                            <Clock className="size-4 text-primary" />
                                            {t('metrics.noStats')}
                                        </dt>
                                    </dl>
                                )}
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 pt-2">
                                <Button
                                    onClick={() => (isConfirmingDelete ? setIsConfirmingDelete(false) : setIsEditing(true))}
                                    variant={isConfirmingDelete ? 'secondary' : 'default'}
                                    className="w-full rounded-2xl h-12"
                                >
                                    {isConfirmingDelete ? t('actions.cancel') : t('actions.edit')}
                                </Button>
                                <Button
                                    onClick={handleDeleteClick}
                                    disabled={deleteAPIKey.isPending}
                                    variant="destructive"
                                    className="w-full rounded-2xl h-12"
                                >
                                    <Trash2 className={cn('size-4 transition-transform', isConfirmingDelete && 'scale-110')} />
                                    {deleteAPIKey.isPending
                                        ? t('actions.deleting')
                                        : isConfirmingDelete
                                            ? t('actions.confirmDelete')
                                            : t('actions.delete')}
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="editing">
                            <APIKeyForm
                                apiKey={apiKey}
                                isPending={updateAPIKey.isPending}
                                submitLabel={t('actions.save')}
                                onSubmit={handleUpdate}
                                onClose={() => setIsEditing(false)}
                            />
                        </TabsContent>
                    </TabsContents>
                </Tabs>
            </MorphingDialogDescription>
        </>
    );
}

function BigStat({ icon, label, value, unit, colorClass, bgClass }: { icon: React.ReactNode; label: string; value: string; unit?: string; colorClass: string; bgClass: string }) {
    return (
        <div className={cn('rounded-2xl border bg-linear-to-br p-3 sm:p-4', bgClass)}>
            <dt className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
                {icon}
                {label}
            </dt>
            <dd className={cn('text-xl sm:text-2xl font-bold', colorClass)}>
                {value}
                {unit ? <span className="text-xs font-normal ml-1 text-muted-foreground">{unit}</span> : null}
            </dd>
        </div>
    );
}

function SmallStat({ icon, dot, label, value, unit, valueClass }: { icon?: React.ReactNode; dot?: string; label: string; value: string; unit?: string; valueClass?: string }) {
    return (
        <div className="rounded-2xl border bg-card p-3 sm:p-4 transition-colors hover:bg-accent/5">
            <dt className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                {icon}
                {dot ? <div className={cn('size-2 rounded-full', dot)} /> : null}
                {label}
            </dt>
            <dd className={cn('text-2xl font-bold', valueClass ?? 'text-card-foreground')}>
                {value}
                {unit ? <span className="text-sm font-normal ml-1 text-muted-foreground">{unit}</span> : null}
            </dd>
        </div>
    );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
    return (
        <h4 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {icon}
            {title}
        </h4>
    );
}


