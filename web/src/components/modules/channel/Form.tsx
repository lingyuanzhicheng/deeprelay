import { AutoGroupType, ChannelType, KeyCostType, KeySelectMode, type Channel, useFetchModel } from '@/api/endpoints/channel';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/common/Toast';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X, Plus, GripVertical, RotateCcw } from 'lucide-react';
import { cn, formatMoney } from '@/lib/utils';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';

export interface ChannelKeyFormItem {
    id?: number;
    client_id?: string;
    enabled: boolean;
    channel_key: string;
    status_code?: number;
    last_use_time_stamp?: number;
    used_cost?: number;
    remark?: string;

    // 成本控制
    cost_type?: KeyCostType;
    period_quota?: number;
    reset_period?: number;
    period_start?: number;
    max_cost?: number;

    // 流量控制
    max_rpm?: number;
    max_concurrent?: number;

    // 负载均衡参数
    priority?: number;
    weight?: number;
}

export interface ChannelFormData {
    name: string;
    type: ChannelType;
    base_urls: Channel['base_urls'];
    custom_header: Channel['custom_header'];
    channel_proxy: string;
    param_override: string;
    keys: ChannelKeyFormItem[];
    model: string;
    custom_model: string;
    enabled: boolean;
    proxy: boolean;
    auto_sync: boolean;
    auto_group: AutoGroupType;
    match_regex: string;
    key_select_mode: KeySelectMode;
}

export interface ChannelFormProps {
    formData: ChannelFormData;
    onFormDataChange: (data: ChannelFormData) => void;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    isPending: boolean;
    submitText: string;
    pendingText: string;
    onCancel?: () => void;
    cancelText?: string;
    idPrefix?: string;
    onResetKeyCost?: (keyId: number) => void;
}

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

