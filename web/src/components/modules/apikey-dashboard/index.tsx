'use client';

import { useTranslations } from 'next-intl';
import { toast } from '@/components/common/Toast';
import { useAPIKeyDashboardStats, useAPIKeySelfUpdate } from '@/api/endpoints/apikey';
import { useLLMInfoList } from '@/api/endpoints/llminfo';
import { useAuthStore } from '@/api/endpoints/user';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import Logo from '@/components/modules/logo';
import { PageWrapper } from '@/components/common/PageWrapper';
import { CopyIconButton } from '@/components/common/CopyButton';
import { useCopyToClipboard } from '@uidotdev/usehooks';
import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
    ArrowDownToLine,
    ArrowUpFromLine,
    Coins,
    CheckCircle,
    XCircle,
    KeyRound,
    LogOut,
    Calendar,
    Copy,
    BookOpen,
    PenLine,
    Gauge,
    Zap,
    Layers,
    Clock,
    Route,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import dayjs from 'dayjs';
import { NavBar } from '@/components/modules/navbar/navbar';
import { LLMInfo } from '@/components/modules/llminfo';
import { Log } from '@/components/modules/log';
import { LogActions } from '@/components/modules/log/actions';
import { KeySettings } from '@/components/modules/apikey-dashboard/settings';
import { ENTRANCE_VARIANTS } from '@/lib/animations/fluid-transitions';

type KeyNavItem = 'home' | 'llminfo' | 'log' | 'setting';

const KEY_NAV_ITEMS: readonly string[] = ['home', 'llminfo', 'log', 'setting'];
const KEY_NAV_ORDER: KeyNavItem[] = ['home', 'llminfo', 'log', 'setting'];

