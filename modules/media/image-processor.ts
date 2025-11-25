import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "react-native";

type ProcessedImage = {
  uri: string;
  name: string;
  type: string;
};

const MAX_DIMENSION = 1080;
const JPEG_QUALITY = 0.8; // 80% -> target ~300-500kb depending on source

function getDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
}

export async function processProfileImage(
  uri: string,
  name?: string
): Promise<ProcessedImage> {
  const { width, height } = await getDimensions(uri);
  const maxSide = Math.max(width, height);
  const scale = maxSide > MAX_DIMENSION ? MAX_DIMENSION / maxSide : 1;

  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [
      {
        resize: {
          width: targetWidth,
          height: targetHeight,
        },
      },
    ],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  return {
    uri: result.uri,
    name: name ?? `${Date.now()}.jpg`,
    type: "image/jpeg",
  };
}
