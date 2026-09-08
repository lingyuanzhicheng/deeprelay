'use client';

import { memo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDownToLine, ArrowUpFromLine, FileText, Coins, Loader2, MessageSquare, TrendingUp, Tag, Hash, Type, Layers, Database, Gauge, Bot } from 'lucide-react';
import { useUpdateLLMInfo, type LLMInfo, type LLMInfoItem } from '@/api/endpoints/llminfo';
import { useAuthStore } from '@/api/endpoints/user';
import { getModelIcon } from '@/lib/model-icons';
import { formatCount } from '@/lib/utils';
import { toast } from '@/components/common/Toast';
import { CopyIconButton } from '@/components/common/CopyButton';
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
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

type FormState = Omit<LLMInfo, 'id' | 'group_id'>;
type PriceFieldKey = 'input_price' | 'output_price' | 'cache_read_price' | 'cache_write_price';
type View = 'stats' | 'detail' | 'editing';

function toFormState(item: LLMInfoItem): FormState {
    return {
        lab: item.lab,
        family: item.family,
        endpoint: item.endpoint,
        context_limit: item.context_limit,
        output_limit: item.output_limit,
        input_type: item.input_type,
        output_type: item.output_type,
        tools: item.tools,
        reasoning: item.reasoning,
        structured: item.structured,
        temperature: item.temperature,
        input_price: item.input_price,
        output_price: item.output_price,
        cache_read_price: item.cache_read_price,
        cache_write_price: item.cache_write_price,
        instruction: item.instruction,
    };
}

function parsePriceInput(raw: string): number | null {
    const s = raw.trim();
    if (s === '') return 0;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
}

// family 为空时落回 group_name，沿用 octopus 的 getModelIcon 默认配置兜底（OpenAI Avatar）。
function logoKey(item: LLMInfoItem): string {
    return item.family.trim() !== '' ? item.family : item.group_name;
}

function FieldRow({
    id,
    label,
    value,
    onChange,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="space-y-2">
            <label htmlFor={`llminfo-${id}`} className="text-sm font-medium text-card-foreground">
                {label}
            </label>
            <Input
                id={`llminfo-${id}`}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="rounded-xl"
            />
        </div>
    );
}

// 只读字段行：图标 + 标签 + 值
function ReadOnlyRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
    return (
        <div className="flex items-start gap-3 rounded-xl border bg-card p-3 sm:p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" />
            </span>
            <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-sm font-medium text-card-foreground break-all">{value || '—'}</span>
            </div>
        </div>
    );
}

function formatPrice(value: number): string {
    return value.toFixed(2);
}

function StatIcon({ children }: { children: React.ReactNode }) {
    return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            {children}
        </span>
    );
}

