import { fetchOptions } from "@/modules/store/slices/optionsSlice";
import { useEffect } from "react";
import { useAppDispatch } from "@/modules/store/hooks";

export function OptionsInitializer() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchOptions());
  }, [dispatch]);

  return null;
}
