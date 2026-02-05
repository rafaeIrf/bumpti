import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "react-native";

import { logger } from "@/utils/logger";

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

/**
 * Compresses an image and converts it to base64 format for moderation API.
 * Uses lower quality for moderation since high fidelity isn't needed.
 *
 * @param uri - Local file URI of the image
 * @param quality - JPEG compression quality (0-1), default 0.7
 * @returns Base64-encoded string of the compressed image
 */
export async function imageToBase64(
  uri: string,
  quality: number = 0.7
): Promise<string> {
  try {
    // Compress image to JPEG with specified quality, resize for moderation
    // Note: OpenAI's low detail mode only uses 512px max, so we optimize bandwidth
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 512 } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Read the compressed file as base64 using new FileSystem API
    const file = new FileSystem.File(manipulatedImage.uri);
    const base64 = await file.base64();

    return base64;
  } catch (error) {
    logger.error("Failed to convert image to base64:", error);
    throw error;
  }
}

/**
 * Checks if a URI is a remote URL (http/https)
 */
export function isRemoteUri(uri: string): boolean {
  return uri.startsWith("http://") || uri.startsWith("https://");
}