export const ModelCard = memo(function ModelCard({ item }: { item: LLMInfoItem }) {
    const t = useTranslations('llminfo');
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const { Avatar } = getModelIcon(logoKey(item));

    const statTotal = item.stats.request_success + item.stats.request_failed;
    const successRate = statTotal > 0 ? `${((item.stats.request_success / statTotal) * 100).toFixed(1)}%` : '—';

    return (
        <MorphingDialog open={isInfoOpen} onOpenChange={setIsInfoOpen}>
            <MorphingDialogTrigger className="block w-full cursor-pointer text-left">
                <article className="group relative rounded-3xl border border-border bg-card flex flex-col gap-3 p-4">
                    <div className="flex items-center gap-3">
                        <Avatar size={52} />

                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <Tooltip side="top" sideOffset={10} align="center">
                                    <TooltipTrigger asChild>
                                        <span className="min-w-0 flex-1 text-base font-semibold text-card-foreground leading-tight truncate">
                                            {item.group_name}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>{item.group_name}</TooltipContent>
                                </Tooltip>

                                <span onClick={(e) => e.stopPropagation()}>
                                    <CopyIconButton
                                        text={item.group_name}
                                        className="p-1.5 rounded-lg transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
                                        copyIconClassName="size-4"
                                        checkIconClassName="size-4 text-primary"
                                    />
                                </span>
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/80 px-2 py-1">
                                <div className="flex items-center gap-2">
                                    <StatIcon>
                                        <Gauge className="size-3.5" />
                                    </StatIcon>
                                    <span className="text-xs text-muted-foreground">{t('info.successRate')}</span>
                                </div>
                                <span className="text-xs font-semibold text-card-foreground tabular-nums">{successRate}</span>
                            </div>
                        </div>
                    </div>

                <div className="grid gap-1.5">
                    {([
                        { icon: ArrowDownToLine, label: t('info.inputPrice'), value: item.input_price },
                        { icon: ArrowUpFromLine, label: t('info.outputPrice'), value: item.output_price },
                        { icon: Database, label: t('info.cacheWritePrice'), value: item.cache_write_price },
                        { icon: Database, label: t('info.cacheReadPrice'), value: item.cache_read_price },
                    ] as Array<{ icon: React.ComponentType<{ className?: string }>; label: string; value: number }>).map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/80 px-2 py-1">
                            <div className="flex items-center gap-2">
                                <StatIcon>
                                    <Icon className="size-3.5" />
                                </StatIcon>
                                <span className="text-xs text-muted-foreground">{label}</span>
                            </div>
                                <span className="flex items-center gap-1 text-xs font-semibold text-card-foreground tabular-nums"><Coins className="size-3 text-muted-foreground" />{formatPrice(value)}</span>
                        </div>
                    ))}
                </div>

                <dl className="grid grid-cols-1 gap-3">
                    <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 p-2">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <MessageSquare className="h-5 w-5" />
                            </span>
                            <dt className="text-sm text-muted-foreground">{t('info.requestCount')}</dt>
                        </div>
                        <dd className="text-base">
                            {formatCount(item.stats.request_success + item.stats.request_failed).formatted.value}
                            <span className="ml-1 text-xs text-muted-foreground">
                                {formatCount(item.stats.request_success + item.stats.request_failed).formatted.unit}
                            </span>
                        </dd>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 p-2">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Hash className="h-5 w-5" />
                            </span>
                            <dt className="text-sm text-muted-foreground">{t('info.totalToken')}</dt>
                        </div>
                        <dd className="text-base">
                            {(() => {
                                const total = item.stats.input_token + item.stats.output_token + item.stats.cache_read_token + item.stats.cache_write_token;
                                const formatted = formatCount(total);
                                return <>{formatted.formatted.value}<span className="ml-1 text-xs text-muted-foreground">{formatted.formatted.unit}</span></>;
                            })()}
                        </dd>
                    </div>
                </dl>
                </article>
            </MorphingDialogTrigger>

            <MorphingDialogContainer>
                <MorphingDialogContent className="w-full md:max-w-xl bg-card text-card-foreground px-4 py-2 rounded-3xl max-h-[90vh] overflow-y-auto">
                    <ModelContent item={item} />
                </MorphingDialogContent>
            </MorphingDialogContainer>
        </MorphingDialog>
    );
});

