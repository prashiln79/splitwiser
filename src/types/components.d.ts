// Type declarations for the existing JavaScript UI components.
// These tell TypeScript to treat them as valid React components
// without requiring full migration to TypeScript.

declare module '*/components/ui/HapticButton' {
  import { ButtonProps } from 'react-native-paper';
  import React from 'react';
  const HapticButton: React.FC<ButtonProps & { [key: string]: any }>;
  export default HapticButton;
}

declare module '*/components/ui/HapticCard' {
  import { CardProps } from 'react-native-paper';
  import React from 'react';
  const HapticCard: React.FC<CardProps & { [key: string]: any }> & {
    Title: React.FC<any>;
    Content: React.FC<any>;
    Actions: React.FC<any>;
  };
  export default HapticCard;
}

declare module '*/components/ui/HapticAppbar' {
  import React from 'react';
  export const HapticAppbarAction: React.FC<any>;
  export const HapticAppbarBackAction: React.FC<any>;
}

declare module '*/components/ui/HapticFAB' {
  import React from 'react';
  const HapticFAB: React.FC<any>;
  export default HapticFAB;
}

declare module '*/components/ui/HapticIconButton' {
  import React from 'react';
  const HapticIconButton: React.FC<any>;
  export default HapticIconButton;
}

declare module '*/components/ui/HapticCheckbox' {
  import React from 'react';
  const HapticCheckboxItem: React.FC<any>;
  export default HapticCheckboxItem;
}

declare module '*/components/ui/HapticMenu' {
  import React from 'react';
  const HapticMenu: React.FC<any> & {
    Item: React.FC<any>;
  };
  export default HapticMenu;
}

declare module '*/components/ui/HapticSegmentedButtons' {
  import React from 'react';
  const HapticSegmentedButtons: React.FC<any>;
  export default HapticSegmentedButtons;
}

declare module '*/components/ui/HapticList' {
  import React from 'react';
  export const HapticListItem: React.FC<any>;
  export const HapticListAccordion: React.FC<any>;
}

declare module '*/components/ui/hapticUtils' {
  export function triggerPullRefreshHaptic(): Promise<void>;
}
