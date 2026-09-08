'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Sun, Moon, Monitor, Languages, KeyRound } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettingStore, type Locale } from '@/stores/setting';
import { useAuthStore } from '@/api/endpoints/user';
import { useAPIKeySelfReset } from '@/api/endpoints/apikey';
import { CopyIconButton } from '@/components/common/CopyButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/common/Toast';
import { PageWrapper } from '@/components/common/PageWrapper';

export function KeySettings() {
    const t = useTranslations('setting');
    const tDash = useTranslations('apiKeyDashboard');
    const { theme, setTheme } = useTheme();
    const { locale, setLocale } = useSettingStore();
    const token = useAuthStore((s) => s.token);
    const logout = useAuthStore((s) => s.logout);
    const resetOwn = useAPIKeySelfReset();
    const [confirming, setConfirming] = useState(false);
    const [newKey, setNewKey] = useState<string | null>(null);

    const handleReset = () => {
        if (!confirming) {
            setConfirming(true);
            return;
        }
        setConfirming(false);
        resetOwn.mutate(undefined, {
            onSuccess: (data) => {
                setNewKey(data.api_key);
                toast.success(t('resetSuccess'));
            },
        });
    };

    return (
        <div className="h-full min-h-0 overflow-y-auto overscroll-contain rounded-t-3xl">
            <PageWrapper className="columns-1 gap-4 pb-24 md:columns-2 md:pb-4 *:mb-4 *:break-inside-avoid">
                {/* Appearance */}
                <div className="rounded-3xl border border-border bg-card p-6 space-y-5">
                    <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                        <Sun className="h-5 w-5" />
                        {t('appearance')}
                    </h2>

                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            {theme === 'dark' ? <Moon className="h-5 w-5 text-muted-foreground" /> : <Sun className="h-5 w-5 text-muted-foreground" />}
                            <span className="text-sm font-medium">{t('theme.label')}</span>
                        </div>
                        <Select value={theme} onValueChange={setTheme}>
                            <SelectTrigger className="w-36 rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="light" className="rounded-xl">
                                    <Sun className="size-4" />
                                    {t('theme.light')}
                                </SelectItem>
                                <SelectItem value="dark" className="rounded-xl">
                                    <Moon className="size-4" />
                                    {t('theme.dark')}
                                </SelectItem>
                                <SelectItem value="system" className="rounded-xl">
                                    <Monitor className="size-4" />
                                    {t('theme.system')}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Languages className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm font-medium">{t('language.label')}</span>
                        </div>
                        <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
                            <SelectTrigger className="w-36 rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="zh_hans" className="rounded-xl">{t('language.zh_hans')}</SelectItem>
                                <SelectItem value="zh_hant" className="rounded-xl">{t('language.zh_hant')}</SelectItem>
                                <SelectItem value="en" className="rounded-xl">{t('language.en')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Account */}
                <div className="rounded-3xl border border-border bg-card p-6 space-y-6">
                    <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                        <KeyRound className="h-5 w-5" />
                        {t('keyAccount.title')}
                    </h2>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <KeyRound className="size-4" />
                            {t('keyAccount.showKeyValue')}
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1 min-w-0">
                                <Input
                                    type="text"
                                    readOnly
                                    value={token ?? '—'}
                                    onFocus={(e) => e.currentTarget.select()}
                                    className="pr-12 font-mono text-sm rounded-xl"
                                />
                                {token && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                        <CopyIconButton
                                            text={token}
                                            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
                                            copyIconClassName="size-3.5"
                                            checkIconClassName="size-3.5"
                                        />
                                    </div>
                                )}
                            </div>
                            <Button
                                type="button"
                                disabled={resetOwn.isPending}
                                onClick={handleReset}
                                className="shrink-0 rounded-xl"
                            >
                                {confirming ? t('keyAccount.resetConfirm') : t('keyAccount.reset')}
                            </Button>
                        </div>
                        {confirming && (
                            <div className="flex justify-end">
                                <Button type="button" variant="ghost" size="sm" className="rounded-xl h-7 text-xs" onClick={() => setConfirming(false)}>
                                    {tDash('cancel')}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </PageWrapper>

            {/* New key dialog */}
            {newKey && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 space-y-4">
                        <h3 className="text-lg font-bold text-card-foreground">{t('keyAccount.resetSuccess')}</h3>
                        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/50 p-3">
                            <code className="flex-1 font-mono text-sm break-all">{newKey}</code>
                            <CopyIconButton
                                text={newKey}
                                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all hover:bg-primary hover:text-primary-foreground active:scale-95"
                                copyIconClassName="size-4"
                                checkIconClassName="size-4"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">{t('keyAccount.resetInvalidated')}</p>
                        <Button type="button" className="w-full rounded-2xl h-11" onClick={logout}>
                            {tDash('logout')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
