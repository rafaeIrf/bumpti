import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

export interface PickImageOptions {
  /**
   * Aspect ratio for image cropping [width, height]
   * @default [1, 1]
   */
  aspect?: [number, number];

  /**
   * Image quality from 0 to 1
   * @default 0.8
   */
  quality?: number;

  /**
   * Allow editing/cropping the image
   * @default true
   */
  allowsEditing?: boolean;

  /**
   * Allow multiple selection
   * @default false
   */
  allowsMultipleSelection?: boolean;

  /**
   * Selection limit when allowsMultipleSelection is true
   * @default 1
   */
  selectionLimit?: number;
}

export interface PickImageResult {
  success: boolean;
  uri?: string;
  uris?: string[];
  error?: string;
}

/**
 * Request permission to access the device's media library
 * @returns Promise<boolean> - true if permission is granted
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.error("Error requesting media library permission:", error);
    return false;
  }
}

/**
 * Check if media library permission is granted
 * @returns Promise<boolean> - true if permission is granted
 */
export async function checkMediaLibraryPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.error("Error checking media library permission:", error);
    return false;
  }
}

/**
 * Request permission to access the device's camera
 * @returns Promise<boolean> - true if permission is granted
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.error("Error requesting camera permission:", error);
    return false;
  }
}

/**
 * Check if camera permission is granted
 * @returns Promise<boolean> - true if permission is granted
 */
export async function checkCameraPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.getCameraPermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.error("Error checking camera permission:", error);
    return false;
  }
}

/**
 * Pick an image from the device's media library
 * @param options - Configuration options for image picking
 * @returns Promise<PickImageResult> - Result object with success status and image URI(s)
 */
export async function pickImageFromLibrary(
  options: PickImageOptions = {}
): Promise<PickImageResult> {
  try {
    const {
      aspect = [1, 1],
      quality = 0.8,
      allowsEditing = true,
      allowsMultipleSelection = false,
      selectionLimit = 1,
    } = options;

    // Check/request permission
    const hasPermission = await checkMediaLibraryPermission();
    if (!hasPermission) {
      const granted = await requestMediaLibraryPermission();
      if (!granted) {
        return {
          success: false,
          error: "permission_denied",
        };
      }
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: !allowsMultipleSelection && allowsEditing,
      aspect,
      quality,
      allowsMultipleSelection,
      selectionLimit: allowsMultipleSelection ? selectionLimit : 1,
    });

    if (result.canceled) {
      return {
        success: false,
        error: "cancelled",
      };
    }

    // Return single or multiple URIs
    if (allowsMultipleSelection) {
      const uris = result.assets.map((asset) => asset.uri);
      return {
        success: true,
        uris,
      };
    } else {
      return {
        success: true,
        uri: result.assets[0].uri,
      };
    }
  } catch (error) {
    console.error("Error picking image from library:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

/**
 * Take a photo using the device's camera
 * @param options - Configuration options for camera
 * @returns Promise<PickImageResult> - Result object with success status and image URI
 */
export async function takePhoto(
  options: PickImageOptions = {}
): Promise<PickImageResult> {
  try {
    const { aspect = [1, 1], quality = 0.8, allowsEditing = true } = options;

    // Check/request permission
    const hasPermission = await checkCameraPermission();
    if (!hasPermission) {
      const granted = await requestCameraPermission();
      if (!granted) {
        return {
          success: false,
          error: "permission_denied",
        };
      }
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      allowsEditing,
      aspect,
      quality,
    });

    if (result.canceled) {
      return {
        success: false,
        error: "cancelled",
      };
    }

    return {
      success: true,
      uri: result.assets[0].uri,
    };
  } catch (error) {
    console.error("Error taking photo:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

/**
 * Show an action sheet to choose between camera and library
 * @param options - Configuration options for image picking
 * @param translations - Translation strings for the action sheet
 * @returns Promise<PickImageResult> - Result object with success status and image URI
 */
export async function pickImageWithOptions(
  options: PickImageOptions = {},
  translations: {
    title?: string;
    camera?: string;
    library?: string;
    cancel?: string;
  } = {}
): Promise<PickImageResult> {
  return new Promise((resolve) => {
    const {
      title = "Escolha uma opção",
      camera = "Tirar foto",
      library = "Escolher da galeria",
      cancel = "Cancelar",
    } = translations;

    Alert.alert(
      title,
      "",
      [
        {
          text: camera,
          onPress: async () => {
            const result = await takePhoto(options);
            resolve(result);
          },
        },
        {
          text: library,
          onPress: async () => {
            const result = await pickImageFromLibrary(options);
            resolve(result);
          },
        },
        {
          text: cancel,
          style: "cancel",
          onPress: () => {
            resolve({
              success: false,
              error: "cancelled",
            });
          },
        },
      ],
      { cancelable: true }
    );
  });
}
