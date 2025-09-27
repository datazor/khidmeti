// components/chat/VoiceMessageBubble.tsx
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

// Design System
const COLORS = {
  primary: '#2563eb',
  primaryLight: '#3b82f6',
  success: '#059669',
  white: '#ffffff',
  gray100: '#f1f5f9',
  gray200: '#e2e8f0',
  gray300: '#cbd5e1',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1e293b',
  gray900: '#0f172a',
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
};

const TYPOGRAPHY = {
  caption: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 14,
  },
  small: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
};

// Message status types
type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

interface VoiceMessageBubbleProps {
  // Message data
  messageId: string;
  audioUri: string;
  duration: number; // in milliseconds
  isCurrentUser: boolean;
  timestamp: number;
  status?: MessageStatus;
  
  // Sender info (for received messages)
  senderName?: string;
  senderAvatar?: string;
  
  // Styling
  isRTL?: boolean;
  maxWidth?: number;
  isFirst?: boolean;
  isLast?: boolean;
  compact?: boolean; // Added compact prop
  
  // Callbacks
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onError?: (error: string) => void;
}

// Error Boundary for audio failures
export function AudioErrorBoundary({ 
  children, 
  onError 
}: { 
  children: React.ReactNode;
  onError?: () => void;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={20} color={COLORS.gray400} />
        <Text style={styles.errorText}>Audio unavailable</Text>
        <Pressable 
          onPress={() => {
            setHasError(false);
            onError?.();
          }}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>{children}</>
  );
}

