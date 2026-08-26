import { useState } from 'react';
import {
    Trash2,
    CheckCircle2,
    XCircle,
    FileText,
    DollarSign,
    Clock,
    Activity,
    TrendingUp,
    Globe,
    Key
} from 'lucide-react';
import {
    useUpdateChannel,
    useDeleteChannel,
    useResetChannelKeyCost,
    type Channel,
    type UpdateChannelRequest,
    KeyCostType,
} from '@/api/endpoints/channel';
import {
    MorphingDialogTitle,
    MorphingDialogDescription,
    MorphingDialogClose,
    useMorphingDialog,
} from '@/components/ui/morphing-dialog';
import { Tabs, TabsContents, TabsContent } from '@/components/animate-ui/primitives/animate/tabs';
import { type StatsMetricsFormatted } from '@/api/endpoints/stats';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ChannelForm, type ChannelFormData } from './Form';
import { formatMoney } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function CardContent({ channel, stats }: { channel: Channel; stats: StatsMetricsFormatted }) {
    const { setIsOpen } = useMorphingDialog();
    const updateChannel = useUpdateChannel();
    const deleteChannel = useDeleteChannel();
    const resetKeyCost = useResetChannelKeyCost();
    const [isEditing, setIsEditing] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [formData, setFormData] = useState<ChannelFormData>({
        name: channel.name,
        type: channel.type,
        enabled: channel.enabled,
        base_urls: channel.base_urls?.length ? channel.base_urls : [{ url: '', delay: 0 }],
        custom_header: channel.custom_header ?? [],
        channel_proxy: channel.channel_proxy ?? '',
        param_override: channel.param_override ?? '',
        keys: channel.keys.length > 0
            ? channel.keys.map((k) => ({
                id: k.id,
                client_id: k.id ? `key-${k.id}` : crypto.randomUUID(),
                enabled: k.enabled,
                channel_key: k.channel_key,
                status_code: k.status_code,
                last_use_time_stamp: k.last_use_time_stamp,
                used_cost: k.used_cost,
                remark: k.remark,
                cost_type: k.cost_type,
                period_quota: k.period_quota,
                reset_period: k.reset_period,
                period_start: k.period_start,
                max_cost: k.max_cost,
                max_rpm: k.max_rpm,
                max_concurrent: k.max_concurrent,
                priority: k.priority,
                weight: k.weight,
            }))
            : [{ enabled: true, channel_key: '', remark: '', client_id: crypto.randomUUID() }],
        model: channel.model,
        custom_model: channel.custom_model,
        proxy: channel.proxy,
        auto_sync: channel.auto_sync,
        auto_group: channel.auto_group,
        match_regex: channel.match_regex ?? '',
        key_select_mode: channel.key_select_mode,
    });
    const t = useTranslations('channel.detail');

    const currentView = isEditing ? 'editing' : 'viewing';

    const baseUrlsEqual = (a: Channel['base_urls'] | undefined, b: Channel['base_urls'] | undefined) =>
        JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
    const headersEqual = (a: Channel['custom_header'] | undefined, b: Channel['custom_header'] | undefined) =>
        JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

    const handleUpdate = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const req: UpdateChannelRequest = { id: channel.id };

        // only send changed fields to avoid accidental clears
        if (formData.name !== channel.name) req.name = formData.name;
        if (formData.type !== channel.type) req.type = formData.type;
        if (formData.enabled !== channel.enabled) req.enabled = formData.enabled;
        if (!baseUrlsEqual(formData.base_urls, channel.base_urls)) {
            req.base_urls = (formData.base_urls ?? []).filter((u) => u.url.trim()).map((u) => ({
                url: u.url.trim(),
                delay: Number(u.delay || 0),
            }));
        }
        if (formData.model !== channel.model) req.model = formData.model;
        if (formData.custom_model !== channel.custom_model) req.custom_model = formData.custom_model;
        if (formData.proxy !== channel.proxy) req.proxy = formData.proxy;
        if (formData.auto_sync !== channel.auto_sync) req.auto_sync = formData.auto_sync;
        if (formData.auto_group !== channel.auto_group) req.auto_group = formData.auto_group;
        if (formData.key_select_mode !== channel.key_select_mode) req.key_select_mode = formData.key_select_mode;

        if (!headersEqual(formData.custom_header, channel.custom_header)) {
            req.custom_header = (formData.custom_header ?? [])
                .map((h) => ({ header_key: h.header_key.trim(), header_value: h.header_value }))
                .filter((h) => h.header_key && h.header_value !== '');
        }

        const nextChannelProxy = formData.channel_proxy.trim();
        const curChannelProxy = channel.channel_proxy ?? '';
        if (nextChannelProxy !== curChannelProxy) {
            // Empty string means "clear" for patch semantics; backend maps it to NULL.
            req.channel_proxy = nextChannelProxy;
        }

        const nextParamOverride = formData.param_override.trim();
        const curParamOverride = channel.param_override ?? '';
        if (nextParamOverride !== curParamOverride) {
            // Empty string means "clear" for patch semantics; backend maps it to NULL.
            req.param_override = nextParamOverride;
        }

        const nextMatchRegex = formData.match_regex.trim();
        const curMatchRegex = channel.match_regex ?? '';
        if (nextMatchRegex !== curMatchRegex) {
            // Empty string means "clear" for patch semantics; backend maps it to NULL.
            req.match_regex = nextMatchRegex;
        }

        const originalKeys = channel.keys;
        const originalByID = new Map(originalKeys.map((k) => [k.id, k]));
        const nextKeys = formData.keys ?? [];

        const nextIDs = new Set(nextKeys.filter((k) => typeof k.id === 'number').map((k) => k.id as number));
        const keys_to_delete = originalKeys.filter((k) => !nextIDs.has(k.id)).map((k) => k.id);

        const keys_to_add = nextKeys
            .filter((k) => !k.id && k.channel_key.trim())
            .map((k) => ({
                enabled: k.enabled,
                channel_key: k.channel_key,
                remark: k.remark ?? '',
                cost_type: k.cost_type,
                period_quota: k.period_quota,
                reset_period: k.reset_period,
                period_start: k.period_start,
                max_cost: k.max_cost,
                max_rpm: k.max_rpm,
                max_concurrent: k.max_concurrent,
                priority: k.priority,
                weight: k.weight,
            }));

        const keys_to_update = nextKeys
            .filter((k) => typeof k.id === 'number' && originalByID.has(k.id as number))
            .map((k) => {
                const orig = originalByID.get(k.id as number)!;
                const u: NonNullable<UpdateChannelRequest['keys_to_update']>[number] = { id: k.id as number };
                if (k.enabled !== orig.enabled) u.enabled = k.enabled;
                if (k.channel_key !== orig.channel_key) u.channel_key = k.channel_key;
                if ((k.remark ?? '') !== (orig.remark ?? '')) u.remark = k.remark ?? '';
                if (k.cost_type !== orig.cost_type) u.cost_type = k.cost_type;
                 if (k.period_quota !== orig.period_quota) u.period_quota = k.period_quota;
                 if (k.reset_period !== orig.reset_period) u.reset_period = k.reset_period;
                 if (k.period_start !== orig.period_start) u.period_start = k.period_start;
                 if (k.max_cost !== orig.max_cost) u.max_cost = k.max_cost;
                if (k.max_rpm !== orig.max_rpm) u.max_rpm = k.max_rpm;
                if (k.max_concurrent !== orig.max_concurrent) u.max_concurrent = k.max_concurrent;
                if (k.priority !== orig.priority) u.priority = k.priority;
                if (k.weight !== orig.weight) u.weight = k.weight;
                return Object.keys(u).length > 1 ? u : null;
            })
            .filter((u): u is NonNullable<UpdateChannelRequest['keys_to_update']>[number] => u !== null);

        if (keys_to_add.length > 0) req.keys_to_add = keys_to_add;
        if (keys_to_update.length > 0) req.keys_to_update = keys_to_update;
        if (keys_to_delete.length > 0) req.keys_to_delete = keys_to_delete;

        updateChannel.mutate(req, {
            onSuccess: () => {
                setIsEditing(false);
                setIsOpen(false);
            }
        });
    };

    const handleDeleteClick = () => {
        if (!isConfirmingDelete) {
            setIsConfirmingDelete(true);
            return;
        }

        setIsOpen(false);
        setTimeout(() => {
            deleteChannel.mutate(channel.id);
        }, 300);
    };

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
                            exit: { opacity: 0, scale: 0.8 }
                        }}
                    />
                </header>
            </MorphingDialogTitle>

            <MorphingDialogDescription>
                <Tabs value={currentView}>
                    <TabsContents>
                        <TabsContent value="viewing" >
                            <div className="max-h-[60vh] overflow-y-auto space-y-4 sm:space-y-5">
                                <dl className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                                    <div className="rounded-2xl border bg-linear-to-br from-chart-1/10 to-chart-1/5 p-3 sm:p-4">
                                        <dt className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
                                            <Activity className="size-4 text-chart-1" />
                                            {t('metrics.totalRequests')}
                                        </dt>
                                        <dd className="text-xl sm:text-2xl font-bold text-chart-1">
                                            {stats.request_count.formatted.value}
                                            <span className="text-xs font-normal ml-1 text-muted-foreground">{stats.request_count.formatted.unit}</span>
                                        </dd>
                                    </div>

                                    <div className="rounded-2xl border bg-linear-to-br from-chart-3/10 to-chart-3/5 p-3 sm:p-4">
                                        <dt className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
                                            <FileText className="size-4 text-chart-3" />
                                            {t('metrics.totalToken')}
                                        </dt>
                                        <dd className="text-xl sm:text-2xl font-bold text-chart-3">
                                            {stats.total_token.formatted.value}
                                            <span className="text-xs font-normal ml-1 text-muted-foreground">{stats.total_token.formatted.unit}</span>
                                        </dd>
                                    </div>

                                    <div className="rounded-2xl border bg-linear-to-br from-chart-5/10 to-chart-5/5 p-3 sm:p-4">
                                        <dt className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
                                            <DollarSign className="size-4 text-chart-5" />
                                            {t('metrics.totalCost')}
                                        </dt>
                                        <dd className="text-xl sm:text-2xl font-bold text-chart-5">
                                            {stats.total_cost.formatted.value}
                                            <span className="text-xs font-normal ml-1 text-muted-foreground">{stats.total_cost.formatted.unit}</span>
                                        </dd>
                                    </div>
                                </dl>

                                {/* 请求详情 */}
                                <section className="space-y-3">
                                    <h4 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        <TrendingUp className="size-3.5" />
                                        {t('sections.requests')}
                                    </h4>
                                    <dl className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                        <div className="rounded-2xl border bg-card p-3 sm:p-4 transition-colors hover:bg-accent/5">
                                            <dt className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                                <CheckCircle2 className="size-4 text-accent" />
                                                {t('metrics.successRequests')}
                                            </dt>
                                            <dd className="text-2xl font-bold text-accent">
                                                {stats.request_success.formatted.value}
                                                <span className="text-sm font-normal ml-1 text-muted-foreground">{stats.request_success.formatted.unit}</span>
                                            </dd>
                                        </div>

                                        <div className="rounded-2xl border bg-card p-3 sm:p-4 transition-colors hover:bg-accent/5">
                                            <dt className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                                <XCircle className="size-4 text-destructive" />
                                                {t('metrics.failedRequests')}
                                            </dt>
                                            <dd className="text-2xl font-bold text-destructive">
                                                {stats.request_failed.formatted.value}
                                                <span className="text-sm font-normal ml-1 text-muted-foreground">{stats.request_failed.formatted.unit}</span>
                                            </dd>
                                        </div>
                                    </dl>
                                </section>

                                {/* Token 使用 */}
                                <section className="space-y-3">
                                    <h4 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        <FileText className="size-3.5" />
                                        {t('sections.tokens')}
                                    </h4>
                                    <dl className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                        <div className="rounded-2xl border bg-card p-3 sm:p-4 transition-colors hover:bg-accent/5">
                                            <dt className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                                <div className="size-2 rounded-full bg-chart-1" />
                                                {t('metrics.inputToken')}
                                            </dt>
                                            <dd className="text-2xl font-bold text-card-foreground">
                                                {stats.input_token.formatted.value}
                                                <span className="text-sm font-normal ml-1 text-muted-foreground">{stats.input_token.formatted.unit}</span>
                                            </dd>
                                        </div>

                                        <div className="rounded-2xl border bg-card p-3 sm:p-4 transition-colors hover:bg-accent/5">
                                            <dt className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                                <div className="size-2 rounded-full bg-chart-3" />
                                                {t('metrics.outputToken')}
                                            </dt>
                                            <dd className="text-2xl font-bold text-card-foreground">
                                                {stats.output_token.formatted.value}
                                                <span className="text-sm font-normal ml-1 text-muted-foreground">{stats.output_token.formatted.unit}</span>
                                            </dd>
                                        </div>
                                    </dl>
                                </section>

                                {/* 成本详情 */}
                                <section className="space-y-3">
                                    <h4 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        <DollarSign className="size-3.5" />
                                        {t('sections.costs')}
                                    </h4>
                                    <dl className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                        <div className="rounded-2xl border bg-card p-3 sm:p-4 transition-colors hover:bg-accent/5">
                                            <dt className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                                <div className="size-2 rounded-full bg-chart-2" />
                                                {t('metrics.inputCost')}
                                            </dt>
                                            <dd className="text-2xl font-bold text-card-foreground">
                                                {stats.input_cost.formatted.value}
                                                <span className="text-sm font-normal ml-1 text-muted-foreground">{stats.input_cost.formatted.unit}</span>
                                            </dd>
                                        </div>

                                        <div className="rounded-2xl border bg-card p-3 sm:p-4 transition-colors hover:bg-accent/5">
                                            <dt className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                                <div className="size-2 rounded-full bg-chart-5" />
                                                {t('metrics.outputCost')}
                                            </dt>
                                            <dd className="text-2xl font-bold text-card-foreground">
                                                {stats.output_cost.formatted.value}
                                                <span className="text-sm font-normal ml-1 text-muted-foreground">{stats.output_cost.formatted.unit}</span>
                                            </dd>
                                        </div>
                                    </dl>
                                </section>

                                {/* Base URLs */}
                                <section className="space-y-3">
                                    <h4 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        <Globe className="size-3.5" />
                                        {t('sections.baseUrls')}
                                    </h4>
                                    <div className="rounded-2xl border bg-card overflow-hidden">
                                        {channel.base_urls?.map((url, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 sm:p-4 border-b last:border-0 hover:bg-accent/5 transition-colors">
                                                <div className="flex flex-col gap-1 min-w-0">
                                                    <span className="font-mono text-sm truncate select-all">{url.url}</span>
                                                </div>
                                                <Badge
                                                    variant="secondary"
                                                    className={cn(
                                                        "h-5 px-1.5 text-xs",
                                                        url.delay < 300
                                                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                                            : url.delay < 1000
                                                                ? "bg-orange-500/15 text-orange-700 dark:text-orange-400"
                                                                : "bg-red-500/15 text-red-700 dark:text-red-400"
                                                    )}
                                                >
                                                    {url.delay}ms
                                                </Badge>
                                            </div>
                                        ))}
                                        {(!channel.base_urls || channel.base_urls.length === 0) && (
                                            <div className="p-4 text-sm text-muted-foreground text-center">{t('noBaseUrls')}</div>
                                        )}
                                    </div>
                                </section>

                                {/* Keys */}
                                <section className="space-y-3">
                                    <h4 className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        <span className="flex items-center gap-2">
                                            <Key className="size-3.5" />
                                            {t('sections.keys')}
                                        </span>
                                        <Badge variant="outline" className="normal-case text-[10px]">
                                            {t(`keySelectMode.${channel.key_select_mode}`)}
                                        </Badge>
                                    </h4>
                                    <div className="rounded-2xl border bg-card overflow-hidden">
                                        {channel.keys?.map((key) => (
                                            <div key={key.id} className="flex items-center gap-3 p-3 sm:p-4 border-b last:border-0 hover:bg-accent/5 transition-colors">
                                                <div className={cn("size-2 shrink-0 rounded-full", key.enabled ? "bg-blue-500" : "bg-destructive")} />

                                                <span className="font-mono text-sm truncate min-w-0 flex-1">
                                                    {key.channel_key.length > 10
                                                        ? `${key.channel_key.slice(0, 4)}...${key.channel_key.slice(-4)}`
                                                        : key.channel_key}
                                                </span>

                                                {key.remark && (
                                                    <span className="text-xs text-muted-foreground truncate max-w-24" title={key.remark}>
                                                        {key.remark}
                                                    </span>
                                                )}

                                                 <div className="flex items-center gap-2 shrink-0">
                                                     <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                                         {key.cost_type === KeyCostType.Period
                                                             ? t('period')
                                                             : key.cost_type === KeyCostType.PayAsYouGo
                                                                 ? t('payAsYouGo')
                                                                 : t('unlimited')}
                                                     </Badge>
                                                     {key.max_rpm > 0 && (
                                                         <Badge variant="outline" className="h-5 px-1.5 text-[10px] hidden md:inline-flex">
                                                             {key.max_rpm} {t('rpm')}
                                                         </Badge>
                                                     )}
                                                     {key.max_concurrent > 0 && (
                                                         <Badge variant="outline" className="h-5 px-1.5 text-[10px] hidden md:inline-flex">
                                                             {key.max_concurrent} {t('concurrent')}
                                                         </Badge>
                                                     )}
                                                     {key.last_use_time_stamp > 0 && (
                                                        <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline-block">
                                                            {new Date(key.last_use_time_stamp * 1000).toLocaleString()}
                                                        </span>
                                                    )}

                                                    {key.status_code !== 0 && (
                                                        <Badge
                                                            variant="secondary"
                                                            className={cn(
                                                                "h-5 px-1.5 text-[10px]",
                                                                key.status_code === 200
                                                                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                                                    : key.status_code === 401 ||
                                                                        key.status_code === 403 ||
                                                                        key.status_code === 429 ||
                                                                        key.status_code >= 500
                                                                        ? "bg-red-500/15 text-red-700 dark:text-red-400"
                                                                        : "bg-orange-500/15 text-orange-700 dark:text-orange-400"
                                                            )}
                                                        >
                                                            {key.status_code}
                                                        </Badge>
                                                    )}

                                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                                        {formatMoney(key.used_cost).formatted.value}
                                                        {formatMoney(key.used_cost).formatted.unit}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                        {(!channel.keys || channel.keys.length === 0) && (
                                            <div className="p-4 text-sm text-muted-foreground text-center">{t('noKeys')}</div>
                                        )}
                                    </div>
                                </section>

                                {/* 等待时间 */}
                                <dl className="rounded-2xl border bg-card p-3 sm:p-4 transition-colors hover:bg-accent/5">
                                    <dt className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                        <Clock className="size-4 text-primary" />
                                        {t('metrics.avgWaitTime')}
                                    </dt>
                                    <dd className="text-2xl font-bold text-primary">
                                        {stats.wait_time.formatted.value}
                                        <span className="text-sm font-normal ml-1 text-muted-foreground">{stats.wait_time.formatted.unit}</span>
                                    </dd>
                                </dl>
                            </div>

                            {/* 操作按钮 */}
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
                                    disabled={deleteChannel.isPending}
                                    variant="destructive"
                                    className="w-full rounded-2xl h-12"
                                >
                                    <Trash2 className={`size-4 transition-transform ${isConfirmingDelete ? 'scale-110' : ''}`} />
                                    {deleteChannel.isPending
                                        ? t('actions.deleting')
                                        : isConfirmingDelete
                                            ? t('actions.confirmDelete')
                                            : t('actions.delete')}
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="editing">
                            <ChannelForm
                                formData={formData}
                                onFormDataChange={setFormData}
                                onSubmit={handleUpdate}
                                isPending={updateChannel.isPending}
                                submitText={t('actions.save')}
                                pendingText={t('actions.saving')}
                                onCancel={() => setIsEditing(false)}
                                cancelText={t('actions.cancel')}
                                idPrefix="channel"
                                onResetKeyCost={(keyId) => resetKeyCost.mutate({ channelId: channel.id, keyId })}
                            />
                        </TabsContent>
                    </TabsContents>
                </Tabs>
            </MorphingDialogDescription>
        </>
    );
}
