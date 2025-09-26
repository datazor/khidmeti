// components/chat/LoadingBubble.tsx - Animated loading bubble for job processing
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Design System
const COLORS = {
  primary: '#2563eb',
  white: '#ffffff',
  gray100: '#f1f5f9',
  gray500: '#64748b',
  gray700: '#334155',
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
};

const TYPOGRAPHY = {
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
};

const SHADOWS = {
  sm: {
    shadowColor: COLORS.gray700,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
};

interface LoadingBubbleProps {
  message: string;
  timestamp: number;
  isRTL?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

export const LoadingBubble: React.FC<LoadingBubbleProps> = ({
  message,
  timestamp,
  isRTL = false,
  isFirst = true,
  isLast = true,
}) => {
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Dot animation sequence
    const createDotAnimation = (animValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.delay(800),
        ])
      );
    };

    // Pulse animation for the container
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    // Start all animations
    const dotAnimations = Animated.parallel([
      createDotAnimation(dot1Anim, 0),
      createDotAnimation(dot2Anim, 200),
      createDotAnimation(dot3Anim, 400),
    ]);

    dotAnimations.start();
    pulseAnimation.start();

    return () => {
      dotAnimations.stop();
      pulseAnimation.stop();
    };
  }, [dot1Anim, dot2Anim, dot3Anim, pulseAnim]);

  const containerStyle = [
    styles.container,
    isFirst && styles.containerFirst,
    isLast && styles.containerLast,
    isRTL && styles.containerRTL,
  ];

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Animated.View style={[containerStyle, { transform: [{ scale: pulseAnim }] }]}>
      <View style={[styles.content, isRTL && styles.contentRTL]}>
        <View style={[styles.iconContainer, isRTL && styles.iconContainerRTL]}>
          <Ionicons name="search-outline" size={20} color={COLORS.primary} />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[styles.messageText, isRTL && styles.messageTextRTL]}>
            {message}
          </Text>
          
          <View style={[styles.dotsContainer, isRTL && styles.dotsContainerRTL]}>
            <Animated.View 
              style={[
                styles.dot, 
                { 
                  opacity: dot1Anim,
                  transform: [
                    {
                      scale: dot1Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1.2],
                      }),
                    },
                  ],
                }
              ]} 
            />
            <Animated.View 
              style={[
                styles.dot, 
                { 
                  opacity: dot2Anim,
                  transform: [
                    {
                      scale: dot2Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1.2],
                      }),
                    },
                  ],
                }
              ]} 
            />
            <Animated.View 
              style={[
                styles.dot, 
                { 
                  opacity: dot3Anim,
                  transform: [
                    {
                      scale: dot3Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1.2],
                      }),
                    },
                  ],
                }
              ]} 
            />
          </View>
        </View>
      </View>
      
      <Text style={[styles.timestamp, isRTL && styles.timestampRTL]}>
        {formatTime(timestamp)}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.gray100,
    borderRadius: 16,
    padding: SPACING.md,
    marginVertical: SPACING.xs,
    alignSelf: 'flex-start', // Changed from 'center' to align left like other system messages
    minWidth: '70%', // Ensure minimum width for better readability
    maxWidth: '90%', // Increased from 85% to allow more horizontal space
    ...SHADOWS.sm,
  } as ViewStyle,

  containerFirst: {
    borderTopRadius: 8,
  } as ViewStyle,

  containerLast: {
    borderBottomRadius: 8,
  } as ViewStyle,

  containerRTL: {
    alignSelf: 'flex-end', // In RTL, align to the right
  } as ViewStyle,

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  } as ViewStyle,

  contentRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  iconContainer: {
    marginRight: SPACING.sm,
  } as ViewStyle,

  iconContainerRTL: {
    marginRight: 0,
    marginLeft: SPACING.sm,
  } as ViewStyle,

  textContainer: {
    flex: 1,
    alignItems: 'center',
  } as ViewStyle,

  messageText: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray700,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  } as TextStyle,

  messageTextRTL: {
    textAlign: 'center', // Keep center for system messages
  } as TextStyle,

  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  dotsContainerRTL: {
    flexDirection: 'row', // Keep same direction for dots
  } as ViewStyle,

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginHorizontal: 2,
  } as ViewStyle,

  timestamp: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
    textAlign: 'center',
  } as TextStyle,

  timestampRTL: {
    textAlign: 'center', // Keep center for system messages
  } as TextStyle,
});