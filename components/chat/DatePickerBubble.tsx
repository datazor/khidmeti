// components/customer/DatePickerBubble.tsx - Interactive date picker bubble for chat conversations
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
  TextStyle,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Id } from '../../convex/_generated/dataModel';

// Design System - Aligned with QuickReplyButtons
const COLORS = {
  primary: '#3b82f6',
  primaryLight: '#eff6ff',
  primaryDark: '#1e40af',
  success: '#10b981',
  successLight: '#f0fdf4',
  white: '#ffffff',
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

interface DatePickerBubbleProps {
  messageId: Id<'messages'>;
  question: string;
  timestamp: number;
  senderName?: string;
  isRTL?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  minDate?: Date;
  maxDate?: Date;
  onDateSelect: (selectedDate: Date) => void;
}

interface DateOption {
  date: Date;
  label: string;
  isToday: boolean;
  isTomorrow: boolean;
  isWeekend: boolean;
}

// Format time for timestamp display
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Generate quick date options (Today, Tomorrow, This Weekend, etc.)
const generateQuickDateOptions = (minDate: Date, maxDate: Date): DateOption[] => {
  const options: DateOption[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Add Today if it's within range
  if (today >= minDate && today <= maxDate) {
    options.push({
      date: new Date(today),
      label: 'Today',
      isToday: true,
      isTomorrow: false,
      isWeekend: today.getDay() === 0 || today.getDay() === 6,
    });
  }
  
  // Add Tomorrow if it's within range
  if (tomorrow >= minDate && tomorrow <= maxDate) {
    options.push({
      date: new Date(tomorrow),
      label: 'Tomorrow',
      isToday: false,
      isTomorrow: true,
      isWeekend: tomorrow.getDay() === 0 || tomorrow.getDay() === 6,
    });
  }
  
  // Add next few weekdays
  const current = new Date(Math.max(today.getTime(), minDate.getTime()));
  let addedDays = 0;
  
  while (addedDays < 7 && current <= maxDate) {
    if (!options.some(opt => opt.date.getTime() === current.getTime())) {
      const isWeekend = current.getDay() === 0 || current.getDay() === 6;
      
      options.push({
        date: new Date(current),
        label: current.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }),
        isToday: current.getTime() === today.getTime(),
        isTomorrow: current.getTime() === tomorrow.getTime(),
        isWeekend,
      });
    }
    
    current.setDate(current.getDate() + 1);
    addedDays++;
  }
  
  return options.slice(0, 6); // Limit to 6 options for UI
};

export const DatePickerBubble: React.FC<DatePickerBubbleProps> = ({
  messageId,
  question,
  timestamp,
  senderName = 'Shakle Assistant',
  isRTL = false,
  isFirst = true,
  isLast = true,
  minDate = new Date(),
  maxDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
  onDateSelect,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Generate quick date options
  const dateOptions = useMemo(() => {
    return generateQuickDateOptions(minDate, maxDate);
  }, [minDate, maxDate]);
  
  // Handle date selection
  const handleDateSelection = useCallback((date: Date) => {
    setSelectedDate(date);
    onDateSelect(date);
  }, [onDateSelect]);

  const timestampFormatted = formatTime(timestamp);
  
  return (
    <View style={styles.container}>
      <View style={styles.messageWrapper}>
        {/* Sender name */}
        <Text style={[styles.senderName, { textAlign: isRTL ? 'right' : 'left' }]}>
          {senderName}
        </Text>
        
        <View style={styles.dateBubble}>
          {/* Question text */}
          <Text style={[styles.questionText, { textAlign: isRTL ? 'right' : 'left' }]}>
            {question}
          </Text>
          
          {/* Selected date display */}
          {selectedDate && (
            <View style={styles.selectedConfirmation}>
              <Ionicons name="calendar" size={16} color={COLORS.primaryDark} />
              <Text style={styles.confirmationText}>
                Selected: {selectedDate.toLocaleDateString('en', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </Text>
            </View>
          )}
          
          {/* Quick date options */}
          {!selectedDate && (
            <View style={styles.dateOptionsContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateOptionsScroll}
                style={styles.dateOptionsScrollView}
              >
                {dateOptions.map((option, index) => (
                  <Pressable
                    key={index}
                    style={[
                      styles.dateOption,
                      option.isWeekend && styles.weekendOption,
                    ]}
                    onPress={() => handleDateSelection(option.date)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${option.label}`}
                  >
                    <Text style={[
                      styles.dateOptionText,
                      option.isWeekend && styles.weekendOptionText,
                    ]}>
                      {option.label}
                    </Text>
                    
                    {(option.isToday || option.isTomorrow) && (
                      <View style={styles.priorityBadge}>
                        <Text style={styles.priorityBadgeText}>
                          {option.isToday ? '•' : ''}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          
          {/* Change selection option */}
          {selectedDate && (
            <Pressable
              style={styles.changeButton}
              onPress={() => {
                setSelectedDate(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Change date selection"
            >
              <Text style={styles.changeButtonText}>Change date</Text>
            </Pressable>
          )}
          
          {/* Timestamp */}
          <Text style={[styles.timestampText, { textAlign: isRTL ? 'left' : 'right' }]}>
            {timestampFormatted}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.sm,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  } as ViewStyle,

  messageWrapper: {
    width: '100%',
  } as ViewStyle,

  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 2,
    marginLeft: 4,
    fontFamily: 'System',
  } as TextStyle,

  dateBubble: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    minWidth: 260,
    maxWidth: 320,
  } as ViewStyle,

  questionText: {
    fontSize: 14,
    color: COLORS.gray700,
    fontFamily: 'System',
    marginBottom: 16,
    lineHeight: 20,
  } as TextStyle,

  selectedConfirmation: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  } as ViewStyle,

  confirmationText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primaryDark,
    fontFamily: 'System',
  } as TextStyle,

  dateOptionsContainer: {
    marginBottom: 12,
  } as ViewStyle,

  dateOptionsScrollView: {
    flexGrow: 0,
    height: 50,
  } as ViewStyle,

  dateOptionsScroll: {
    paddingHorizontal: 4,
  } as ViewStyle,

  dateOption: {
    backgroundColor: COLORS.gray50,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 75,
    maxWidth: 90,
    position: 'relative',
  } as ViewStyle,

  weekendOption: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  } as ViewStyle,

  dateOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray700,
    textAlign: 'center',
    fontFamily: 'System',
  } as TextStyle,

  weekendOptionText: {
    color: COLORS.primary,
  } as TextStyle,

  priorityBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  priorityBadgeText: {
    fontSize: 8,
    color: COLORS.white,
    fontWeight: '600',
    textAlign: 'center',
  } as TextStyle,

  changeButton: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 8,
  } as ViewStyle,

  changeButtonText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    fontFamily: 'System',
  } as TextStyle,

  timestampText: {
    fontSize: 11,
    color: COLORS.gray400,
    fontFamily: 'System',
    textAlign: 'right',
  } as TextStyle,
});