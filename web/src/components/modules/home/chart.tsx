'use client';

import { useStatsDaily, useStatsHourly } from '@/api/endpoints/stats';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { useMemo, useState, Fragment } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { useTranslations } from 'next-intl';
import { formatCount, formatCountInt, formatMoney } from '@/lib/utils';
import dayjs from 'dayjs';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import { Tabs, TabsList, TabsTrigger } from '@/components/animate-ui/components/animate/tabs';
import { useHomeViewStore, type ChartMetricType, type ChartPeriod } from '@/components/modules/home/store';

const SUCCESS_COLOR = '#10b981';
const SERIES_COLORS = {
    input: 'var(--chart-3)',
    output: 'var(--chart-4)',
    cacheWrite: 'var(--chart-5)',
    cacheRead: 'var(--chart-2)',
} as const;

type Breakdown = { total: number; input: number; output: number; cacheWrite: number; cacheRead: number };
type CountBreakdown = { total: number; success: number; failed: number };

type TrendPoint = { date: string; total: number } & Partial<Record<'success' | 'failed' | 'input' | 'output' | 'cacheWrite' | 'cacheRead', number>>;

const formatMetricValue = (metricType: ChartMetricType, value: number) => {
    if (metricType === 'cost') {
        const formatted = formatMoney(value);
        return `${formatted.formatted.value}${formatted.formatted.unit}`;
    }
    if (metricType === 'count') {
        const formatted = formatCountInt(value);
        return `${formatted.formatted.value}${formatted.formatted.unit}`;
    }
    const formatted = formatCount(value);
    return `${formatted.formatted.value}${formatted.formatted.unit}`;
};

