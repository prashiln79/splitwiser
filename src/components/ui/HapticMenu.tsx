import React from 'react';
import { Menu } from 'react-native-paper';
import { withHapticFeedback } from './hapticUtils';

const HapticMenuItem = withHapticFeedback<any>(Menu.Item as any);

// Menu doesn't need ref forwarding in practice
const HapticMenuBase: React.FC<any> = ({ children, ...props }) => {
  return <Menu {...props}>{children}</Menu>;
};
HapticMenuBase.displayName = 'HapticMenu';

const HapticMenu = HapticMenuBase as typeof HapticMenuBase & {
  Item: typeof HapticMenuItem;
};
HapticMenu.Item = HapticMenuItem;

export default HapticMenu;
