// components/chat/RatingBubble.tsx - Rating system bubble component
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Id } from '../../convex/_generated/dataModel';

interface RatingBubbleProps {
  messageId: Id<'messages'>;
  jobId: Id<'jobs'>;
  ratingType: 'customer_rates_worker' | 'worker_rates_customer';
  targetUserId: Id<'users'>;
  targetUserName: string;
  question: string;
  timestamp: number;
  isRTL: boolean;
  isFirst: boolean;
  isLast: boolean;
  onRatingSubmit: (rating: number, review: string, jobId: Id<'jobs'>, targetUserId: Id<'users'>) => Promise<void>;
  delay?: number; // Add delay prop for staggered animation
}

export const RatingBubble: React.FC<RatingBubbleProps> = ({
  messageId,
  jobId,
  ratingType,
  targetUserId,
  targetUserName,
  question,
  timestamp,
  isRTL,
  isFirst,
  isLast,
  onRatingSubmit,
  delay = 0, // Default to no delay
}) => {
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  
  // Reanimated animation for staggered appearance
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }]
  }));

  // Animate in with delay
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    scale.value = withDelay(delay, withTiming(1, { duration: 300 }));
  }, [delay, opacity, scale]);

  const handleRatingSelect = (rating: number) => {
    if (hasSubmitted) return;
    setSelectedRating(rating);
  };

  const handleSubmit = async () => {
    if (selectedRating === 0 || isSubmitting || hasSubmitted) return;

    setIsSubmitting(true);
    try {
      await onRatingSubmit(selectedRating, reviewText, jobId, targetUserId);
      setHasSubmitted(true);
    } catch (error) {
      console.error('Failed to submit rating:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // If rating has been submitted, show confirmation
  if (hasSubmitted) {
    return (
      <Animated.View style={[styles.container, isRTL && styles.containerRTL, animatedStyle]}>
        <View style={[styles.bubble, styles.submittedBubble]}>
          <Text style={styles.submittedText}>
            ✅ Thank you for your rating!
          </Text>
          <Text style={styles.submittedSubtext}>
            Your feedback helps improve our service.
          </Text>
        </View>
        <Text style={[styles.timestamp, isRTL && styles.timestampRTL]}>
          {formatTime(timestamp)}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, isRTL && styles.containerRTL, animatedStyle]}>
      <View style={[styles.bubble, isRTL && styles.bubbleRTL]}>
        <Text style={[styles.question, isRTL && styles.questionRTL]}>
          {question}
        </Text>
        
        {/* Star Rating */}
        <View style={[styles.ratingContainer, isRTL && styles.ratingContainerRTL]}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => handleRatingSelect(star)}
              disabled={isSubmitting}
              style={styles.starButton}
            >
              <Text style={[
                styles.star,
                star <= selectedRating ? styles.starSelected : styles.starUnselected
              ]}>
                ★
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Review Text Input */}
        <TextInput
          style={[styles.reviewInput, isRTL && styles.reviewInputRTL]}
          placeholder="Optional: Add a review..."
          placeholderTextColor="#94a3b8"
          value={reviewText}
          onChangeText={setReviewText}
          multiline
          numberOfLines={3}
          textAlign={isRTL ? 'right' : 'left'}
          editable={!isSubmitting}
        />

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            selectedRating === 0 && styles.submitButtonDisabled,
            isSubmitting && styles.submitButtonSubmitting
          ]}
          onPress={handleSubmit}
          disabled={selectedRating === 0 || isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Submitting...' : 'Submit Rating'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <Text style={[styles.timestamp, isRTL && styles.timestampRTL]}>
        {formatTime(timestamp)}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  containerRTL: {
    alignSelf: 'flex-end',
  },
  bubble: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bubbleRTL: {
    borderTopRightRadius: 4,
  },
  question: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'left',
  },
  questionRTL: {
    textAlign: 'right',
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  ratingContainerRTL: {
    flexDirection: 'row-reverse',
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 28,
  },
  starSelected: {
    color: '#f59e0b',
  },
  starUnselected: {
    color: '#cbd5e1',
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1e293b',
    backgroundColor: '#ffffff',
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  reviewInputRTL: {
    textAlign: 'right',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  submitButtonSubmitting: {
    backgroundColor: '#94a3b8',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'left',
  },
  timestampRTL: {
    textAlign: 'right',
  },
  submittedBubble: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
  },
  submittedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
    textAlign: 'center',
    marginBottom: 4,
  },
  submittedSubtext: {
    fontSize: 14,
    color: '#166534',
    textAlign: 'center',
  },
});
