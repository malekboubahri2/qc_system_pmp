import {
  createContext, useContext, useState, useCallback, useMemo, type ReactNode,
} from 'react';

export interface SelectedProduct {
  id: number;
  name: string;
  hasCheatsheet?: boolean;
}
export type Category = 'PMP' | 'INJECTION';

interface FlowValue {
  product: SelectedProduct | null;
  pmp: number[];
  inj: number[];
  note: string;
  setProduct: (p: SelectedProduct) => void;
  toggleDefect: (category: Category, defectTypeId: number) => void;
  isSelected: (category: Category, defectTypeId: number) => boolean;
  setNote: (note: string) => void;
  resetPart: () => void;
}

const Ctx = createContext<FlowValue | null>(null);

export function InspectionFlowProvider({ children }: { children: ReactNode }) {
  const [product, setProductState] = useState<SelectedProduct | null>(null);
  const [pmp, setPmp] = useState<number[]>([]);
  const [inj, setInj] = useState<number[]>([]);
  const [note, setNoteState] = useState('');

  const resetPart = useCallback(() => {
    setPmp([]);
    setInj([]);
    setNoteState('');
  }, []);

  const setProduct = useCallback((p: SelectedProduct) => {
    setProductState(p);
    setPmp([]);
    setInj([]);
    setNoteState('');
  }, []);

  const toggleDefect = useCallback((category: Category, id: number) => {
    const apply = (prev: number[]) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    if (category === 'PMP') setPmp(apply);
    else setInj(apply);
  }, []);

  const isSelected = useCallback(
    (category: Category, id: number) =>
      (category === 'PMP' ? pmp : inj).includes(id),
    [pmp, inj],
  );

  const value = useMemo<FlowValue>(
    () => ({
      product, pmp, inj, note,
      setProduct, toggleDefect, isSelected, setNote: setNoteState, resetPart,
    }),
    [product, pmp, inj, note, setProduct, toggleDefect, isSelected, resetPart],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInspectionFlow(): FlowValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useInspectionFlow must be used within <InspectionFlowProvider>');
  return ctx;
}
