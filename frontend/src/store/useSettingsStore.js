import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useSettingsStore = create(
  persist(
    (set) => ({
      weightUnit:  'kg',
      heightUnit:  'cm',
      glucoseUnit: 'mg/dL',
      energyUnit:  'kcal',

      macroTargets: { glucides: 50, proteines: 20, lipides: 30 },

      setWeightUnit:   (unit)    => set({ weightUnit: unit }),
      setHeightUnit:   (unit)    => set({ heightUnit: unit }),
      setGlucoseUnit:  (unit)    => set({ glucoseUnit: unit }),
      setEnergyUnit:   (unit)    => set({ energyUnit: unit }),
      setMacroTargets: (targets) => set({ macroTargets: targets }),
    }),
    { name: 'nutrivita-settings' }
  )
);

export default useSettingsStore;