function formatDateTimeLocal(timestamp?: number): string {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDateTimeLocal(value: string): number | undefined {
    if (!value) return undefined;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? undefined : Math.floor(timestamp / 1000);
}

function formatNumberEmpty(value: number | undefined): string {
    if (value === undefined || value === null) return '';
    return value === 0 ? '' : String(value);
}

export function ChannelForm({
    formData,
    onFormDataChange,
    onSubmit,
    isPending,
    submitText,
    pendingText,
    onCancel,
    cancelText,
    idPrefix = 'channel',
    onResetKeyCost,
}: ChannelFormProps) {
    const t = useTranslations('channel.form');

    // Ensure the form always shows at least 1 row for base_urls / keys / custom_header.
    // This avoids "empty list" UI and also keeps URL + APIKEY layout consistent.
    useEffect(() => {
        if (!formData.base_urls || formData.base_urls.length === 0) {
            onFormDataChange({ ...formData, base_urls: [{ url: '', delay: 0 }] });
            return;
        }
        if (!formData.keys || formData.keys.length === 0) {
            onFormDataChange({ ...formData, keys: [{ enabled: true, channel_key: '', remark: '' }] });
            return;
        }
        if (!formData.custom_header || formData.custom_header.length === 0) {
            onFormDataChange({ ...formData, custom_header: [{ header_key: '', header_value: '' }] });
        }
    }, [formData, onFormDataChange]);

    const autoModels = formData.model
        ? formData.model.split(',').map((m) => m.trim()).filter(Boolean)
        : [];
    const customModels = formData.custom_model
        ? formData.custom_model.split(',').map((m) => m.trim()).filter(Boolean)
        : [];
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const fetchModel = useFetchModel();

    const effectiveKey =
        formData.keys.find((k) => k.enabled && k.channel_key.trim())?.channel_key.trim() || '';

    const updateModels = (nextAuto: string[], nextCustom: string[]) => {
        const model = nextAuto.join(',');
        const custom_model = nextCustom.join(',');
        if (formData.model === model && formData.custom_model === custom_model) return;
        onFormDataChange({ ...formData, model, custom_model });
    };

    const handleRefreshModels = async () => {
        if (!formData.base_urls?.[0]?.url || !effectiveKey) return;
        fetchModel.mutate(
            {
                type: formData.type,
                base_urls: formData.base_urls,
                keys: formData.keys
                    .filter((k) => k.channel_key.trim())
                    .map((k) => ({ enabled: k.enabled, channel_key: k.channel_key.trim() })),
                proxy: formData.proxy,
                channel_proxy: formData.channel_proxy?.trim() || null,
                match_regex: formData.match_regex.trim() || null,
                custom_header: formData.custom_header?.filter((h) => h.header_key.trim()) || [],
            },
            {
                onSuccess: (data) => {
                    if (data && data.length > 0) {
                        const nextAuto = Array.from(new Set([...autoModels, ...data].map((m) => m.trim()).filter(Boolean)));
                        updateModels(nextAuto, customModels);
                        toast.success(t('modelRefreshSuccess'));
                    } else {
                        toast.warning(t('modelRefreshEmpty'));
                    }
                },
                onError: (error) => {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    toast.error(t('modelRefreshFailed'), { description: errorMessage });
                },
            }
        );
    };

    const handleAddModel = (model: string) => {
        const trimmedModel = model.trim();
        if (trimmedModel && !customModels.includes(trimmedModel) && !autoModels.includes(trimmedModel)) {
            updateModels(autoModels, [...customModels, trimmedModel]);
        }
        setInputValue('');
    };

    const handleRemoveAutoModel = (model: string) => {
        updateModels(autoModels.filter(m => m !== model), customModels);
    };

    const handleRemoveCustomModel = (model: string) => {
        updateModels(autoModels, customModels.filter(m => m !== model));
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (inputValue.trim()) handleAddModel(inputValue);
        }
    };

    const handleAddKey = () => {
        onFormDataChange({
            ...formData,
            keys: [
                ...formData.keys,
                {
                    enabled: true,
                    channel_key: '',
                    remark: '',
                    client_id: crypto.randomUUID(),
                },
            ],
        });
    };

    const handleUpdateKey = (idx: number, patch: Partial<ChannelKeyFormItem>) => {
        const next = formData.keys.map((k, i) => (i === idx ? { ...k, ...patch } : k));
        onFormDataChange({ ...formData, keys: next });
    };

    const handleRemoveKey = (idx: number) => {
        const curr = formData.keys ?? [];
        if (curr.length <= 1) return;
        const next = curr.filter((_, i) => i !== idx);
        onFormDataChange({ ...formData, keys: next });
    };

    const handleKeyDragEnd = (result: DropResult) => {
        if (!result.destination || result.destination.index === result.source.index) return;
        const next = [...formData.keys];
        const [moved] = next.splice(result.source.index, 1);
        if (!moved) return;
        next.splice(result.destination.index, 0, moved);
        onFormDataChange({
            ...formData,
            keys: next.map((key, index) => ({ ...key, priority: index + 1, client_id: key.client_id })),
        });
    };

    const handleAddBaseUrl = () => {
        onFormDataChange({
            ...formData,
            base_urls: [...(formData.base_urls ?? []), { url: '', delay: 0 }],
        });
    };

    const handleUpdateBaseUrl = (idx: number, patch: Partial<Channel['base_urls'][number]>) => {
        const next = (formData.base_urls ?? []).map((u, i) => (i === idx ? { ...u, ...patch } : u));
        onFormDataChange({ ...formData, base_urls: next });
    };

    const handleRemoveBaseUrl = (idx: number) => {
        const curr = formData.base_urls ?? [];
        if (curr.length <= 1) return;
        onFormDataChange({ ...formData, base_urls: curr.filter((_, i) => i !== idx) });
    };

    const handleAddHeader = () => {
        onFormDataChange({
            ...formData,
            custom_header: [...(formData.custom_header ?? []), { header_key: '', header_value: '' }],
        });
    };

    const handleUpdateHeader = (idx: number, patch: Partial<Channel['custom_header'][number]>) => {
        const next = (formData.custom_header ?? []).map((h, i) => (i === idx ? { ...h, ...patch } : h));
        onFormDataChange({ ...formData, custom_header: next });
    };

    const handleRemoveHeader = (idx: number) => {
        const curr = formData.custom_header ?? [];
        if (curr.length <= 1) return;
        onFormDataChange({ ...formData, custom_header: curr.filter((_, i) => i !== idx) });
    };

    return (
        <form onSubmit={onSubmit} className="space-y-4 px-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label htmlFor={`${idPrefix}-name`} className="text-sm font-medium text-card-foreground">
                        {t('name')}
                    </label>
                    <Input
                        className='rounded-xl'
                        id={`${idPrefix}-name`}
                        type="text"
                        value={formData.name}
                        onChange={(event) => onFormDataChange({ ...formData, name: event.target.value })}
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor={`${idPrefix}-type`} className="text-sm font-medium text-card-foreground">
                        {t('type')}
                    </label>
                    <Select
                        value={String(formData.type)}
                        onValueChange={(value) => onFormDataChange({ ...formData, type: Number(value) as ChannelType })}
                    >
                        <SelectTrigger id={`${idPrefix}-type`} className="rounded-xl w-full border border-border px-4 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className='rounded-xl'>
                            <SelectItem className='rounded-xl' value={String(ChannelType.OpenAIChat)}>{t('typeOpenAIChat')}</SelectItem>
                            <SelectItem className='rounded-xl' value={String(ChannelType.OpenAIResponse)}>{t('typeOpenAIResponse')}</SelectItem>
                            <SelectItem className='rounded-xl' value={String(ChannelType.Anthropic)}>{t('typeAnthropic')}</SelectItem>
                            <SelectItem className='rounded-xl' value={String(ChannelType.Gemini)}>{t('typeGemini')}</SelectItem>
                            <SelectItem className='rounded-xl' value={String(ChannelType.Volcengine)}>{t('typeVolcengine')}</SelectItem>
                            <SelectItem className='rounded-xl' value={String(ChannelType.OpenAIEmbedding)}>{t('typeOpenAIEmbedding')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-card-foreground">
                        {t('baseUrls')} {formData.base_urls.length > 0 ? `(${formData.base_urls.length})` : ''}
                    </label>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAddBaseUrl}
                        className="h-6 px-2 text-xs text-muted-foreground/70 hover:text-muted-foreground hover:bg-transparent"
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        {t('add')}
                    </Button>
                </div>
                <div className="space-y-2">
                    {(formData.base_urls ?? []).map((u, idx) => (
                        <div key={`baseurl-${idx}`} className="flex items-center gap-2">
                            <Input
                                id={`${idPrefix}-base-${idx}`}
                                type="url"
                                value={u.url}
                                onChange={(e) => handleUpdateBaseUrl(idx, { url: e.target.value })}
                                placeholder={t('baseUrlUrl')}
                                required={idx === 0}
                                className="rounded-xl flex-1"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveBaseUrl(idx)}
                                disabled={(formData.base_urls ?? []).length <= 1}
                                className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-destructive disabled:opacity-40 hover:bg-transparent"
                                title="Remove"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-card-foreground">
                        {t('apiKey')} {formData.keys.length > 0 ? `(${formData.keys.length})` : ''}
                    </label>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAddKey}
                        className="h-6 px-2 text-xs text-muted-foreground/70 hover:text-muted-foreground hover:bg-transparent"
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        {t('add')}
                    </Button>
                </div>
                <div className="flex gap-1">
                    {([
                        [KeySelectMode.CostAware, t('keySelectCostAware')],
                        [KeySelectMode.RoundRobin, t('keySelectRoundRobin')],
                        [KeySelectMode.Random, t('keySelectRandom')],
                        [KeySelectMode.Failover, t('keySelectFailover')],
                        [KeySelectMode.Weighted, t('keySelectWeighted')],
                    ] as const).map(([mode, label]) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => onFormDataChange({ ...formData, key_select_mode: mode })}
                            className={cn(
                                'min-w-0 flex-1 rounded-lg px-1.5 py-1 text-xs font-medium transition-colors',
                                formData.key_select_mode === mode
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-foreground hover:bg-muted/80'
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <DragDropContext onDragEnd={handleKeyDragEnd}>
                    <Droppable droppableId="channel-keys">
                        {(provided) => (
                            <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className="space-y-2"
                            >
                                 {(formData.keys ?? []).map((k, idx) => (
                                    <Draggable
                                        key={k.id ?? `new-${idx}`}
                                        draggableId={String(k.id ?? k.client_id ?? `new-${idx}`)}
                                        index={idx}
                                    >
                                        {(draggableProvided, snapshot) => {
                                            const content = (
                                                <div
                                                    ref={draggableProvided.innerRef}
                                                    {...draggableProvided.draggableProps}
                                                    className="space-y-2 rounded-xl border border-border/50 p-2"
                                                    style={{
                                                        ...(draggableProvided.draggableProps?.style ?? {}),
                                                        ...(snapshot.isDragging ? { zIndex: 50, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' } : null),
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn(
                                                            'size-5 rounded-md text-xs font-bold grid place-items-center shrink-0',
                                                            !k.enabled ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                                                        )}>
                                                            {idx + 1}
                                                        </span>
                                                        <div
                                                            {...draggableProvided.dragHandleProps}
                                                            className="shrink-0 text-muted-foreground/50 cursor-grab active:cursor-grabbing"
                                                        >
                                                            <GripVertical className="h-4 w-4" />
                                                        </div>
                                                        <Input
                                                            type="text"
                                                            value={k.channel_key}
                                                            onChange={(e) => handleUpdateKey(idx, { channel_key: e.target.value })}
                                                            placeholder={t('apiKey')}
                                                            required={idx === 0}
                                                            className="min-w-0 flex-1 rounded-xl"
                                                        />
                                                        <Switch
                                                            checked={k.enabled}
                                                            onCheckedChange={(checked) => handleUpdateKey(idx, { enabled: checked })}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleRemoveKey(idx)}
                                                            disabled={(formData.keys ?? []).length <= 1}
                                                            className="h-8 w-8 shrink-0 rounded-xl p-0 text-muted-foreground hover:bg-transparent hover:text-destructive disabled:opacity-40"
                                                            title="Remove"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="text"
                                                            value={k.remark ?? ''}
                                                            onChange={(e) => handleUpdateKey(idx, { remark: e.target.value })}
                                                            placeholder={t('remark')}
                                                            className="min-w-0 flex-1 rounded-xl"
                                                        />
                                                        <Select
                                                            value={String(k.cost_type ?? KeyCostType.Unlimited)}
                                                            onValueChange={(value) => handleUpdateKey(idx, { cost_type: Number(value) as KeyCostType })}
                                                        >
                                                            <SelectTrigger className="w-32 shrink-0 rounded-xl text-xs">
                                                                <SelectValue placeholder={t('costType')} />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl">
                                                                <SelectItem value="0">{t('costQuotaUnlimited')}</SelectItem>
                                                                <SelectItem value="1">{t('costPeriod')}</SelectItem>
                                                                <SelectItem value="2">{t('costPayAsYouGo')}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <div className="flex min-w-0 items-center gap-1">
                                                            <Input
                                                                readOnly
                                                                value=""
                                                                placeholder={`${formatMoney(k.used_cost ?? 0).formatted.value}${formatMoney(k.used_cost ?? 0).formatted.unit} ${t('usedCost')}`}
                                                                aria-label={t('usedCost')}
                                                                className="w-32 rounded-xl text-xs"
                                                            />
                                                            {onResetKeyCost && k.id && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => onResetKeyCost(k.id as number)}
                                                                    className="h-8 w-8 shrink-0 rounded-xl p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                                    title={t('resetCost')}
                                                                >
                                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="grid gap-2"
                                                        style={{
                                                            gridTemplateColumns:
                                                                formData.key_select_mode === KeySelectMode.Weighted && k.cost_type === KeyCostType.PayAsYouGo
                                                                    ? 'repeat(4, 1fr)'
                                                                    : formData.key_select_mode === KeySelectMode.Weighted || k.cost_type === KeyCostType.PayAsYouGo
                                                                        ? 'repeat(3, 1fr)'
                                                                        : 'repeat(2, 1fr)',
                                                        }}
                                                    >
                                                    {(formData.key_select_mode === KeySelectMode.Weighted) && (
                                                        <Input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={k.weight ?? 1}
                                                            onChange={(e) => handleUpdateKey(idx, { weight: e.target.value ? Math.max(1, Number(e.target.value)) : 1 })}
                                                            placeholder={t('weight')}
                                                            className="rounded-xl text-xs"
                                                        />
                                                    )}
                                                        <Input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={formatNumberEmpty(k.max_rpm)}
                                                            onChange={(e) => handleUpdateKey(idx, { max_rpm: e.target.value ? Math.max(0, Number(e.target.value)) : undefined })}
                                                            placeholder={t('maxRPM')}
                                                            className="rounded-xl text-xs"
                                                        />
                                                        <Input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={formatNumberEmpty(k.max_concurrent)}
                                                            onChange={(e) => handleUpdateKey(idx, { max_concurrent: e.target.value ? Math.max(0, Number(e.target.value)) : undefined })}
                                                            placeholder={t('maxConcurrent')}
                                                            className="rounded-xl text-xs"
                                                        />
                                                        {k.cost_type === KeyCostType.PayAsYouGo && (
                                                            <Input
                                                                type="text"
                                                                inputMode="numeric"
                                                                value={formatNumberEmpty(k.max_cost)}
                                                                onChange={(e) => handleUpdateKey(idx, { max_cost: e.target.value && Number(e.target.value) > 0 ? Number(e.target.value) : undefined })}
                                                                placeholder={t('maxCost')}
                                                                required
                                                                className="rounded-xl text-xs"
                                                            />
                                                        )}
                                                    </div>
                                                    {k.cost_type === KeyCostType.Period && (
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <Input
                                                                type="datetime-local"
                                                                value={formatDateTimeLocal(k.period_start)}
                                                                onChange={(e) => handleUpdateKey(idx, { period_start: parseDateTimeLocal(e.target.value) })}
                                                                aria-label={t('periodStart')}
                                                                required
                                                                className="rounded-xl text-xs"
                                                            />
                                                            <Input
                                                                type="text"
                                                                inputMode="numeric"
                                                                value={formatNumberEmpty(k.reset_period)}
                                                                onChange={(e) => handleUpdateKey(idx, { reset_period: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })}
                                                                placeholder={t('resetPeriod')}
                                                                required
                                                                className="rounded-xl text-xs"
                                                            />
                                                            <Input
                                                                type="text"
                                                                inputMode="numeric"
                                                                value={formatNumberEmpty(k.period_quota)}
                                                                onChange={(e) => handleUpdateKey(idx, { period_quota: e.target.value && Number(e.target.value) > 0 ? Number(e.target.value) : undefined })}
                                                                placeholder={t('periodQuota')}
                                                                required
                                                                className="rounded-xl text-xs"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                            // 拖拽时 portal 到 body，避免祖先 transform / overflow-hidden 导致漂移
                                            if (snapshot.isDragging && typeof document !== 'undefined') {
                                                return createPortal(content, document.body);
                                            }
                                            return content;
                                        }}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-card-foreground">{t('model')}</label>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRefreshModels}
                        disabled={!formData.base_urls?.[0]?.url || !effectiveKey || fetchModel.isPending}
                        className="h-6 px-2 text-xs text-muted-foreground/50 hover:text-muted-foreground hover:bg-transparent"
                    >
                        <RefreshCw className={`h-3 w-3 mr-1 ${fetchModel.isPending ? 'animate-spin' : ''}`} />
                        {t('modelRefresh')}
                    </Button>
                </div>
                <input type="hidden" value={formData.model} required />

                <div className="relative">
                    <Input
                        ref={inputRef}
                        id={`${idPrefix}-model-custom`}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        placeholder={t('modelCustomPlaceholder')}
                        className="pr-10 rounded-xl"
                    />
                    {inputValue.trim() && !customModels.includes(inputValue.trim()) && !autoModels.includes(inputValue.trim()) && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddModel(inputValue)}
                            className="absolute rounded-lg right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                            title={t('modelAdd')}
                        >
                            <Plus className="size-4" />
                        </Button>
                    )}
                </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-card-foreground">
                        {t('modelSelected')} {(autoModels.length + customModels.length) > 0 && `(${autoModels.length + customModels.length})`}
                    </label>
                        {(autoModels.length + customModels.length) > 0 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    updateModels([], []);
                                }}
                                className="h-6 px-2 text-xs text-muted-foreground/50 hover:text-muted-foreground hover:bg-transparent"
                            >
                                {t('modelClearAll')}
                            </Button>
                        )}
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 p-2.5 max-h-40 min-h-12 overflow-y-auto">
                        {(autoModels.length + customModels.length) > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {autoModels.map((model) => (
                                    <Badge key={model} variant="secondary" className="bg-muted hover:bg-muted/80">
                                        {model}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveAutoModel(model)}
                                            className="ml-1 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                                {customModels.map((model) => (
                                    <Badge key={model} className="bg-primary hover:bg-primary/90">
                                        {model}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveCustomModel(model)}
                                            className="ml-1 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-8 text-xs text-muted-foreground">
                                {t('modelNoSelected')}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Accordion type="single" collapsible className="w-full border rounded-xl bg-card">
                <AccordionItem value="advanced" className="border-none">
                    <AccordionTrigger className="text-sm font-medium text-card-foreground py-3 px-4 hover:no-underline hover:bg-muted/30 rounded-xl transition-colors">
                        {t('advanced')}
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 px-4 pb-4 space-y-4 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label htmlFor={`${idPrefix}-auto-group`} className="text-sm font-medium text-card-foreground">
                                    {t('autoGroup')}
                                </label>
                                <Select
                                    value={String(formData.auto_group)}
                                    onValueChange={(value) => onFormDataChange({ ...formData, auto_group: Number(value) as AutoGroupType })}
                                >
                                    <SelectTrigger id={`${idPrefix}-auto-group`} className="rounded-xl w-full border border-border px-4 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className='rounded-xl'>
                                        <SelectItem className='rounded-xl' value={String(AutoGroupType.None)}>{t('autoGroupNone')}</SelectItem>
                                        <SelectItem className='rounded-xl' value={String(AutoGroupType.Fuzzy)}>{t('autoGroupFuzzy')}</SelectItem>
                                        <SelectItem className='rounded-xl' value={String(AutoGroupType.Exact)}>{t('autoGroupExact')}</SelectItem>
                                        <SelectItem className='rounded-xl' value={String(AutoGroupType.Regex)}>{t('autoGroupRegex')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor={`${idPrefix}-channel-proxy`} className="text-sm font-medium text-card-foreground">
                                    {t('channelProxy')}
                                </label>
                                <Input
                                    id={`${idPrefix}-channel-proxy`}
                                    type="text"
                                    value={formData.channel_proxy}
                                    onChange={(e) => onFormDataChange({ ...formData, channel_proxy: e.target.value })}
                                    placeholder={t('channelProxyPlaceholder')}
                                    className="rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-card-foreground">
                                    {t('customHeader')} {formData.custom_header.length > 0 ? `(${formData.custom_header.length})` : ''}
                                </label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleAddHeader}
                                    className="h-6 px-2 text-xs text-muted-foreground/70 hover:text-muted-foreground hover:bg-transparent"
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    {t('customHeaderAdd')}
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {(formData.custom_header ?? []).map((h, idx) => (
                                    <div key={`hdr-${idx}`} className="flex items-center gap-2">
                                        <Input
                                            type="text"
                                            value={h.header_key}
                                            onChange={(e) => handleUpdateHeader(idx, { header_key: e.target.value })}
                                            placeholder={t('customHeaderKey')}
                                            className="rounded-xl flex-1"
                                        />
                                        <Input
                                            type="text"
                                            value={h.header_value}
                                            onChange={(e) => handleUpdateHeader(idx, { header_value: e.target.value })}
                                            placeholder={t('customHeaderValue')}
                                            className="rounded-xl flex-1"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemoveHeader(idx)}
                                            disabled={(formData.custom_header ?? []).length <= 1}
                                            className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-destructive hover:bg-transparent disabled:opacity-40"
                                            title="Remove"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor={`${idPrefix}-match-regex`} className="text-sm font-medium text-card-foreground">
                                {t('matchRegex')}
                            </label>
                            <Input
                                id={`${idPrefix}-match-regex`}
                                type="text"
                                value={formData.match_regex}
                                onChange={(e) => onFormDataChange({ ...formData, match_regex: e.target.value })}
                                placeholder={t('matchRegexPlaceholder')}
                                className="rounded-xl"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor={`${idPrefix}-param-override`} className="text-sm font-medium text-card-foreground">
                                {t('paramOverride')}
                            </label>
                            <textarea
                                id={`${idPrefix}-param-override`}
                                value={formData.param_override}
                                onChange={(e) => onFormDataChange({ ...formData, param_override: e.target.value })}
                                placeholder={t('paramOverridePlaceholder')}
                                className="min-h-28 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-muted/20 border border-border/50">
                <label className="flex items-center gap-2 cursor-pointer">
                    <Switch
                        checked={formData.enabled}
                        onCheckedChange={(checked) => onFormDataChange({ ...formData, enabled: checked })}
                    />
                    <span className="text-sm font-medium text-card-foreground">{t('enabled')}</span>
                </label>
                <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <Switch
                            checked={formData.proxy}
                            onCheckedChange={(checked) => onFormDataChange({ ...formData, proxy: checked })}
                        />
                        <span className="text-sm text-card-foreground">{t('proxy')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <Switch
                            checked={formData.auto_sync}
                            onCheckedChange={(checked) => onFormDataChange({ ...formData, auto_sync: checked })}
                        />
                        <span className="text-sm text-card-foreground">{t('autoSync')}</span>
                    </label>
                </div>
            </div>

            <div className={`flex flex-col gap-3 pt-2 ${onCancel ? 'sm:flex-row' : ''}`}>
                {onCancel && cancelText && (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onCancel}
                        className="w-full sm:flex-1 rounded-2xl h-12"
                    >
                        {cancelText}
                    </Button>
                )}
                <Button
                    type="submit"
                    disabled={isPending}
                    className="w-full sm:flex-1 rounded-2xl h-12"
                >
                    {isPending ? pendingText : submitText}
                </Button>
            </div>
        </form>
    );
}
