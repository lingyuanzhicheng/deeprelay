'use client';

import { useCallback, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface ComboboxOption {
    /** stable key */
    key: string;
    /** display label */
    label: string;
    /** text used for filtering */
    filterText: string;
    /** optional right-aligned hint, e.g. "0.5/1.5" price echo */
    hint?: string;
}

interface ComboboxProps {
    options: ComboboxOption[];
    value: string | undefined;
    placeholder?: string;
    disabledLabel?: string;
    onSelect: (v: string) => void;
    triggerClassName?: string;
    /** render custom option item content; default = plain label (or label + hint) */
    renderOption?: (opt: ComboboxOption, isSelected: boolean) => React.ReactNode;
    /** render the trigger display value; default = value || disabledLabel */
    renderValue?: (value: string, disabledLabel: string) => React.ReactNode;
    /** className for the trigger button */
    className?: string;
    /** optional label shown above the trigger */
    label?: string;
    /** disable the trigger; popover won't open */
    disabled?: boolean;
}

export function Combobox({
    options,
    value,
    placeholder,
    disabledLabel = '',
    onSelect,
    triggerClassName,
    renderOption,
    renderValue,
    className,
    label,
    disabled,
}: ComboboxProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const triggerRef = useRef<HTMLButtonElement>(null);

    const hasValue = value !== '';
    const selectedOpt = hasValue ? options.find((o) => o.key === value) : null;
    const displayLabel = selectedOpt ? selectedOpt.label : (hasValue ? value : disabledLabel);

    const filtered = query === ''
        ? options
        : options.filter((o) =>
            (o.label || '').toLowerCase().includes(query.toLowerCase()) ||
            (o.filterText || '').toLowerCase().includes(query.toLowerCase())
        );

    const handleSelect = useCallback((v: string) => {
        onSelect(v);
        setOpen(false);
        setQuery('');
    }, [onSelect]);

    const handleOpenChange = useCallback((o: boolean) => {
        if (disabled) return;
        setOpen(o);
        if (!o) setQuery('');
    }, [disabled]);

    return (
        <div className="grid gap-1">
            {label && <label className="text-xs text-muted-foreground">{label}</label>}
            <Popover open={open} onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>
                    <button
                        ref={triggerRef}
                        type="button"
                        disabled={disabled}
                        className={cn(
                            'flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                            hasValue && 'text-foreground',
                            className,
                            triggerClassName
                        )}
                        style={{ width: '100%' }}
                    >
                        <span className={cn('truncate', !hasValue && 'text-muted-foreground/60')}>
                            {renderValue ? renderValue(value ?? '', disabledLabel) : displayLabel}
                        </span>
                        <ChevronDown className="size-4 shrink-0 opacity-50" />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    className="p-0 overflow-hidden"
                    style={{ width: triggerRef.current?.offsetWidth ?? 'auto' }}
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <div className="flex items-center border-b px-3 py-2 gap-2">
                        <Search className="size-4 shrink-0 text-muted-foreground" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={placeholder}
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                    </div>
                    <ul className="max-h-60 overflow-y-auto p-1">
                        {filtered.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-muted-foreground">—</li>
                        ) : (
                            filtered.map((option) => {
                                const isSelected = option.key === value;
                                return (
                                    <li key={option.key}>
                                        <button
                                            type="button"
                                            onClick={() => handleSelect(option.key)}
                                            className={cn(
                                                'w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors',
                                                isSelected
                                                    ? 'bg-accent text-accent-foreground font-medium'
                                                    : 'hover:bg-muted text-foreground'
                                            )}
                                        >
                                            <span className="truncate">
                                                {renderOption
                                                    ? renderOption(option, isSelected)
                                                    : option.label}
                                            </span>
                                            {!renderOption && option.hint && (
                                                <span className="text-muted-foreground tabular-nums shrink-0 text-xs">
                                                    {option.hint}
                                                </span>
                                            )}
                                            {isSelected && <Check className="size-4 shrink-0 text-primary" />}
                                        </button>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </PopoverContent>
            </Popover>
        </div>
    );
}
