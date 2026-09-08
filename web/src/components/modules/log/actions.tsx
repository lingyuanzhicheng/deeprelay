'use client';

import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLogViewOptionsStore } from './view-options-store';

/**
 * 日志页右上角操作：实时刷新开关 + 时间筛选
 * 筛选按钮与弹窗样式对齐各页面顶栏的筛选排序组件
 */
export function LogActions() {
    const t = useTranslations('log.toolbar');
    const realtime = useLogViewOptionsStore((s) => s.realtime);
    const toggleRealtime = useLogViewOptionsStore((s) => s.toggleRealtime);
    const startDate = useLogViewOptionsStore((s) => s.startDate);
    const endDate = useLogViewOptionsStore((s) => s.endDate);
    const setStartDate = useLogViewOptionsStore((s) => s.setStartDate);
    const setEndDate = useLogViewOptionsStore((s) => s.setEndDate);
    const clearDateFilter = useLogViewOptionsStore((s) => s.clearDateFilter);
    const hasDateFilter = startDate !== '' || endDate !== '';

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                aria-label={t('refresh')}
                aria-pressed={realtime}
                onClick={toggleRealtime}
                className={buttonVariants({
                    variant: 'ghost',
                    size: 'icon',
                    className: cn(
                        'rounded-xl transition-none hover:bg-transparent',
                        realtime ? 'text-primary hover:text-primary' : 'text-muted-foreground hover:text-foreground',
                    ),
                })}
            >
                <RefreshCw className={cn('size-4 transition-colors duration-300', realtime && 'animate-spin')} />
            </button>

            <Popover>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        aria-label={t('filter')}
                        className={buttonVariants({
                            variant: 'ghost',
                            size: 'icon',
                            className: 'rounded-xl transition-none hover:bg-transparent text-muted-foreground hover:text-foreground',
                        })}
                    >
                        <SlidersHorizontal className="size-4 transition-colors duration-300" />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    align="center"
                    side="bottom"
                    sideOffset={8}
                    className="w-64 rounded-2xl border border-border/60 bg-card p-3 shadow-xl"
                >
                    <div className="grid gap-3">
                        <div className="grid gap-2">
                            <p className="text-xs font-medium text-muted-foreground">{t('filter')}</p>
                            <label className="grid gap-1 text-xs text-muted-foreground">
                                {t('startDate')}
                                <input
                                    type="date"
                                    value={startDate}
                                    max={endDate || undefined}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="h-8 rounded-lg border border-border bg-muted/20 px-2 text-xs text-foreground transition-colors hover:bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </label>
                            <label className="grid gap-1 text-xs text-muted-foreground">
                                {t('endDate')}
                                <input
                                    type="date"
                                    value={endDate}
                                    min={startDate || undefined}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="h-8 rounded-lg border border-border bg-muted/20 px-2 text-xs text-foreground transition-colors hover:bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </label>
                            <button
                                type="button"
                                onClick={clearDateFilter}
                                disabled={!hasDateFilter}
                                className="h-8 rounded-lg border border-border bg-muted/20 text-xs font-medium text-foreground transition-colors hover:bg-muted/30 disabled:opacity-50"
                            >
                                {t('clear')}
                            </button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
