import { create } from 'zustand';

interface LogViewOptionsState {
    realtime: boolean;
    startDate: string;
    endDate: string;
    toggleRealtime: () => void;
    setStartDate: (value: string) => void;
    setEndDate: (value: string) => void;
    clearDateFilter: () => void;
}

export const useLogViewOptionsStore = create<LogViewOptionsState>()((set) => ({
    realtime: false,
    startDate: '',
    endDate: '',
    toggleRealtime: () => set((state) => ({ realtime: !state.realtime })),
    setStartDate: (value) => set({ startDate: value }),
    setEndDate: (value) => set({ endDate: value }),
    clearDateFilter: () => set({ startDate: '', endDate: '' }),
}));
