'use client';

import { motion } from 'motion/react';
import {
    Activity,
    Zap,
    MessageSquare,
    CheckCircle2,
    XCircle,
    ArrowDownToLine,
    ArrowUpFromLine,
    BookOpen,
    PenLine,
    DollarSign,
    Hash,
    ShieldCheck,
    Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useStatsRealtime, useStatsToday } from '@/api/endpoints/stats';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import { formatCount, formatCountInt, formatMoney } from '@/lib/utils';
import { EASING } from '@/lib/animations/fluid-transitions';

type IconType = typeof Activity;

type StatItem = {
    key: string;
    label: string;
    icon: IconType;
    color: string;
    bgColor: string;
    value: string | number | undefined;
    unit?: string;
};

type Section = {
    key: string;
    title: string;
    icon: IconType;
    items: StatItem[];
};

export function Total() {
    const { data: statsToday } = useStatsToday();
    const { data: realtime } = useStatsRealtime();
    const t = useTranslations('home.total');

    const total = statsToday;

    // 实时数据：RPM = 近 60s 请求数；TPM = 近 60s tokens 数
    const rpm = realtime?.request_count ?? 0;
    const tpm = realtime?.total_tokens ?? 0;

    const inputTokens = total?.input_token ?? 0;
    const outputTokens = total?.output_token ?? 0;
    const cacheReadTokens = total?.cache_read_token ?? 0;
    const cacheWriteTokens = total?.cache_write_token ?? 0;
    const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
    const totalCost = (total?.input_cost ?? 0) + (total?.output_cost ?? 0) + (total?.cache_read_cost ?? 0) + (total?.cache_write_cost ?? 0);

    // 今日请求数据：请求次数 = 成功 + 失败
    const requestSuccess = total?.request_success ?? 0;
    const requestFailed = total?.request_failed ?? 0;
    const requestCount = requestSuccess + requestFailed;

    // 今日状态：成功率；缓存命中率 = cache_read / (input + cache_read)
    const successRateRaw = requestCount > 0 ? requestSuccess / requestCount * 100 : 0;
    const cacheHitRateRaw = inputTokens + cacheReadTokens > 0 ? (cacheReadTokens / (inputTokens + cacheReadTokens)) * 100 : 0;

    const totalTokensFmt = formatCount(totalTokens);
    const totalCostFmt = formatMoney(totalCost);
    const successFmt = formatCountInt(requestSuccess);
    const failedFmt = formatCountInt(requestFailed);
    const inputTokensFmt = formatCount(inputTokens);
    const inputCostFmt = formatMoney(total?.input_cost ?? 0);
    const outputTokensFmt = formatCount(outputTokens);
    const outputCostFmt = formatMoney(total?.output_cost ?? 0);
    const cacheReadTokensFmt = formatCount(cacheReadTokens);
    const cacheReadCostFmt = formatMoney(total?.cache_read_cost ?? 0);
    const cacheWriteTokensFmt = formatCount(cacheWriteTokens);
    const cacheWriteCostFmt = formatMoney(total?.cache_write_cost ?? 0);

    const sections: Section[] = useMemo(() => [
        {
            key: 'realtime',
            title: t('section_realtime'),
            icon: Zap,
            items: [
                { key: 'rpm', label: t('realtime_rpm'), icon: Activity, color: 'text-primary', bgColor: 'bg-primary/10', value: rpm, unit: '/min' },
                { key: 'tpm', label: t('realtime_tpm'), icon: Hash, color: 'text-chart-2', bgColor: 'bg-chart-2/10', value: tpm, unit: '/min' },
            ],
        },
        {
            key: 'consumption',
            title: t('section_consumption'),
            icon: Wallet,
            items: [
                { key: 'token', label: t('consumption_token'), icon: Hash, color: 'text-chart-1', bgColor: 'bg-chart-1/10', value: totalTokensFmt.formatted.value, unit: totalTokensFmt.formatted.unit },
                { key: 'cost', label: t('consumption_cost'), icon: DollarSign, color: 'text-chart-2', bgColor: 'bg-chart-2/10', value: totalCostFmt.formatted.value, unit: totalCostFmt.formatted.unit },
            ],
        },
        {
            key: 'stability',
            title: t('section_stability'),
            icon: ShieldCheck,
            items: [
                { key: 'successRate', label: t('stability_successRate'), icon: CheckCircle2, color: 'text-accent', bgColor: 'bg-accent/10', value: successRateRaw.toFixed(1), unit: '%' },
                { key: 'cacheHitRate', label: t('stability_cacheHitRate'), icon: BookOpen, color: 'text-chart-4', bgColor: 'bg-chart-4/10', value: cacheHitRateRaw.toFixed(1), unit: '%' },
            ],
        },
        {
            key: 'requests',
            title: t('section_requests'),
            icon: MessageSquare,
            items: [
                { key: 'success', label: t('requests_success'), icon: CheckCircle2, color: 'text-accent', bgColor: 'bg-accent/10', value: successFmt.formatted.value, unit: successFmt.formatted.unit },
                { key: 'failed', label: t('requests_failed'), icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10', value: failedFmt.formatted.value, unit: failedFmt.formatted.unit },
            ],
        },
        {
            key: 'input',
            title: t('section_input'),
            icon: ArrowDownToLine,
            items: [
                { key: 'token', label: t('input_token'), icon: Hash, color: 'text-chart-3', bgColor: 'bg-chart-3/10', value: inputTokensFmt.formatted.value, unit: inputTokensFmt.formatted.unit },
                { key: 'cost', label: t('input_cost'), icon: DollarSign, color: 'text-chart-3', bgColor: 'bg-chart-3/10', value: inputCostFmt.formatted.value, unit: inputCostFmt.formatted.unit },
            ],
        },
        {
            key: 'output',
            title: t('section_output'),
            icon: ArrowUpFromLine,
            items: [
                { key: 'token', label: t('output_token'), icon: Hash, color: 'text-chart-4', bgColor: 'bg-chart-4/10', value: outputTokensFmt.formatted.value, unit: outputTokensFmt.formatted.unit },
                { key: 'cost', label: t('output_cost'), icon: DollarSign, color: 'text-chart-4', bgColor: 'bg-chart-4/10', value: outputCostFmt.formatted.value, unit: outputCostFmt.formatted.unit },
            ],
        },
        {
            key: 'cacheRead',
            title: t('section_cacheRead'),
            icon: BookOpen,
            items: [
                { key: 'token', label: t('cacheRead_token'), icon: Hash, color: 'text-chart-4', bgColor: 'bg-chart-4/10', value: cacheReadTokensFmt.formatted.value, unit: cacheReadTokensFmt.formatted.unit },
                { key: 'cost', label: t('cacheRead_cost'), icon: DollarSign, color: 'text-chart-4', bgColor: 'bg-chart-4/10', value: cacheReadCostFmt.formatted.value, unit: cacheReadCostFmt.formatted.unit },
            ],
        },
        {
            key: 'cacheWrite',
            title: t('section_cacheWrite'),
            icon: PenLine,
            items: [
                { key: 'token', label: t('cacheWrite_token'), icon: Hash, color: 'text-chart-2', bgColor: 'bg-chart-2/10', value: cacheWriteTokensFmt.formatted.value, unit: cacheWriteTokensFmt.formatted.unit },
                { key: 'cost', label: t('cacheWrite_cost'), icon: DollarSign, color: 'text-chart-2', bgColor: 'bg-chart-2/10', value: cacheWriteCostFmt.formatted.value, unit: cacheWriteCostFmt.formatted.unit },
            ],
        },
    ], [t, rpm, tpm, successRateRaw, cacheHitRateRaw, totalTokensFmt, totalCostFmt, successFmt, failedFmt, inputTokensFmt, inputCostFmt, outputTokensFmt, outputCostFmt, cacheReadTokensFmt, cacheReadCostFmt, cacheWriteTokensFmt, cacheWriteCostFmt]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {sections.map((card, index) => (
                <motion.section
                    key={card.key}
                    className="rounded-3xl bg-card border-card-border border p-5 text-card-foreground flex flex-row items-center gap-4"
                    initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{
                        duration: 0.5,
                        ease: EASING.easeOutExpo,
                        delay: index * 0.05,
                    }}
                >
                    <div className="flex flex-col items-center justify-center gap-3 border-r border-border/50 pr-4 py-1 self-stretch">
                        <card.icon className="w-4 h-4" />
                        <h3 className="font-medium text-sm [writing-mode:vertical-lr]">{card.title}</h3>
                    </div>

                    <div className="flex flex-col gap-4 flex-1 min-w-0">
                        {card.items.map((item) => (
                            <div key={item.key} className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.bgColor} ${item.color}`}>
                                    <item.icon className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs text-muted-foreground">{item.label}</span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-xl">
                                            <AnimatedNumber value={typeof item.value === 'number' ? item.value.toString() : item.value} />
                                        </span>
                                        {item.unit && (
                                            <span className="text-sm text-muted-foreground">{item.unit}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.section>
            ))}
        </div>
    );
}
