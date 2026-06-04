import {
  createContext, useContext, useState, useCallback, useMemo, type ReactNode,
} from 'react';

export interface SelectedOperator {
  id: number;
  name: string;
}
export interface SelectedProduct {
  id: number;
  name: string;
}
export type Category = 'PMP' | 'INJECTION';

interface FlowValue {
  operator: SelectedOperator | null;
  product: SelectedProduct | null;
  pmp: number[];
  inj: number[];
  note: string;
  setOperator: (op: SelectedOperator) => void;
  endSession: () => void;
  setProduct: (p: SelectedProduct) => void;
  toggleDefect: (category: Category, defectTypeId: number) => void;
  isSelected: (category: Category, defectTypeId: number) => boolean;
  setNote: (note: string) => void;
  resetPart: () => void;
}

const Ctx = createContext<FlowValue | null>(null);

export function InspectionFlowProvider({ children }: { children: ReactNode }) {
  const [operator, setOperatorState] = useState<SelectedOperator | null>(null);
  const [product, setProductState] = useState<SelectedProduct | null>(null);
  const [pmp, setPmp] = useState<number[]>([]);
  const [inj, setInj] = useState<number[]>([]);
  const [note, setNoteState] = useState('');

  const resetPart = useCallback(() => {
    setPmp([]);
    setInj([]);
    setNoteState('');
  }, []);

  const setOperator = useCallback((op: SelectedOperator) => {
    setOperatorState(op);
  }, []);

  const endSession = useCallback(() => {
    setOperatorState(null);
    setProductState(null);
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
      operator, product, pmp, inj, note,
      setOperator, endSession, setProduct, toggleDefect, isSelected,
      setNote: setNoteState, resetPart,
    }),
    [operator, product, pmp, inj, note,
      setOperator, endSession, setProduct, toggleDefect, isSelected, resetPart],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInspectionFlow(): FlowValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useInspectionFlow must be used within <InspectionFlowProvider>');
  return ctx;
}
