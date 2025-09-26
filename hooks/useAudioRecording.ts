// hooks/useAudioRecording.ts - Fixed with iOS audio routing reset
import { useState, useCallback, useRef, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { File } from 'expo-file-system';

interface AudioRecordingState {
  isRecording: boolean;
  duration: number;
  status: 'idle' | 'recording' | 'processing' | 'error';
}

interface AudioRecordingResult {
  uri: string;
  duration: number;
  size: number;
  mimeType: string;
}

interface UseAudioRecordingOptions {
  maxDurationMs?: number;
  onRecordingComplete?: (result: AudioRecordingResult) => void;
  onRecordingError?: (error: string) => void;
}

export function useAudioRecording({
  maxDurationMs = 60000, // 1 minute default
  onRecordingComplete,
  onRecordingError,
}: UseAudioRecordingOptions = {}) {
  
  // Add unique identifier to track hook instances
  const hookId = useRef(Math.random().toString(36).substr(2, 9));
  
  const [recordingState, setRecordingState] = useState<AudioRecordingState>({
    isRecording: false,
    duration: 0,
    status: 'idle',
  });
  
  // Use ref instead of state for permission to avoid stale closures
  const hasPermissionRef = useRef<boolean | null>(null);
  
  // Keep state for UI purposes but don't rely on it for logic
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  // Core recording refs
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<number | null>(null);

  // Request microphone permission using expo-av
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {

      const { status } = await Audio.requestPermissionsAsync();
      const granted = status === 'granted';
      
      // Update both ref (for immediate access) and state (for UI)
      hasPermissionRef.current = granted;
      setHasPermission(granted);

      if (!granted) {
        Alert.alert('Permission Required', 'Microphone access is needed for voice messages.');
      }
      return granted;
    } catch (error) {
      console.error('Permission request failed:', error);
      onRecordingError?.('Failed to request microphone permission');
      return false;
    }
  }, [onRecordingError]);

  // Setup audio mode using expo-av for recording
  const setupAudioMode = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Failed to set audio mode:', error);
      throw new Error('Failed to setup audio session');
    }
  }, []);

  // Reset audio mode after recording to fix iOS routing
  const resetAudioMode = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,  // Disable recording mode
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      
      // Play silent audio to ensure routing reset
      try {
        const { sound } = await Audio.Sound.createAsync(
          { 
            uri: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBj2k0d6SQgULMIOOSEkRCjOa3sDFfiwGOXTN4ZxWEwxmxO9P' 
          },
          { shouldPlay: false }
        );
        await sound.playAsync();
        setTimeout(() => sound.unloadAsync(), 100);
      } catch (silentError) {
      }
    } catch (error) {
      console.error('Failed to reset audio mode:', error);
    }
  }, []);

  // Stop and clean up any existing recording instance
  const cleanup = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
    }
    setRecordingState({ isRecording: false, duration: 0, status: 'idle' });
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      
      // Get current permission status first
      const { status } = await Audio.getPermissionsAsync();
      const currentlyGranted = status === 'granted';
      
      if (!currentlyGranted) {
        const requestResult = await Audio.requestPermissionsAsync();
        const granted = requestResult.status === 'granted';
        hasPermissionRef.current = granted;
        setHasPermission(granted);
        
        if (!granted) {
          Alert.alert('Permission Required', 'Microphone access is needed for voice messages.');
          await cleanup();
          return;
        }
      } else {
        hasPermissionRef.current = currentlyGranted;
        setHasPermission(currentlyGranted);
      }

      setRecordingState({ isRecording: true, duration: 0, status: 'recording' });
      await setupAudioMode();

      const recording = new Audio.Recording();
      
      await recording.prepareToRecordAsync({
        android: {
          extension: '.mp4',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.mp4',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        }
      });

      recordingRef.current = recording;
      await recording.startAsync();

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setRecordingState(prev => ({ ...prev, duration: elapsed }));

        if (elapsed >= maxDurationMs) {
          stopRecording();
        }
      }, 100);

    } catch (error) {
      console.error('Failed to start recording:', error);
      onRecordingError?.('Failed to start recording.');
      await cleanup();
    }
  }, [setupAudioMode, maxDurationMs, cleanup, onRecordingError]);

  // Stop recording with iOS audio routing fix
const stopRecording = useCallback(async () => {
  if (!recordingRef.current) {
    console.warn('Stop called but no recording was in progress.');
    return;
  }
  
  try {
    setRecordingState(prev => ({ ...prev, status: 'processing' }));
    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    const finalDuration = recordingState.duration;

    // Reset the ref *before* processing the file
    recordingRef.current = null;
    if(timerRef.current) clearInterval(timerRef.current);

    if (!uri) {
      throw new Error('Recording URI is null after stopping.');
    }

    const file = new File(uri);
    const fileInfo = await file.info();

    if (!fileInfo.exists || fileInfo.size === 0) {
      throw new Error('Recording resulted in an empty or non-existent file.');
    }

    const result: AudioRecordingResult = {
      uri,
      duration: finalDuration,
      size: fileInfo.size ?? 0,
      mimeType:'audio/mp4',
    };

    // CRITICAL: Reset iOS audio routing after recording completes (silent version)
    await resetAudioMode();

    onRecordingComplete?.(result);
    setRecordingState({ isRecording: false, duration: 0, status: 'idle' });

  } catch (error) {
    console.error('Failed to stop recording:', error);
    onRecordingError?.('Failed to save recording.');
    await cleanup();
    // Still try to reset audio mode even on error
    await resetAudioMode();
  }
}, [recordingState.duration, onRecordingComplete, onRecordingError, cleanup, resetAudioMode]);

  const cancelRecording = useCallback(async () => {

    
    if (!recordingRef.current) {
      return;
    }
    
    try {
      await recordingRef.current.stopAndUnloadAsync();
      
      const uri = recordingRef.current.getURI();
      
      if (uri) {
        const file = new File(uri);
        const fileInfo = await file.info();
        
        if (fileInfo.exists) {
          await file.delete();
        } 
      } 
    } catch (error) {
    } finally {
      
      // Clear recording reference
      const hadRecordingRef = !!recordingRef.current;
      recordingRef.current = null;
      
      // Clear timer
      const hadTimer = !!timerRef.current;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Reset state
      const previousState = { ...recordingState };
      setRecordingState({ 
        isRecording: false, 
        duration: 0, 
        status: 'idle' 
      });
      
      // CRITICAL: Also reset audio mode when cancelling
      await resetAudioMode();
    }
    
  }, [recordingState, resetAudioMode]);
  
  // Format duration for display
  const formatDuration = (duration: number): string => {
    const totalSeconds = Math.floor(duration / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        cleanup();
      }
    };
  }, [cleanup]);

  return {
    recordingState,
    hasPermission, // Still expose for UI purposes
    startRecording,
    stopRecording,
    cancelRecording,
    formatDuration,
  };
}