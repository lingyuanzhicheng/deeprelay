'use client';

import {
    MorphingDialogClose,
    MorphingDialogTitle,
    MorphingDialogDescription,
    useMorphingDialog,
} from '@/components/ui/morphing-dialog';
import { useCreateAPIKey } from '@/api/endpoints/apikey';
import { useTranslations } from 'next-intl';
import { toast } from '@/components/common/Toast';
import type { ApiError } from '@/api/types';
import { APIKeyForm } from '@/components/modules/setting/APIKey';

export function CreateDialogContent() {
    const { setIsOpen } = useMorphingDialog();
    const createAPIKey = useCreateAPIKey();
    const t = useTranslations('setting');

    return (
        <div className="w-screen max-w-full md:max-w-md">
            <MorphingDialogTitle className="shrink-0">
                <header className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-card-foreground">
                        {t('apiKey.add')}
                    </h2>
                    <MorphingDialogClose
                        className="relative right-0 top-0"
                        variants={{
                            initial: { opacity: 0, scale: 0.8 },
                            animate: { opacity: 1, scale: 1 },
                            exit: { opacity: 0, scale: 0.8 },
                        }}
                    />
                </header>
            </MorphingDialogTitle>
            <MorphingDialogDescription>
                <APIKeyForm
                    isPending={createAPIKey.isPending}
                    submitLabel={t('apiKey.form.create')}
                    onSubmit={(data) => {
                        createAPIKey.mutate(data, {
                            onSuccess: () => {
                                toast.success(t('apiKey.toast.createSuccess'));
                                setIsOpen(false);
                            },
                            onError: (error) => {
                                const msg = (error as unknown as ApiError)?.message;
                                toast.error(t('apiKey.toast.createError'), { description: msg });
                            },
                        });
                    }}
                    onClose={() => setIsOpen(false)}
                />
            </MorphingDialogDescription>
        </div>
    );
}
