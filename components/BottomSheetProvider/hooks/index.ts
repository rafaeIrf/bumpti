import { useContext } from 'react';
import { BottomSheetContext } from '../context';

export const useCustomBottomSheet = () => {
  return useContext(BottomSheetContext);
};
