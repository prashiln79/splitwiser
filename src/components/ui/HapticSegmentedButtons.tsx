import React from 'react';
import { SegmentedButtonsProps, SegmentedButtons } from 'react-native-paper';
import { withHapticFeedback } from './hapticUtils';

const HapticSegmentedButtons = withHapticFeedback<SegmentedButtonsProps>(SegmentedButtons as any, {
  pressProp: 'onValueChange',
});
export default HapticSegmentedButtons;
