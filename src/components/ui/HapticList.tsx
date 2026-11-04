import React from 'react';
import { List } from 'react-native-paper';
import { withHapticFeedback } from './hapticUtils';

export const HapticListItem = withHapticFeedback<any>(List.Item as any);
export const HapticListAccordion = withHapticFeedback<any>(List.Accordion as any);
