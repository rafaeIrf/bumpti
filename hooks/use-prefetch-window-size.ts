import { useNetInfo } from "@react-native-community/netinfo";

export function getPrefetchWindowSize(netInfoType?: string | null) {
  return netInfoType === "cellular" ? 3 : 6;
}

export function usePrefetchWindowSize() {
  const netInfo = useNetInfo();
  return getPrefetchWindowSize(netInfo.type);
}
