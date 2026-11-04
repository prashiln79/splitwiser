import React from 'react';
import { CheckboxItemProps, Checkbox } from 'react-native-paper';
import { withHapticFeedback } from './hapticUtils';

const HapticCheckboxItem = withHapticFeedback<any>(Checkbox.Item as any);
export default HapticCheckboxItem;
