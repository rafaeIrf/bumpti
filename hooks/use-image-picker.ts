import {
  pickImageFromLibrary,
  PickImageOptions,
  PickImageResult,
  pickImageWithOptions,
  takePhoto,
} from "@/modules/media";
import { useState } from "react";

export interface UseImagePickerResult {
  /** Se está carregando/processando */
  isLoading: boolean;

  /** Selecionar imagem da galeria */
  pickFromLibrary: (options?: PickImageOptions) => Promise<PickImageResult>;

  /** Capturar foto com câmera */
  capturePhoto: (options?: PickImageOptions) => Promise<PickImageResult>;

  /** Mostrar opções (câmera ou galeria) */
  pickWithOptions: (
    options?: PickImageOptions,
    translations?: {
      title?: string;
      camera?: string;
      library?: string;
      cancel?: string;
    }
  ) => Promise<PickImageResult>;
}

/**
 * Hook para facilitar a seleção de imagens nas telas
 *
 * @example
 * ```tsx
 * const { isLoading, pickFromLibrary, capturePhoto } = useImagePicker();
 *
 * const handleSelectPhoto = async () => {
 *   const result = await pickFromLibrary({ aspect: [3, 4] });
 *   if (result.success && result.uri) {
 *     setPhotoUri(result.uri);
 *   }
 * };
 * ```
 */
export function useImagePicker(): UseImagePickerResult {
  const [isLoading, setIsLoading] = useState(false);

  const pickFromLibrary = async (
    options?: PickImageOptions
  ): Promise<PickImageResult> => {
    try {
      setIsLoading(true);
      return await pickImageFromLibrary(options);
    } finally {
      setIsLoading(false);
    }
  };

  const capturePhoto = async (
    options?: PickImageOptions
  ): Promise<PickImageResult> => {
    try {
      setIsLoading(true);
      return await takePhoto(options);
    } finally {
      setIsLoading(false);
    }
  };

  const pickWithOptions = async (
    options?: PickImageOptions,
    translations?: {
      title?: string;
      camera?: string;
      library?: string;
      cancel?: string;
    }
  ): Promise<PickImageResult> => {
    try {
      setIsLoading(true);
      return await pickImageWithOptions(options, translations);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    pickFromLibrary,
    capturePhoto,
    pickWithOptions,
  };
}