function TrendTooltip({ active, payload, metricType, series }: {
    active?: boolean;
    payload?: Array<{ payload?: TrendPoint }>;
    metricType: ChartMetricType;
    series: Array<{ key: string; label: string; color: string }>;
}) {
    if (!active || !payload?.length || !payload[0]?.payload) return null;
    const point = payload[0].payload;
    return (
        <div className="border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
            <div className="font-medium">{point.date}</div>
            <div className="grid gap-1.5">
                {series.map((s) => {
                    const value = point[s.key as keyof TrendPoint];
                    if (typeof value !== 'number') return null;
                    return (
                        <div key={s.key} className="flex w-full items-center justify-between gap-2 leading-none">
                            <div className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: s.color }} />
                                <span className="text-muted-foreground">{s.label}</span>
                            </div>
                            <span className="font-mono font-medium tabular-nums text-foreground">{formatMetricValue(metricType, value)}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function StatsChart() {
    const PERIODS: readonly ChartPeriod[] = ['1', '7', '30'];
    const { data: statsDaily } = useStatsDaily();
    const { data: statsHourly } = useStatsHourly();
    const t = useTranslations('home.chart');

    const chartMetricType = useHomeViewStore((state) => state.chartMetricType);
    const setChartMetricType = useHomeViewStore((state) => state.setChartMetricType);
    const period = useHomeViewStore((state) => state.chartPeriod);
    const setChartPeriod = useHomeViewStore((state) => state.setChartPeriod);
    const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);

    const toggleSeries = (key: string) => {
        setHiddenSeries((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    };

    const handleMetricChange = (value: string) => {
        setChartMetricType(value as ChartMetricType);
        setHiddenSeries([]);
    };

    const sortedDaily = useMemo(() => {
        if (!statsDaily) return [];
        return [...statsDaily].sort((a, b) => a.date.localeCompare(b.date));
    }, [statsDaily]);

    const extract = (stat: { request_success: { raw: number }; request_failed: { raw: number }; input_token: { raw: number }; output_token: { raw: number }; cache_write_token: { raw: number }; cache_read_token: { raw: number }; input_cost: { raw: number }; output_cost: { raw: number }; cache_write_cost: { raw: number }; cache_read_cost: { raw: number } }) => ({
        success: stat.request_success.raw,
        failed: stat.request_failed.raw,
        inputToken: stat.input_token.raw,
        outputToken: stat.output_token.raw,
        cacheWriteToken: stat.cache_write_token.raw,
        cacheReadToken: stat.cache_read_token.raw,
        inputCost: stat.input_cost.raw,
        outputCost: stat.output_cost.raw,
        cacheWriteCost: stat.cache_write_cost.raw,
        cacheReadCost: stat.cache_read_cost.raw,
    });

    const chartData = useMemo<TrendPoint[]>(() => {
        const toPoint = (date: string, s: ReturnType<typeof extract>): TrendPoint => {
            if (chartMetricType === 'count') {
                return { date, total: s.success + s.failed, success: s.success, failed: s.failed };
            }
            if (chartMetricType === 'tokens') {
                return {
                    date,
                    total: s.inputToken + s.outputToken + s.cacheWriteToken + s.cacheReadToken,
                    input: s.inputToken,
                    output: s.outputToken,
                    cacheWrite: s.cacheWriteToken,
                    cacheRead: s.cacheReadToken,
                };
            }
            return {
                date,
                total: s.inputCost + s.outputCost + s.cacheWriteCost + s.cacheReadCost,
                input: s.inputCost,
                output: s.outputCost,
                cacheWrite: s.cacheWriteCost,
                cacheRead: s.cacheReadCost,
            };
        };
        if (period === '1') {
            return (statsHourly ?? []).map((stat) => toPoint(`${stat.hour}:00`, extract(stat)));
        }
        return sortedDaily.slice(-Number(period)).map((stat) => toPoint(dayjs(stat.date).format('MM/DD'), extract(stat)));
    }, [sortedDaily, statsHourly, period, chartMetricType]);

    const totals = useMemo(() => {
        const src = period === '1'
            ? (statsHourly ?? []).map(extract)
            : sortedDaily.slice(-Number(period)).map(extract);
        const acc = src.reduce((a, s) => ({
            success: a.success + s.success,
            failed: a.failed + s.failed,
            inputToken: a.inputToken + s.inputToken,
            outputToken: a.outputToken + s.outputToken,
            cacheWriteToken: a.cacheWriteToken + s.cacheWriteToken,
            cacheReadToken: a.cacheReadToken + s.cacheReadToken,
            inputCost: a.inputCost + s.inputCost,
            outputCost: a.outputCost + s.outputCost,
            cacheWriteCost: a.cacheWriteCost + s.cacheWriteCost,
            cacheReadCost: a.cacheReadCost + s.cacheReadCost,
        }), {
            success: 0, failed: 0,
            inputToken: 0, outputToken: 0, cacheWriteToken: 0, cacheReadToken: 0,
            inputCost: 0, outputCost: 0, cacheWriteCost: 0, cacheReadCost: 0,
        });
        const count: CountBreakdown = { total: acc.success + acc.failed, success: acc.success, failed: acc.failed };
        const tokens: Breakdown = {
            total: acc.inputToken + acc.outputToken + acc.cacheWriteToken + acc.cacheReadToken,
            input: acc.inputToken,
            output: acc.outputToken,
            cacheWrite: acc.cacheWriteToken,
            cacheRead: acc.cacheReadToken,
        };
        const cost: Breakdown = {
            total: acc.inputCost + acc.outputCost + acc.cacheWriteCost + acc.cacheReadCost,
            input: acc.inputCost,
            output: acc.outputCost,
            cacheWrite: acc.cacheWriteCost,
            cacheRead: acc.cacheReadCost,
        };
        return { count, tokens, cost };
    }, [sortedDaily, statsHourly, period]);

    const totalLabel = chartMetricType === 'count' ? t('totalRequests') : chartMetricType === 'tokens' ? t('totalTokens') : t('totalCost');

    const chartConfig = useMemo(() => {
        const config: Record<string, { label: string; color?: string }> = {
            total: { label: totalLabel, color: 'var(--chart-1)' },
        };
        if (chartMetricType === 'count') {
            config.success = { label: t('success'), color: SUCCESS_COLOR };
            config.failed = { label: t('failed'), color: 'var(--destructive)' };
        } else {
            config.input = { label: t('input'), color: SERIES_COLORS.input };
            config.output = { label: t('output'), color: SERIES_COLORS.output };
            config.cacheWrite = { label: t('cacheWrite'), color: SERIES_COLORS.cacheWrite };
            config.cacheRead = { label: t('cacheRead'), color: SERIES_COLORS.cacheRead };
        }
        return config;
    }, [chartMetricType, totalLabel, t]);

    const tooltipSeries = useMemo(() => {
        const base = [{ key: 'total', label: totalLabel, color: 'var(--chart-1)' }];
        if (chartMetricType === 'count') {
            return [
                ...base,
                { key: 'success', label: t('success'), color: SUCCESS_COLOR },
                { key: 'failed', label: t('failed'), color: 'var(--destructive)' },
            ];
        }
        return [
            ...base,
            { key: 'input', label: t('input'), color: SERIES_COLORS.input },
            { key: 'output', label: t('output'), color: SERIES_COLORS.output },
            { key: 'cacheWrite', label: t('cacheWrite'), color: SERIES_COLORS.cacheWrite },
            { key: 'cacheRead', label: t('cacheRead'), color: SERIES_COLORS.cacheRead },
        ];
    }, [chartMetricType, totalLabel, t]);

    const getPeriodLabel = (p: ChartPeriod) => {
        const labels = {
            '1': t('period.today'),
            '7': t('period.last7Days'),
            '30': t('period.last30Days'),
        };
        return labels[p];
    };

    const handlePeriodClick = () => {
        const currentIndex = PERIODS.indexOf(period);
        const nextIndex = (currentIndex + 1) % PERIODS.length;
        setChartPeriod(PERIODS[nextIndex]);
    };

    const formatSeriesValue = (value: number) => {
        if (chartMetricType === 'cost') {
            const formatted = formatMoney(value);
            return `${formatted.formatted.value}${formatted.formatted.unit}`;
        }
        if (chartMetricType === 'count') {
            const formatted = formatCountInt(value);
            return `${formatted.formatted.value}${formatted.formatted.unit}`;
        }
        const formatted = formatCount(value);
        return `${formatted.formatted.value}${formatted.formatted.unit}`;
    };

    const totalValue = chartMetricType === 'count'
        ? formatCountInt(totals.count.total)
        : chartMetricType === 'tokens'
            ? formatCount(totals.tokens.total)
            : formatMoney(totals.cost.total);

    const detailItems = chartMetricType === 'count'
        ? [
            { key: 'success', label: t('success'), color: SUCCESS_COLOR, value: formatCountInt(totals.count.success) },
            { key: 'failed', label: t('failed'), color: 'var(--destructive)', value: formatCountInt(totals.count.failed) },
        ]
        : chartMetricType === 'tokens'
            ? (['input', 'output', 'cacheWrite', 'cacheRead'] as const).map((key) => ({
                key,
                label: t(key),
                color: SERIES_COLORS[key],
                value: formatCount(totals.tokens[key]),
            }))
            : (['input', 'output', 'cacheWrite', 'cacheRead'] as const).map((key) => ({
                key,
                label: t(key),
                color: SERIES_COLORS[key],
                value: formatMoney(totals.cost[key]),
            }));

    return (
        <div className="rounded-3xl bg-card border-card-border border pt-4 pb-0 text-card-foreground custom-shadow">
            <div className="px-4 pb-2 space-y-2">
                <div className="flex justify-between items-center">
                    <div
                        className="flex gap-2 text-sm cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={handlePeriodClick}
                    >
                        <div>
                            <div className="text-xs text-muted-foreground">{t('timePeriod')}</div>
                            <div className="text-base font-semibold">{getPeriodLabel(period)}</div>
                        </div>
                    </div>
                    <Tabs value={chartMetricType} onValueChange={handleMetricChange}>
                        <TabsList>
                            <TabsTrigger value="count">{t('metricType.count')}</TabsTrigger>
                            <TabsTrigger value="tokens">{t('metricType.tokens')}</TabsTrigger>
                            <TabsTrigger value="cost">{t('metricType.cost')}</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="flex justify-between items-start gap-3">
                    <div
                        className={`shrink-0 cursor-pointer transition-opacity ${hiddenSeries.includes('total') ? 'opacity-40' : 'hover:opacity-80'}`}
                        onClick={() => toggleSeries('total')}
                    >
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="size-2 rounded-[2px]" style={{ backgroundColor: 'var(--chart-1)' }} />
                            {totalLabel}
                        </div>
                        <div className="text-xl font-semibold">
                            <AnimatedNumber value={totalValue.formatted.value} />
                            <span className="ml-0.5 text-sm text-muted-foreground">{totalValue.formatted.unit}</span>
                        </div>
                    </div>
                    <div className="flex items-stretch gap-3 flex-wrap justify-end">
                        {detailItems.map(({ key, label, color, value }, index) => (
                            <Fragment key={key}>
                                {index > 0 && <div className="w-px bg-border self-stretch" />}
                                <div
                                    className={`cursor-pointer transition-opacity ${hiddenSeries.includes(key) ? 'opacity-40' : 'hover:opacity-80'}`}
                                    onClick={() => toggleSeries(key)}
                                >
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <span className="size-2 rounded-[2px] shrink-0" style={{ backgroundColor: color }} />
                                        {label}
                                    </div>
                                    <div className="text-xl font-semibold">
                                        <AnimatedNumber value={value.formatted.value} />
                                        <span className="ml-0.5 text-sm text-muted-foreground">{value.formatted.unit}</span>
                                    </div>
                                </div>
                            </Fragment>
                        ))}
                    </div>
                </div>
            </div>
            <ChartContainer config={chartConfig} className="h-40 w-full" >
                <ComposedChart accessibilityLayer data={chartData}>
                    <defs>
                        <linearGradient id="fillMetric1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={1.0} />
                            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.1} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatSeriesValue}
                    />
                    <ChartTooltip cursor={false} content={<TrendTooltip metricType={chartMetricType} series={tooltipSeries} />} />
                    <Area
                        type="monotone"
                        dataKey="total"
                        stroke="var(--chart-1)"
                        fill="url(#fillMetric1)"
                        strokeWidth={2}
                        hide={hiddenSeries.includes('total')}
                    />
                    {chartMetricType === 'count' ? (
                        <>
                            <Line type="monotone" dataKey="success" stroke={SUCCESS_COLOR} strokeWidth={1.5} dot={false} hide={hiddenSeries.includes('success')} />
                            <Line type="monotone" dataKey="failed" stroke="var(--destructive)" strokeWidth={1.5} dot={false} hide={hiddenSeries.includes('failed')} />
                        </>
                    ) : (
                        <>
                            <Line type="monotone" dataKey="input" stroke={SERIES_COLORS.input} strokeWidth={1.5} dot={false} hide={hiddenSeries.includes('input')} />
                            <Line type="monotone" dataKey="output" stroke={SERIES_COLORS.output} strokeWidth={1.5} dot={false} hide={hiddenSeries.includes('output')} />
                            <Line type="monotone" dataKey="cacheWrite" stroke={SERIES_COLORS.cacheWrite} strokeWidth={1.5} dot={false} hide={hiddenSeries.includes('cacheWrite')} />
                            <Line type="monotone" dataKey="cacheRead" stroke={SERIES_COLORS.cacheRead} strokeWidth={1.5} dot={false} hide={hiddenSeries.includes('cacheRead')} />
                        </>
                    )}
                </ComposedChart>
            </ChartContainer>
        </div>
    );
}
