import React from 'react';
import { IconButtonProps, IconButton } from 'react-native-paper';
import { withHapticFeedback } from './hapticUtils';

const HapticIconButton = withHapticFeedback<IconButtonProps>(IconButton as any);
export default HapticIconButton;
