import * as Location from "expo-location";
import type { Coordinates } from "./types";

export const getUserPosition = async (): Promise<Coordinates> => {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission not granted");
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { latitude, longitude, accuracy } = position.coords;
  return { latitude, longitude, accuracy: accuracy ?? undefined };
};
