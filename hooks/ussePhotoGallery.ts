// hooks/usePhotoGallery.ts - Fixed with legacy FileSystem import
import { useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getInfoAsync } from 'expo-file-system/legacy';

interface PhotoResult {
  uri: string;
  type: string;
  size: number;
  width: number;
  height: number;
  fileName?: string;
}

interface UsePhotoGalleryOptions {
  quality?: number;
  allowsEditing?: boolean;
  aspect?: [number, number];
  onPhotoSelected?: (photo: PhotoResult) => void;
  onError?: (error: string) => void;
}

export function usePhotoGallery({
  quality = 0.8,
  allowsEditing = true,
  aspect = [4, 3],
  onPhotoSelected,
  onError,
}: UsePhotoGalleryOptions = {}) {
  const [isSelecting, setIsSelecting] = useState(false);
  
  // Select photo from gallery
  const selectPhoto = useCallback(async () => {
    if (isSelecting) return;
    
    try {
      setIsSelecting(true);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing,
        aspect: allowsEditing ? aspect : undefined,
        quality,
      });
      
      if (result.canceled) {
        setIsSelecting(false);
        return;
      }
      
      const asset = result.assets[0];
      if (!asset?.uri) {
        throw new Error('No image selected');
      }
      
      // Use legacy FileSystem API
      const fileInfo = await getInfoAsync(asset.uri);
      
      if (!fileInfo.exists) {
        throw new Error('Selected image file does not exist');
      }
      
      const photoResult: PhotoResult = {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        size: fileInfo.size || 0,
        width: asset.width || 0,
        height: asset.height || 0,
        fileName: asset.fileName || `image_${Date.now()}.jpg`,
      };
      
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (photoResult.size > maxSize) {
        Alert.alert('Image Too Large', 'Please select an image smaller than 10MB.');
        setIsSelecting(false);
        return;
      }
      
      onPhotoSelected?.(photoResult);
      
    } catch (error) {
      console.error('Photo selection failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to select photo';
      Alert.alert('Photo Selection Failed', errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsSelecting(false);
    }
  }, [isSelecting, allowsEditing, aspect, quality, onPhotoSelected, onError]);
  
  // Take photo with camera
  const takePhoto = useCallback(async () => {
    if (isSelecting) return;
    
    try {
      setIsSelecting(true);
      
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!cameraPermission.granted) {
        Alert.alert('Camera Permission Required', 'Please enable camera access in your device settings to take photos.');
        setIsSelecting(false);
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing,
        aspect: allowsEditing ? aspect : undefined,
        quality,
      });
      
      if (result.canceled) {
        setIsSelecting(false);
        return;
      }
      
      const asset = result.assets[0];
      if (!asset?.uri) {
        throw new Error('No photo captured');
      }
      
      // Use legacy FileSystem API
      const fileInfo = await getInfoAsync(asset.uri);
      
      if (!fileInfo.exists) {
        throw new Error('Captured photo file does not exist');
      }
      
      const photoResult: PhotoResult = {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        size: fileInfo.size || 0,
        width: asset.width || 0,
        height: asset.height || 0,
        fileName: asset.fileName || `photo_${Date.now()}.jpg`,
      };
      
      onPhotoSelected?.(photoResult);
      
    } catch (error) {
      console.error('Photo capture failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to capture photo';
      Alert.alert('Photo Capture Failed', errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsSelecting(false);
    }
  }, [isSelecting, allowsEditing, aspect, quality, onPhotoSelected, onError]);
  
  // Check if camera is available
  const isCameraAvailable = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'web') return false;
      const cameraPermission = await ImagePicker.getCameraPermissionsAsync();
      return cameraPermission.status !== 'denied';
    } catch (error) {
      console.error('Failed to check camera availability:', error);
      return false;
    }
  }, []);
  
  return {
    isSelecting,
    selectPhoto,
    takePhoto,
    isCameraAvailable,
  };
}