export function VoiceMessageBubble({
  messageId,
  audioUri,
  duration,
  isCurrentUser,
  timestamp,
  status = 'sent',
  senderName,
  senderAvatar,
  isRTL = false,
  maxWidth = 250,
  isFirst = false,
  isLast = false,
  compact = false, // Added compact prop with default value
  onPlaybackStart,
  onPlaybackEnd,
  onError,
}: VoiceMessageBubbleProps) {
  
  // Use hook-based approach - let it handle lifecycle automatically
  const audioSource = useMemo(() => ({ uri: audioUri }), [audioUri]);
  const player = useAudioPlayer(audioSource);
  const audioStatus = useAudioPlayerStatus(player);
  
 
  // Event-driven state updates (following Expo best practices)
  const [isLoading, setIsLoading] = useState(false);
  const [progressTrackWidth, setProgressTrackWidth] = useState(compact ? 120 : 180); // Adjust for compact mode
  
  // Derived state from audio status - no complex useEffect chains
  const isPlaying = audioStatus.playing || false;
  const currentPosition = (audioStatus.currentTime || 0) * 1000;
  const totalDuration = audioStatus.duration ? audioStatus.duration * 1000 : duration;
  const hasFinished = audioStatus.didJustFinish || false;
  
  // Progress calculation with functional updates to prevent loops
  const progress = useMemo(() => {
    if (totalDuration <= 0) return 0;
    return Math.max(0, Math.min(1, currentPosition / totalDuration));
  }, [currentPosition, totalDuration]);
  
  // Format duration helper
  const formatDuration = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);
  
  // Remaining time calculation
  const remainingTime = useMemo(() => {
    return isPlaying ? Math.max(0, totalDuration - currentPosition) : totalDuration;
  }, [isPlaying, totalDuration, currentPosition]);
  
  // Format timestamp
  const formatTimestamp = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);
  
  // Simplified seek without complex error handling - let Error Boundary handle failures
  const seekToPosition = useCallback((percentage: number) => {
    const targetPosition = percentage * (totalDuration / 1000);
    player.seekTo(targetPosition);
  }, [player, totalDuration]);
  
  // Event-driven playback control
  const handlePlayPause = useCallback(async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      if (isPlaying) {
        player.pause();
        onPlaybackEnd?.();
      } else {
        if (hasFinished) {
          player.seekTo(0);
        }
        player.play();
        onPlaybackStart?.();
      }
    } finally {
      // Always reset loading state
      setIsLoading(false);
    }
  }, [isPlaying, isLoading, hasFinished, player, onPlaybackStart, onPlaybackEnd]);
  
  // Reset to beginning when finished (without auto-play)
  useEffect(() => {
    if (hasFinished) {
      console.log(`[DEBUG] Audio finished for message ${messageId}, seeking to 0 and pausing`);
      // Reset playback position to 0 and ensure it doesn't auto-play
      player.seekTo(0);
      // Explicitly pause to prevent auto-play
      player.pause();
      onPlaybackEnd?.();
    }
  }, [hasFinished, player, onPlaybackEnd, messageId]);
  
  // Simplified pan responder for scrubbing
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    
    onPanResponderGrant: (evt) => {
      const x = evt.nativeEvent.locationX;
      const percentage = Math.max(0, Math.min(1, x / progressTrackWidth));
      seekToPosition(percentage);
    },
    
    onPanResponderMove: (evt) => {
      if (progressTrackWidth <= 0) return;
      const x = evt.nativeEvent.locationX;
      const percentage = Math.max(0, Math.min(1, x / progressTrackWidth));
      seekToPosition(percentage);
    },
    
    onPanResponderRelease: (evt) => {
      const x = evt.nativeEvent.locationX;
      const percentage = Math.max(0, Math.min(1, x / progressTrackWidth));
      seekToPosition(percentage);
    },
    
    onPanResponderTerminate: () => {
      // Handle termination gracefully
    },
  }), [progressTrackWidth, seekToPosition]);
  
  // Status icon
  const StatusIcon = useMemo(() => {
    const iconProps = { size: 10, color: COLORS.white };
    
    switch (status) {
      case 'failed': return <Ionicons name="alert-circle" {...iconProps} />;
      case 'sending': return <Ionicons name="time" {...iconProps} />;
      case 'read': return <Ionicons name="checkmark-done" {...iconProps} />;
      case 'delivered': return <Ionicons name="checkmark" {...iconProps} />;
      default: return <Ionicons name="checkmark" {...iconProps} />;
    }
  }, [status]);
  
  // Bubble styling with compact mode adjustments
  const bubbleStyle = useMemo(() => [
    styles.bubble,
    isCurrentUser ? styles.userBubble : styles.otherBubble,
    isFirst && (isCurrentUser ? styles.userBubbleFirst : styles.otherBubbleFirst),
    isLast && (isCurrentUser ? styles.userBubbleLast : styles.otherBubbleLast),
    compact && styles.compactBubble, // Add compact styling
    { maxWidth },
    isRTL && styles.bubbleRTL,
  ], [isCurrentUser, isFirst, isLast, compact, maxWidth, isRTL]);
  
  return (
    <AudioErrorBoundary onError={() => onError?.('Audio player failed')}>
      <View style={bubbleStyle}>
        {/* Sender avatar for received messages (hidden in compact mode) */}
        {!isCurrentUser && senderAvatar && !compact && (
          <View style={styles.avatarContainer}>
            <Image source={{ uri: senderAvatar }} style={styles.avatar} />
          </View>
        )}
        
        <View style={styles.contentContainer}>
          {/* Voice message content */}
          <View style={styles.voiceContainer}>
            {/* Play/Pause button */}
            <Pressable onPress={handlePlayPause} style={[
              styles.playButton,
              compact && styles.compactPlayButton
            ]}>
              {isLoading ? (
                <Ionicons name="hourglass" size={compact ? 12 : 16} color={COLORS.white} />
              ) : (
                <Ionicons 
                  name={isPlaying ? "pause" : "play"} 
                  size={compact ? 12 : 16} 
                  color={COLORS.white} 
                />
              )}
            </Pressable>
            
            {/* Progress line with scrubbing */}
            <View 
              style={styles.progressContainer}
              onLayout={(event) => {
                const { width } = event.nativeEvent.layout;
                const calculatedWidth = Math.max(0, width - (compact ? 25 : 35) - SPACING.sm);
                setProgressTrackWidth(calculatedWidth);
              }}
            >
              {/* Progress track */}
              <View 
                style={styles.progressTrack}
                {...panResponder.panHandlers}
              >
                {/* Background line */}
                <View style={[
                  styles.progressLine,
                  { 
                    backgroundColor: isCurrentUser 
                      ? 'rgba(255, 255, 255, 0.3)' 
                      : 'rgba(75, 85, 99, 0.3)'
                  }
                ]} />
                
                {/* Progress fill */}
                <View style={[
                  styles.progressFill,
                  {
                    width: `${progress * 100}%`,
                    backgroundColor: isCurrentUser 
                      ? COLORS.white 
                      : COLORS.primary
                  }
                ]} />
                
                {/* Scrub dot */}
                <View style={[
                  styles.scrubDot,
                  {
                    left: Math.max(0, Math.min(progressTrackWidth - 12, progress * progressTrackWidth - 6)),
                    backgroundColor: isCurrentUser 
                      ? COLORS.white 
                      : COLORS.primary
                  }
                ]} />
              </View>
              
              {/* Duration */}
              <Text style={[
                styles.duration,
                compact && styles.compactDuration,
                { color: isCurrentUser ? COLORS.white : COLORS.gray600 }
              ]}>
                {formatDuration(remainingTime)}
              </Text>
            </View>
          </View>
          
          {/* Message footer (hidden in compact mode) */}
          {!compact && (
            <View style={[styles.footer, isRTL && styles.footerRTL]}>
              <Text style={[
                styles.timestamp,
                { color: isCurrentUser ? 'rgba(255, 255, 255, 0.7)' : COLORS.gray500 }
              ]}>
                {formatTimestamp(timestamp)}
              </Text>
              
              {/* Status for sent messages */}
              {isCurrentUser && (
                <View style={styles.statusContainer}>
                  {StatusIcon}
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </AudioErrorBoundary>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: 16,
    padding: SPACING.sm,
    marginVertical: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  } as ViewStyle,

  compactBubble: {
    padding: SPACING.xs,
    marginVertical: 2,
    borderRadius: 12,
  } as ViewStyle,

  userBubble: {
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-end',
  } as ViewStyle,

  otherBubble: {
    backgroundColor: COLORS.gray200,
    alignSelf: 'flex-start',
  } as ViewStyle,

  userBubbleFirst: {
    borderTopRightRadius: 6,
  } as ViewStyle,

  userBubbleLast: {
    borderBottomRightRadius: 6,
  } as ViewStyle,

  otherBubbleFirst: {
    borderTopLeftRadius: 6,
  } as ViewStyle,

  otherBubbleLast: {
    borderBottomLeftRadius: 6,
  } as ViewStyle,

  bubbleRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  avatarContainer: {
    marginRight: SPACING.xs,
  } as ViewStyle,

  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.gray300,
  },

  contentContainer: {
    flex: 1,
  } as ViewStyle,

  voiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,

  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  } as ViewStyle,

  compactPlayButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: SPACING.xs,
  } as ViewStyle,

  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,

  progressTrack: {
    flex: 1,
    height: 32,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  } as ViewStyle,

  progressLine: {
    position: 'absolute',
    width: '100%',
    height: 3,
    borderRadius: 1.5,
  } as ViewStyle,

  progressFill: {
    position: 'absolute',
    left: 0,
    height: 3,
    borderRadius: 1.5,
  } as ViewStyle,

  scrubDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    top: -4.5,
    elevation: 2,
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  } as ViewStyle,

  duration: {
    ...TYPOGRAPHY.caption,
    minWidth: 35,
    textAlign: 'right',
  } as TextStyle,

  compactDuration: {
    fontSize: 10,
    minWidth: 30,
  } as TextStyle,

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  } as ViewStyle,

  footerRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  timestamp: {
    ...TYPOGRAPHY.caption,
  } as TextStyle,

  statusContainer: {
    marginLeft: SPACING.xs,
  } as ViewStyle,

  // Error boundary styles
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: COLORS.gray100,
    borderRadius: 16,
    marginVertical: SPACING.xs,
  } as ViewStyle,

  errorText: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray600,
    marginLeft: SPACING.xs,
    flex: 1,
  } as TextStyle,

  retryButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  } as ViewStyle,

  retryText: {
    ...TYPOGRAPHY.small,
    color: COLORS.white,
    fontWeight: '500',
  } as TextStyle,
});
