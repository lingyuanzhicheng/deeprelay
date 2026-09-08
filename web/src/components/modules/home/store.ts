'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ChartMetricType = 'cost' | 'count' | 'tokens';
export type ChartPeriod = '1' | '7' | '30';

interface HomeViewState {
    chartMetricType: ChartMetricType;
    chartPeriod: ChartPeriod;
    setChartMetricType: (value: ChartMetricType) => void;
    setChartPeriod: (value: ChartPeriod) => void;
}

export const useHomeViewStore = create<HomeViewState>()(
    persist(
        (set) => ({
            chartMetricType: 'count',
            chartPeriod: '1',
            setChartMetricType: (value) => set({ chartMetricType: value }),
            setChartPeriod: (value) => set({ chartPeriod: value }),
        }),
        {
            name: 'home-view-options-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                chartPeriod: state.chartPeriod,
            }),
        }
    )
);
