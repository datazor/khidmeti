// components/onboarding/SelfieStep.tsx
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useWorkerOnboarding } from '../../hooks/useWorkerOnboarding';
import { useAuth } from '../../hooks/useAuth';
import { usePhotoUpload } from '../../contexts/UploadContext';
import { COLORS, SPACING } from '../../constants/design';

interface SelfieStepProps {
  onNext: () => void;
  onBack: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export function SelfieStep({ onNext, onBack }: SelfieStepProps) {
  const { loading, progress, uploadSelfie } = useWorkerOnboarding();
  const { user } = useAuth();
  const { uploadPhoto } = usePhotoUpload();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const hasSelfie = !!progress?.selfie_url;

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || isCapturing || isUploading || !user?._id) return;

    try {
      setIsCapturing(true);
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3, // Reduced quality for faster upload
        base64: false,
        skipProcessing: false,
      });

      if (photo?.uri) {
        setIsCapturing(false);
        setIsUploading(true);
        
        const fileName = `selfie_${Date.now()}.jpg`;
        
        // Use the working upload pattern from UploadContext
        const uploadResult = await uploadPhoto(
          {
            uri: photo.uri,
            type: 'image/jpeg',
            size: 0, // Size will be determined by the upload system
            width: photo.width || 0,
            height: photo.height || 0,
            fileName: fileName,
          },
          user._id
        );

        // Update user with selfie using the actual file URL from upload
        await uploadSelfie(photo.uri, fileName);
        
        Alert.alert(
          'Success!',
          'Your selfie has been uploaded successfully.',
          [{ text: 'Continue', onPress: onNext }]
        );
      }
    } catch (error) {
      console.error('❌ Upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert(
        'Upload Failed',
        `Error: ${errorMessage}. Please try again.`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsCapturing(false);
      setIsUploading(false);
    }
  }, [isCapturing, isUploading, user?._id, uploadPhoto, uploadSelfie, onNext]);

  const toggleCameraFacing = useCallback(() => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }, []);

  // Permission loading state
  if (!permission) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.white} />
        </View>
      </View>
    );
  }

  // Permission request
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.permissionContainer}>
          <View style={styles.permissionContent}>
            <Ionicons name="camera-outline" size={80} color={COLORS.white} />
            <Text style={styles.permissionTitle}>Camera Access</Text>
            <Text style={styles.permissionText}>
              Take a quick selfie for verification
            </Text>
            <Pressable style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Enable Camera</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Full Screen Camera */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        autofocus="on"
      />
      
      {/* Top Header */}
      <View style={styles.topHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="close" size={28} color={COLORS.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Take Selfie</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Face Guide Overlay */}
      <View style={styles.overlay}>
        <View style={styles.faceGuide}>
          <View style={styles.faceOutline} />
        </View>
        <Text style={styles.instructionText}>
          Position your face in the circle
        </Text>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        {/* Camera Flip Button */}
        <Pressable style={styles.flipButton} onPress={toggleCameraFacing}>
          <Ionicons name="camera-reverse" size={28} color={COLORS.white} />
        </Pressable>

        {/* Capture Button */}
        <Pressable
          style={[
            styles.captureButton,
            (isCapturing || isUploading) && styles.captureButtonDisabled
          ]}
          onPress={takePicture}
          disabled={isCapturing || isUploading}
        >
          <View style={styles.captureButtonInner}>
            {(isCapturing || isUploading) ? (
              <ActivityIndicator size="large" color={COLORS.white} />
            ) : (
              <View style={styles.captureButtonDot} />
            )}
          </View>
        </Pressable>

        {/* Continue Button (if already has selfie) */}
        {hasSelfie ? (
          <Pressable style={styles.continueButton} onPress={onNext}>
            <Ionicons name="checkmark" size={28} color={COLORS.white} />
          </Pressable>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {/* Status Text */}
      {(isCapturing || isUploading) && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {isCapturing ? 'Capturing...' : 'Uploading...'}
          </Text>
        </View>
      )}

      {/* Success Indicator */}
      {hasSelfie && !isUploading && (
        <View style={styles.successContainer}>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark" size={20} color={COLORS.white} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  camera: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  
  // Permission Styles
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    backgroundColor: '#000',
  },
  
  permissionContent: {
    alignItems: 'center',
  },
  
  permissionTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.white,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  
  permissionText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: SPACING.xxxl,
    lineHeight: 24,
  },
  
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 25,
    minWidth: 200,
    alignItems: 'center',
  },
  
  permissionButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.white,
  },
  
  // Header
  topHeader: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    zIndex: 10,
  },
  
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.white,
  },
  
  placeholder: {
    width: 44,
    height: 44,
  },
  
  // Face Guide Overlay
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  
  faceGuide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  faceOutline: {
    width: 280,
    height: 350,
    borderRadius: 140,
    borderWidth: 3,
    borderColor: COLORS.white,
    borderStyle: 'dashed',
    opacity: 0.8,
  },
  
  instructionText: {
    fontSize: 16,
    color: COLORS.white,
    textAlign: 'center',
    marginTop: SPACING.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    overflow: 'hidden',
  },
  
  // Bottom Controls
  bottomControls: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    zIndex: 10,
  },
  
  flipButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  
  captureButtonDisabled: {
    opacity: 0.6,
  },
  
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  captureButtonDot: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.white,
  },
  
  continueButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  
  // Status
  statusContainer: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  
  statusText: {
    fontSize: 16,
    color: COLORS.white,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    overflow: 'hidden',
  },
  
  // Success
  successContainer: {
    position: 'absolute',
    top: 120,
    right: SPACING.lg,
    zIndex: 10,
  },
  
  successBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
});
