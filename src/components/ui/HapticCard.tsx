import React from 'react';
import { Card } from 'react-native-paper';
import { withHapticFeedback } from './hapticUtils';

const HapticCardBase = withHapticFeedback<any>(Card as any);

// Re-attach Card sub-components
const HapticCard = HapticCardBase as typeof HapticCardBase & {
  Title: typeof Card.Title;
  Content: typeof Card.Content;
  Actions: typeof Card.Actions;
  Cover: typeof Card.Cover;
};

HapticCard.Title = Card.Title;
HapticCard.Content = Card.Content;
HapticCard.Actions = Card.Actions;
HapticCard.Cover = Card.Cover;

export default HapticCard;
