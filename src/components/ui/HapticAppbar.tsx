import React from 'react';
import { Appbar } from 'react-native-paper';
import { withHapticFeedback } from './hapticUtils';

export const HapticAppbarAction = withHapticFeedback<any>(Appbar.Action as any);
export const HapticAppbarBackAction = withHapticFeedback<any>(Appbar.BackAction as any);