function ModelContent({ item }: { item: LLMInfoItem }) {
    const t = useTranslations('llminfo');
    const { setIsOpen } = useMorphingDialog();
    const isKeyAuth = useAuthStore((s) => s.isAPIKeyAuth);
    const update = useUpdateLLMInfo();
    const [view, setView] = useState<View>('detail');
    const [form, setForm] = useState<FormState>(() => toFormState(item));
    const [priceInputs, setPriceInputs] = useState<Record<PriceFieldKey, string>>({
        input_price: String(item.input_price),
        output_price: String(item.output_price),
        cache_read_price: String(item.cache_read_price),
        cache_write_price: String(item.cache_write_price),
    });

    const totalTokens = item.stats.input_token + item.stats.output_token + item.stats.cache_read_token + item.stats.cache_write_token;
    const totalCost = item.stats.input_cost + item.stats.output_cost + item.stats.cache_read_cost + item.stats.cache_write_cost;
    const requestCount = item.stats.request_success + item.stats.request_failed;

    const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const prices: Record<PriceFieldKey, number> = {
            input_price: 0,
            output_price: 0,
            cache_read_price: 0,
            cache_write_price: 0,
        };
        for (const key of Object.keys(prices) as PriceFieldKey[]) {
            const parsed = parsePriceInput(priceInputs[key]);
            if (parsed === null) {
                toast.error(t('toast.invalidPrice'));
                return;
            }
            prices[key] = parsed;
        }

        update.mutate(
            { id: item.id, group_id: item.group_id, ...form, ...prices },
            {
                onSuccess: () => {
                    toast.success(t('toast.updated'));
                    setView('detail');
                    setIsOpen(false);
                },
                onError: (e) => toast.error(t('toast.updateFailed'), { description: e.message }),
            },
        );
    };

    const capabilities = [
        { key: 'tools', label: t('edit.tools') },
        { key: 'reasoning', label: t('edit.reasoning') },
        { key: 'structured', label: t('edit.structured') },
        { key: 'temperature', label: t('edit.temperature') },
    ];

    return (
        <>
            <MorphingDialogTitle>
                <header className="mb-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-card-foreground">
                        {t(view === 'stats' ? 'title.stats' : view === 'editing' ? 'title.edit' : 'title.detail')}
                    </h2>
                    <MorphingDialogClose
                        className="relative top-0 right-0"
                        variants={{
                            initial: { opacity: 0, scale: 0.8 },
                            animate: { opacity: 1, scale: 1 },
                            exit: { opacity: 0, scale: 0.8 }
                        }}
                    />
                </header>
            </MorphingDialogTitle>

            <MorphingDialogDescription>
                <Tabs value={view} onValueChange={(v) => setView(v as View)}>
                    <TabsContents>
                        {/* 统计：原详情数据 */}
                        <TabsContent value="stats">
                            <div className="max-h-[60vh] overflow-y-auto space-y-4 sm:space-y-5">
                                <dl className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                                    <div className="rounded-2xl border bg-linear-to-br from-chart-1/10 to-chart-1/5 p-3 sm:p-4">
                                        <dt className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
                                            <TrendingUp className="size-4 text-chart-1" />
                                            {t('info.totalRequests')}
                                        </dt>
                                        <dd className="text-xl sm:text-2xl font-bold text-chart-1">
                                            {formatCount(requestCount).formatted.value}
                                            <span className="text-xs font-normal ml-1 text-muted-foreground">{formatCount(requestCount).formatted.unit}</span>
                                        </dd>
                                    </div>

                                    <div className="rounded-2xl border bg-linear-to-br from-chart-3/10 to-chart-3/5 p-3 sm:p-4">
                                        <dt className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
                                            <FileText className="size-4 text-chart-3" />
                                            {t('info.totalToken')}
                                        </dt>
                                        <dd className="text-xl sm:text-2xl font-bold text-chart-3">
                                            {formatCount(totalTokens).formatted.value}
                                            <span className="text-xs font-normal ml-1 text-muted-foreground">{formatCount(totalTokens).formatted.unit}</span>
                                        </dd>
                                    </div>

                                    <div className="rounded-2xl border bg-linear-to-br from-chart-5/10 to-chart-5/5 p-3 sm:p-4">
                                        <dt className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
                                            <Coins className="size-4 text-chart-5" />
                                            {t('info.totalFunding')}
                                        </dt>
                                        <dd className="text-xl sm:text-2xl font-bold text-chart-5">
                                            {formatCount(totalCost).formatted.value}
                                            <span className="text-xs font-normal ml-1 text-muted-foreground">{formatCount(totalCost).formatted.unit}</span>
                                        </dd>
                                    </div>
                                </dl>

                                <section className="space-y-3">
                                    <h4 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        <TrendingUp className="size-3.5" />
                                        {t('info.request')}
                                    </h4>
                                    <dl className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                        <div className="rounded-2xl border bg-card p-3 sm:p-4 transition-colors hover:bg-accent/5">
                                            <dt className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                                <div className="size-2 rounded-full bg-accent" />
                                                {t('info.successRequests')}
                                            </dt>
                                            <dd className="text-2xl font-bold text-accent">
                                                {formatCount(item.stats.request_success).formatted.value}
                                                <span className="text-sm font-normal ml-1 text-muted-foreground">{formatCount(item.stats.request_success).formatted.unit}</span>
                                            </dd>
                                        </div>

                                        <div className="rounded-2xl border bg-card p-3 sm:p-4 transition-colors hover:bg-accent/5">
                                            <dt className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                                <div className="size-2 rounded-full bg-destructive" />
                                                {t('info.failedRequests')}
                                            </dt>
                                            <dd className="text-2xl font-bold text-destructive">
                                                {formatCount(item.stats.request_failed).formatted.value}
                                                <span className="text-sm font-normal ml-1 text-muted-foreground">{formatCount(item.stats.request_failed).formatted.unit}</span>
                                            </dd>
                                        </div>
                                    </dl>
                                </section>

                                <section className="space-y-3">
                                    <h4 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        <FileText className="size-3.5" />
                                        {t('info.totalToken')}
                                    </h4>
                                    <dl className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                        {([
                                            { key: 'input_token', label: t('info.inputToken'), color: 'bg-chart-1' },
                                            { key: 'output_token', label: t('info.outputToken'), color: 'bg-chart-3' },
                                            { key: 'cache_read_token', label: t('info.cacheReadToken'), color: 'bg-chart-4' },
                                            { key: 'cache_write_token', label: t('info.cacheWriteToken'), color: 'bg-chart-2' },
                                        ] as Array<{ key: keyof typeof item.stats; label: string; color: string }>).map(({ key, label, color }) => {
                                            const value = item.stats[key] as number;
                                            const formatted = formatCount(value);
                                            return (
                                                <div key={key} className="rounded-2xl border bg-card p-3 sm:p-4 transition-colors hover:bg-accent/5">
                                                    <dt className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                                        <div className={`size-2 rounded-full ${color}`} />
                                                        {label}
                                                    </dt>
                                                    <dd className="text-2xl font-bold text-card-foreground">
                                                        {formatted.formatted.value}
                                                        <span className="text-sm font-normal ml-1 text-muted-foreground">{formatted.formatted.unit}</span>
                                                    </dd>
                                                </div>
                                            );
                                        })}
                                    </dl>
                                </section>

                                <section className="space-y-3">
                                    <h4 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        <Coins className="size-3.5" />
                                        {t('sections.funding')}
                                    </h4>
                                    <dl className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                        {([
                                            { key: 'input_cost', label: t('info.inputFunding'), color: 'bg-chart-2' },
                                            { key: 'output_cost', label: t('info.outputFunding'), color: 'bg-chart-5' },
                                            { key: 'cache_read_cost', label: t('info.cacheReadFunding'), color: 'bg-chart-4' },
                                            { key: 'cache_write_cost', label: t('info.cacheWriteFunding'), color: 'bg-chart-1' },
                                        ] as Array<{ key: keyof typeof item.stats; label: string; color: string }>).map(({ key, label, color }) => {
                                            const value = item.stats[key] as number;
                                            const formatted = formatCount(value);
                                            return (
                                                <div key={key} className="rounded-2xl border bg-card p-3 sm:p-4 transition-colors hover:bg-accent/5">
                                                    <dt className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                                        <div className={`size-2 rounded-full ${color}`} />
                                                        {label}
                                                    </dt>
                                                    <dd className="text-2xl font-bold text-card-foreground">
                                                        {formatted.formatted.value}
                                                        <span className="text-sm font-normal ml-1 text-muted-foreground">{formatted.formatted.unit}</span>
                                                    </dd>
                                                </div>
                                            );
                                        })}
                                    </dl>
                                </section>
                            </div>

                            <div className={cn('grid gap-3 pt-3', !isKeyAuth && 'sm:grid-cols-2')}>
                                <Button type="button" onClick={() => setView('detail')} className="w-full rounded-2xl h-12">
                                    {t('actions.detail')}
                                </Button>
                                {!isKeyAuth && (
                                    <Button type="button" variant="secondary" onClick={() => setView('editing')} className="w-full rounded-2xl h-12">
                                        {t('actions.edit')}
                                    </Button>
                                )}
                            </div>
                        </TabsContent>

                        {/* 详情：只读展示所有模型字段（厂商/系列/端点/上下文/输入输出类型/能力/价格/介绍） */}
                        <TabsContent value="detail">
                            <div className="max-h-[60vh] overflow-y-auto space-y-4 sm:space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <ReadOnlyRow icon={Bot} label={t('edit.name')} value={item.group_name} />
                                    <ReadOnlyRow icon={Type} label={t('edit.endpoint')} value={item.endpoint} />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <ReadOnlyRow icon={Tag} label={t('edit.vendor')} value={item.lab} />
                                    <ReadOnlyRow icon={Hash} label={t('edit.series')} value={item.family} />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <ReadOnlyRow icon={Hash} label={t('edit.contextLimit')} value={item.context_limit} />
                                    <ReadOnlyRow icon={Hash} label={t('edit.outputLimit')} value={item.output_limit} />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <ReadOnlyRow icon={Layers} label={t('edit.inputType')} value={item.input_type} />
                                    <ReadOnlyRow icon={Layers} label={t('edit.outputType')} value={item.output_type} />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-muted/20 border border-border/50">
                                    {capabilities.map(({ key, label }) => (
                                        <div key={key} className="flex items-center gap-2 text-sm text-card-foreground">
                                            <span className={cn('size-2 rounded-full', item[key as keyof typeof item] ? 'bg-accent' : 'bg-muted-foreground/40')} />
                                            <span>{label}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {([
                                        { icon: Coins, label: t('info.inputPrice'), value: `${item.input_price.toFixed(2)}` },
                                        { icon: Coins, label: t('info.outputPrice'), value: `${item.output_price.toFixed(2)}` },
                                        { icon: Coins, label: t('info.cacheReadPrice'), value: `${item.cache_read_price.toFixed(2)}` },
                                        { icon: Coins, label: t('info.cacheWritePrice'), value: `${item.cache_write_price.toFixed(2)}` },
                                    ] as Array<{ icon: React.ComponentType<{ className?: string }>; label: string; value: string }>).map(({ icon, label, value }) => (
                                        <ReadOnlyRow key={label} icon={icon} label={label} value={value} />
                                    ))}
                                </div>

                                <section className="space-y-3">
                                    <h4 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        <FileText className="size-3.5" />
                                        {t('info.instruction')}
                                    </h4>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-2xl border bg-card p-3 sm:p-4">{item.instruction || '—'}</p>
                                </section>
                            </div>

                            <div className={cn('grid gap-3 pt-3', !isKeyAuth && 'sm:grid-cols-2')}>
                                <Button type="button" variant="secondary" onClick={() => setView('stats')} className="w-full rounded-2xl h-12">
                                    {t('actions.stats')}
                                </Button>
                                {!isKeyAuth && (
                                    <Button type="button" variant="secondary" onClick={() => setView('editing')} className="w-full rounded-2xl h-12">
                                        {t('actions.edit')}
                                    </Button>
                                )}
                            </div>
                        </TabsContent>

                        {/* 编辑：表单 */}
                        <TabsContent value="editing">
                            <form onSubmit={handleSave} className="space-y-4 px-1">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FieldRow id="vendor" label={t('edit.vendor')} value={form.lab} onChange={(v) => setForm({ ...form, lab: v })} />
                                    <FieldRow id="series" label={t('edit.series')} value={form.family} onChange={(v) => setForm({ ...form, family: v })} />
                                </div>

                                <FieldRow id="endpoint" label={t('edit.endpoint')} value={form.endpoint} onChange={(v) => setForm({ ...form, endpoint: v })} />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FieldRow id="context_limit" label={t('edit.contextLimit')} value={form.context_limit} onChange={(v) => setForm({ ...form, context_limit: v })} />
                                    <FieldRow id="output_limit" label={t('edit.outputLimit')} value={form.output_limit} onChange={(v) => setForm({ ...form, output_limit: v })} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FieldRow id="input_type" label={t('edit.inputType')} value={form.input_type} onChange={(v) => setForm({ ...form, input_type: v })} />
                                    <FieldRow id="output_type" label={t('edit.outputType')} value={form.output_type} onChange={(v) => setForm({ ...form, output_type: v })} />
                                </div>

                                <div>
                                    <h4 className="text-sm font-medium text-card-foreground mb-2">
                                        {t('edit.capabilitiesSection')}
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-muted/20 border border-border/50">
                                        {([
                                            { key: 'tools', label: t('edit.tools') },
                                            { key: 'reasoning', label: t('edit.reasoning') },
                                            { key: 'structured', label: t('edit.structured') },
                                            { key: 'temperature', label: t('edit.temperature') },
                                        ] as Array<{ key: keyof FormState; label: string }>).map(({ key, label }) => (
                                            <label key={key} className="flex items-center gap-2 cursor-pointer">
                                                <Switch
                                                    checked={Boolean(form[key])}
                                                    onCheckedChange={(checked) => setForm({ ...form, [key]: checked })}
                                                />
                                                <span className="text-sm text-card-foreground">{label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {([
                                        { key: 'input_price', label: t('edit.inputPrice') },
                                        { key: 'output_price', label: t('edit.outputPrice') },
                                        { key: 'cache_read_price', label: t('edit.cacheReadPrice') },
                                        { key: 'cache_write_price', label: t('edit.cacheWritePrice') },
                                    ] as Array<{ key: PriceFieldKey; label: string }>).map(({ key, label }) => (
                                        <div key={key} className="space-y-2">
                                            <label htmlFor={`llminfo-${key}`} className="text-sm font-medium text-card-foreground">
                                                {label}
                                            </label>
                                            <Input
                                                id={`llminfo-${key}`}
                                                type="number"
                                                step="any"
                                                value={priceInputs[key]}
                                                onChange={(e) => setPriceInputs({ ...priceInputs, [key]: e.target.value })}
                                                className="rounded-xl"
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="llminfo-instruction" className="text-sm font-medium text-card-foreground">
                                        {t('edit.instruction')}
                                    </label>
                                    <textarea
                                        id="llminfo-instruction"
                                        value={form.instruction}
                                        onChange={(e) => setForm({ ...form, instruction: e.target.value })}
                                        rows={4}
                                        className="min-h-28 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                </div>

                                <div className="grid gap-3 sm:grid-cols-3 pt-2">
                                    <Button type="button" variant="secondary" onClick={() => setView('stats')} className="w-full rounded-2xl h-12">
                                        {t('actions.stats')}
                                    </Button>
                                    <Button type="button" variant="secondary" onClick={() => setView('detail')} className="w-full rounded-2xl h-12">
                                        {t('actions.detail')}
                                    </Button>
                                    <Button type="submit" disabled={update.isPending} className="w-full rounded-2xl h-12">
                                        {update.isPending && <Loader2 className="size-4 animate-spin" />}
                                        {update.isPending ? t('actions.saving') : t('edit.save')}
                                    </Button>
                                </div>
                            </form>
                        </TabsContent>
                    </TabsContents>
                </Tabs>
            </MorphingDialogDescription>
        </>
    );
}

function cn(...parts: Array<string | false | null | undefined>): string {
    return parts.filter(Boolean).join(' ');
}
