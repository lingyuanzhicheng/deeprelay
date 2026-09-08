'use client';

import { motion } from 'motion/react';
import {
    ArrowDownToLine,
    ArrowUpFromLine,
    BookOpen,
    CheckCircle2,
    XCircle,
    PenLine,
    DollarSign,
    Hash,
    Layers,
    MessageSquare,
    ShieldCheck,
    ZapOff,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useStatsBreaker, useStatsTotal } from '@/api/endpoints/stats';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import { EASING } from '@/lib/animations/fluid-transitions';

type IconType = typeof ArrowDownToLine;

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

export function Summary() {
    const { data: statsTotalFormatted } = useStatsTotal();
    const { data: breaker } = useStatsBreaker();
    const tSummary = useTranslations('home.summary');
    const tItem = useTranslations('home.total');

    const total = statsTotalFormatted;

    const requestSuccess = total?.request_success.raw ?? 0;
    const requestFailed = total?.request_failed.raw ?? 0;
    const requestCount = requestSuccess + requestFailed;
    const successRateRaw = requestCount > 0 ? (requestSuccess / requestCount) * 100 : 0;
    const inputTokens = total?.input_token.raw ?? 0;
    const cacheReadTokens = total?.cache_read_token.raw ?? 0;
    const cacheHitRateRaw = inputTokens + cacheReadTokens > 0 ? (cacheReadTokens / (inputTokens + cacheReadTokens)) * 100 : 0;
    const healthRateRaw = breaker && breaker.total > 0 ? (breaker.healthy / breaker.total) * 100 : 100;

    const overviewSections: Section[] = useMemo(() => [
        {
            key: 'breaker',
            title: tSummary('section_breaker'),
            icon: ZapOff,
            items: [
                { key: 'triplets', label: tSummary('breaker_broken'), icon: Layers, color: 'text-primary', bgColor: 'bg-primary/10', value: Math.round((breaker?.total ?? 0) - (breaker?.healthy ?? 0)).toString() },
                { key: 'healthRate', label: tSummary('breaker_healthRate'), icon: ShieldCheck, color: 'text-chart-2', bgColor: 'bg-chart-2/10', value: healthRateRaw.toFixed(1), unit: '%' },
            ],
        },
        {
            key: 'status',
            title: tSummary('section_status'),
            icon: ShieldCheck,
            items: [
                { key: 'successRate', label: tItem('stability_successRate'), icon: CheckCircle2, color: 'text-accent', bgColor: 'bg-accent/10', value: successRateRaw.toFixed(1), unit: '%' },
                { key: 'cacheHitRate', label: tItem('stability_cacheHitRate'), icon: BookOpen, color: 'text-chart-4', bgColor: 'bg-chart-4/10', value: cacheHitRateRaw.toFixed(1), unit: '%' },
            ],
        },
        {
            key: 'requests',
            title: tSummary('section_requests'),
            icon: MessageSquare,
            items: [
                { key: 'success', label: tItem('requests_success'), icon: CheckCircle2, color: 'text-accent', bgColor: 'bg-accent/10', value: Math.round(requestSuccess).toString() },
                { key: 'failed', label: tItem('requests_failed'), icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10', value: Math.round(requestFailed).toString() },
            ],
        },
    ], [tSummary, tItem, breaker, healthRateRaw, successRateRaw, cacheHitRateRaw, requestSuccess, requestFailed]);

    const sections: Section[] = useMemo(() => [
        {
            key: 'input',
            title: tSummary('section_input'),
            icon: ArrowDownToLine,
            items: [
                { key: 'token', label: tItem('input_token'), icon: Hash, color: 'text-chart-3', bgColor: 'bg-chart-3/10', value: Math.round(inputTokens).toString() },
                { key: 'cost', label: tItem('input_cost'), icon: DollarSign, color: 'text-chart-3', bgColor: 'bg-chart-3/10', value: (total?.input_cost.raw ?? 0).toFixed(2), unit: '$' },
            ],
        },
        {
            key: 'output',
            title: tSummary('section_output'),
            icon: ArrowUpFromLine,
            items: [
                { key: 'token', label: tItem('output_token'), icon: Hash, color: 'text-chart-4', bgColor: 'bg-chart-4/10', value: Math.round(total?.output_token.raw ?? 0).toString() },
                { key: 'cost', label: tItem('output_cost'), icon: DollarSign, color: 'text-chart-4', bgColor: 'bg-chart-4/10', value: (total?.output_cost.raw ?? 0).toFixed(2), unit: '$' },
            ],
        },
        {
            key: 'cacheRead',
            title: tSummary('section_cacheRead'),
            icon: BookOpen,
            items: [
                { key: 'token', label: tItem('cacheRead_token'), icon: Hash, color: 'text-chart-4', bgColor: 'bg-chart-4/10', value: Math.round(cacheReadTokens).toString() },
                { key: 'cost', label: tItem('cacheRead_cost'), icon: DollarSign, color: 'text-chart-4', bgColor: 'bg-chart-4/10', value: (total?.cache_read_cost.raw ?? 0).toFixed(2), unit: '$' },
            ],
        },
        {
            key: 'cacheWrite',
            title: tSummary('section_cacheWrite'),
            icon: PenLine,
            items: [
                { key: 'token', label: tItem('cacheWrite_token'), icon: Hash, color: 'text-chart-2', bgColor: 'bg-chart-2/10', value: Math.round(total?.cache_write_token.raw ?? 0).toString() },
                { key: 'cost', label: tItem('cacheWrite_cost'), icon: DollarSign, color: 'text-chart-2', bgColor: 'bg-chart-2/10', value: (total?.cache_write_cost.raw ?? 0).toFixed(2), unit: '$' },
            ],
        },
    ], [tSummary, tItem, total, inputTokens, cacheReadTokens]);

    const renderCard = (card: Section, index: number) => (
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
    );

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderCard(overviewSections[0], 0)}
                    {renderCard(overviewSections[1], 1)}
                </div>
                {renderCard(overviewSections[2], 2)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sections.map((card, index) => renderCard(card, index + 3))}
            </div>
        </div>
    );
}
