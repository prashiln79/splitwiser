import React from 'react';
import { FABProps, FAB } from 'react-native-paper';
import { withHapticFeedback } from './hapticUtils';

const HapticFAB = withHapticFeedback<FABProps>(FAB as any);
export default HapticFAB;
