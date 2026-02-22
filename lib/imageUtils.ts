import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

interface CompressedImage {
  uri: string;
  base64: string;
}

async function compressImage(uri: string): Promise<CompressedImage> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.7, format: SaveFormat.JPEG, base64: true }
  );

  return {
    uri: result.uri,
    base64: result.base64 ?? '',
  };
}

export async function pickFromCamera(): Promise<CompressedImage | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
    aspect: [1, 1],
  });

  if (result.canceled || !result.assets[0]) return null;

  return compressImage(result.assets[0].uri);
}

export async function pickFromLibrary(): Promise<CompressedImage | null> {
  const permission =
    await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
    aspect: [1, 1],
  });

  if (result.canceled || !result.assets[0]) return null;

  return compressImage(result.assets[0].uri);
}