export function APIKeyDashboard() {
    const tNav = useTranslations('navbar');
    const { logout } = useAuthStore();
    const [activeItem, setActiveItem] = useState<KeyNavItem>('home');
    const [direction, setDirection] = useState(0);

    const handleNavSelect = (id: string) => {
        const next = id as KeyNavItem;
        if (next === activeItem) return;
        setDirection(KEY_NAV_ORDER.indexOf(next) > KEY_NAV_ORDER.indexOf(activeItem) ? 1 : -1);
        setActiveItem(next);
    };

    return (
        <div className="mx-auto flex h-dvh max-w-6xl flex-col overflow-hidden px-3 md:grid md:grid-cols-[auto_1fr] md:gap-6 md:px-6">
            <NavBar
                items={KEY_NAV_ITEMS}
                activeId={activeItem}
                onSelect={handleNavSelect}
            />
            <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
                <header className="my-6 flex flex-none items-center gap-x-2 px-2">
                    <Logo size={48} />
                    <div className="flex-1 overflow-hidden">
                        <AnimatePresence mode="wait" custom={direction}>
                            <motion.div
                                key={activeItem}
                                custom={direction}
                                variants={{
                                    initial: (dir: number) => ({
                                        y: 32 * dir,
                                        opacity: 0
                                    }),
                                    animate: {
                                        y: 0,
                                        opacity: 1
                                    },
                                    exit: (dir: number) => ({
                                        y: -32 * dir,
                                        opacity: 0
                                    })
                                }}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                transition={{ duration: 0.3 }}
                                className="flex items-center"
                            >
                                <span className="text-3xl font-bold mt-1">{tNav(activeItem)}</span>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        {activeItem === 'log' && <LogActions />}
                        <div className="w-px h-6 bg-border mx-1" />
                        <Button variant="ghost" size="icon" onClick={logout} className="rounded-xl hover:bg-destructive/10 hover:text-destructive">
                            <LogOut className="size-4" />
                        </Button>
                    </div>
                </header>
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={activeItem}
                        variants={ENTRANCE_VARIANTS.content}
                        initial="initial"
                        animate="animate"
                        exit={{
                            opacity: 0,
                            scale: 0.98,
                        }}
                        transition={{ duration: 0.25 }}
                        className="h-full min-h-0 flex-1"
                    >
                        {activeItem === 'home' && <DashboardHome />}
                        {activeItem === 'llminfo' && <LLMInfo />}
                        {activeItem === 'log' && <Log />}
                        {activeItem === 'setting' && <KeySettings />}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}

function DashboardHome() {
    const t = useTranslations('apiKeyDashboard');
    const tSetting = useTranslations('setting');
    const { data, error } = useAPIKeyDashboardStats();
    const { logout } = useAuthStore();
    const [, copyToClipboard] = useCopyToClipboard();
    const { data: llmItems } = useLLMInfoList();
    const updateOwn = useAPIKeySelfUpdate();

    const routingOptions = (llmItems ?? []).map((item) => ({
        key: item.group_name,
        label: item.group_name,
        filterText: item.group_name,
    }));

    const copyWithToast = useCallback(
        async (text: string, label: string) => {
            try {
                await copyToClipboard(text);
                toast.success(`${label} copied`);
                return true;
            } catch {
                toast.error(t('error'));
                return false;
            }
        },
        [copyToClipboard, t]
    );

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <p className="text-destructive font-medium">{t('error')}</p>
                    <Button onClick={logout} variant="outline" className="rounded-xl">
                        {t('logout')}
                    </Button>
                </div>
            </div>
        );
    }

    if (!data) {
        return null;
    }

    const { stats, info } = data;

    // Quota calculations
    const usedCost = stats.total_cost.raw;
    const maxCost = info.max_cost || 0;

    const requestSuccessRaw = stats.request_success.raw;
    const requestCountRaw = stats.request_count.raw;
    const successRateRaw = requestCountRaw > 0 ? (requestSuccessRaw / requestCountRaw) * 100 : 0;

    // Expiry calculations
    const expireAt = info.expire_at ? dayjs.unix(info.expire_at) : null;
    const isExpired = expireAt ? expireAt.isBefore(dayjs()) : false;
    const daysUntilExpire = expireAt ? expireAt.diff(dayjs(), 'day') : null;

    const supportedModels = info.supported_models
        ? info.supported_models
            .split(',')
            .map((m) => m.trim())
            .filter(Boolean)
        : [];

    const supportedModelButtons: JSX.Element[] = supportedModels.map((model) => (
        <Button
            key={model}
            variant="secondary"
            size="sm"
            className="h-8 rounded-lg px-3 text-sm transition-colors hover:bg-primary hover:text-primary-foreground"
            onClick={() => void copyWithToast(model, model)}
        >
            {model}
        </Button>
    ));

    return (
        <PageWrapper className="h-full min-h-0 overflow-y-auto overscroll-contain space-y-6 pb-24 md:pb-4">
            {/* Hero: Identity + Limits */}
            <div className="overflow-hidden rounded-3xl border bg-card">
                <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Left: Key Info */}
                    <div className="p-6 md:p-8 flex flex-col relative">
                        <KeyRound aria-hidden="true" className="pointer-events-none absolute top-6 right-6 h-27 w-27 text-muted-foreground/10" />
                        <h2 className="text-2xl font-bold truncate pr-16">{info.name}</h2>
                        <div className="mt-4 flex items-center gap-2 rounded-xl border border-border/50 bg-muted/50 p-3">
                            <code className="flex-1 font-mono text-sm truncate">
                                {info.api_key.slice(0, 11)}********{info.api_key.slice(-4)}
                            </code>
                            <CopyIconButton
                                text={info.api_key}
                                className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all hover:bg-primary hover:text-primary-foreground active:scale-95"
                                copyIconClassName="size-4"
                                checkIconClassName="size-4"
                            />
                        </div>
                        {/* Expiry & Quota inline */}
                        <div className="mt-auto pt-6 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4" />{t('expireAt')}</span>
                                {expireAt ? (
                                    <span className={`font-medium ${isExpired ? 'text-destructive' : ''}`}>
                                        {expireAt.format('YYYY-MM-DD')}
                                        {!isExpired && daysUntilExpire !== null && <span className="ml-2 text-xs bg-secondary px-2 py-0.5 rounded-full">{daysUntilExpire} {t('daysLeft')}</span>}
                                        {isExpired && <span className="ml-2 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">{t('expired')}</span>}
                                    </span>
                                ) : (
                                    <span className="font-medium">{t('neverExpire')}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Right: Quota visual */}
                    <div className="relative flex flex-col justify-center border-t bg-muted/30 p-6 md:border-l md:border-t-0 md:p-8">
                        <Coins aria-hidden="true" className="pointer-events-none absolute top-6 right-6 h-27 w-27 text-muted-foreground/10" />
                        <div className="text-lg text-muted-foreground uppercase tracking-wider mb-2">{t('creditsBalance')}</div>
                        <div className="text-6xl font-bold text-chart-1">
                            {maxCost > 0 ? (
                                <>
                                    <AnimatedNumber value={stats.total_cost.formatted.value} />
                                    <span className="text-lg font-normal text-muted-foreground ml-1">{stats.total_cost.formatted.unit}</span>
                                </>
                            ) : (
                                <span>{t('unlimited')}</span>
                            )}
                        </div>
                        {maxCost > 0 && (
                            <div className="mt-4">
                                <Progress value={Math.min(100, (usedCost / maxCost) * 100)} className="h-4 *:data-[slot=progress-indicator]:bg-chart-1" />
                                <div className="flex justify-between text-sm text-muted-foreground mt-1">
                                    <span>0</span>
                                    <span className="flex items-center gap-1"><Coins className="size-3.5" />{maxCost.toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Row 2: Request Health */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-2xl border bg-card p-5">
                    <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <Zap className="size-4 text-chart-4" />
                        {t('requestCount')}
                    </div>
                    <div className="text-2xl font-bold">
                        <AnimatedNumber value={stats.request_count.formatted.value} />
                        <span className="ml-1 text-sm font-normal text-muted-foreground">{stats.request_count.formatted.unit}</span>
                    </div>
                </div>

                <div className="rounded-2xl border bg-card p-5">
                    <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <Gauge className="size-4 text-primary" />
                        {t('successRate')}
                    </div>
                    <div className="text-2xl font-bold">
                        <AnimatedNumber value={successRateRaw.toFixed(1)} />
                        <span className="ml-1 text-sm font-normal text-muted-foreground">%</span>
                    </div>
                </div>

                <div className="rounded-2xl border bg-card p-5">
                    <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle className="size-4 text-chart-2" />
                        {t('successRequests')}
                    </div>
                    <div className="text-2xl font-bold">
                        <AnimatedNumber value={stats.request_success.formatted.value} />
                        <span className="ml-1 text-sm font-normal text-muted-foreground">{stats.request_success.formatted.unit}</span>
                    </div>
                </div>

                <div className="rounded-2xl border bg-card p-5">
                    <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <XCircle className="size-4 text-destructive" />
                        {t('failedRequests')}
                    </div>
                    <div className="text-2xl font-bold">
                        <AnimatedNumber value={stats.request_failed.formatted.value} />
                        <span className="ml-1 text-sm font-normal text-muted-foreground">{stats.request_failed.formatted.unit}</span>
                    </div>
                </div>
            </div>

            {/* Row 3: Token & Credits breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Token breakdown */}
                <div className="rounded-2xl border bg-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Zap className="w-5 h-5 text-chart-4" />
                        <span className="font-semibold">{t('totalToken')}</span>
                        <span className="ml-auto text-2xl font-bold"><AnimatedNumber value={stats.total_token.formatted.value} /><span className="text-sm font-normal text-muted-foreground ml-1">{stats.total_token.formatted.unit}</span></span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                        <div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><ArrowDownToLine className="w-3.5 h-3.5" />{t('inputTokens')}</div>
                            <div className="text-lg font-semibold"><AnimatedNumber value={stats.input_token.formatted.value} /><span className="text-xs font-normal text-muted-foreground ml-1">{stats.input_token.formatted.unit}</span></div>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><ArrowUpFromLine className="w-3.5 h-3.5" />{t('outputTokens')}</div>
                            <div className="text-lg font-semibold"><AnimatedNumber value={stats.output_token.formatted.value} /><span className="text-xs font-normal text-muted-foreground ml-1">{stats.output_token.formatted.unit}</span></div>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><PenLine className="w-3.5 h-3.5" />{t('cacheWriteTokens')}</div>
                            <div className="text-lg font-semibold"><AnimatedNumber value={stats.cache_write_token.formatted.value} /><span className="text-xs font-normal text-muted-foreground ml-1">{stats.cache_write_token.formatted.unit}</span></div>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><BookOpen className="w-3.5 h-3.5" />{t('cacheReadTokens')}</div>
                            <div className="text-lg font-semibold"><AnimatedNumber value={stats.cache_read_token.formatted.value} /><span className="text-xs font-normal text-muted-foreground ml-1">{stats.cache_read_token.formatted.unit}</span></div>
                        </div>
                    </div>
                </div>
                {/* Credits breakdown */}
                <div className="rounded-2xl border bg-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Coins className="w-5 h-5 text-chart-1" />
                        <span className="font-semibold">{t('totalCost')}</span>
                        <span className="ml-auto text-2xl font-bold"><AnimatedNumber value={stats.total_cost.formatted.value} /><span className="text-sm font-normal text-muted-foreground ml-1">{stats.total_cost.formatted.unit}</span></span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                        <div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><ArrowDownToLine className="w-3.5 h-3.5" />{t('inputCost')}</div>
                            <div className="text-lg font-semibold"><AnimatedNumber value={stats.input_cost.formatted.value} /><span className="text-xs font-normal text-muted-foreground ml-1">{stats.input_cost.formatted.unit}</span></div>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><ArrowUpFromLine className="w-3.5 h-3.5" />{t('outputCost')}</div>
                            <div className="text-lg font-semibold"><AnimatedNumber value={stats.output_cost.formatted.value} /><span className="text-xs font-normal text-muted-foreground ml-1">{stats.output_cost.formatted.unit}</span></div>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><PenLine className="w-3.5 h-3.5" />{t('cacheWriteCredits')}</div>
                            <div className="text-lg font-semibold"><AnimatedNumber value={stats.cache_write_cost.formatted.value} /><span className="text-xs font-normal text-muted-foreground ml-1">{stats.cache_write_cost.formatted.unit}</span></div>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><BookOpen className="w-3.5 h-3.5" />{t('cacheReadCredits')}</div>
                            <div className="text-lg font-semibold"><AnimatedNumber value={stats.cache_read_cost.formatted.value} /><span className="text-xs font-normal text-muted-foreground ml-1">{stats.cache_read_cost.formatted.unit}</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Routing models */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {([
                    { key: 'model_pro', alias: 'deeprelay-pro', group: info.model_pro },
                    { key: 'model_flash', alias: 'deeprelay-flash', group: info.model_flash },
                    { key: 'model_vision', alias: 'deeprelay-vision', group: info.model_vision },
                ] as const).map(({ key, alias, group }) => (
                    <div key={key} className="rounded-2xl border bg-card p-5 flex flex-col gap-3 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <Route className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{alias}</span>
                        </div>
                        <Combobox
                            options={routingOptions}
                            value={group || undefined}
                            disabledLabel={tSetting('apiKey.form.disabled')}
                            onSelect={(v) => updateOwn.mutate({ [key]: v }, {
                                onSuccess: () => toast.success(t('routingUpdateSuccess')),
                            })}
                            className="w-full rounded-xl border border-border text-sm"
                        />
                    </div>
                ))}
            </div>

            {/* Supported Models */}
            {info.unlimited_models ? (
                <div className="rounded-2xl border bg-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Layers className="w-5 h-5 text-chart-3" />
                        <span className="font-semibold">{t('supportedModels')}</span>
                        <Badge variant="secondary" className="ml-auto rounded-lg px-2 py-0 text-xs">{t('allModels')}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {supportedModelButtons}
                    </div>
                </div>
            ) : supportedModels.length > 0 ? (
                <div className="rounded-2xl border bg-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Layers className="w-5 h-5 text-chart-3" />
                        <span className="font-semibold">{t('supportedModels')}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {supportedModelButtons}
                    </div>
                </div>
            ) : null}
        </PageWrapper>
    );
}
