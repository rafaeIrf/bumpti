import { useNetInfo } from "@react-native-community/netinfo";

export function usePrefetchWindowSize() {
  const netInfo = useNetInfo();
  return netInfo.type === "cellular" ? 3 : 6;
}
