import { MutableRefObject, createContext } from "react";

export interface BSProps {
  content: () => React.ReactNode;
  draggable?: boolean;
  snapPoints?: (string | number)[]; // e.g., ['100%'] for full-screen
}

export interface BottomSheetContextValue {
  isBottomSheetOpen?: boolean;
  expand: (bsProps: BSProps) => void;
  close: () => void;
  screenTitle?: MutableRefObject<string>;
}

export const BottomSheetContext = createContext<
  BottomSheetContextValue | undefined
>(undefined);
