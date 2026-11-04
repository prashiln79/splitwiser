import React, { forwardRef, useCallback, ComponentType, Ref } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

type WithHapticOptions = {
  pressProp?: string;
  onlyWhenHandler?: boolean;
};

// Only trigger haptics on native platforms — expo-haptics is unavailable on web
const triggerHaptic = () => {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
};

export function withHapticFeedback<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithHapticOptions = {}
): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<unknown>> {
  const { pressProp = 'onPress', onlyWhenHandler = false } = options;

  const WithHaptic = forwardRef((props: any, ref: Ref<unknown>) => {
    const originalHandler = props[pressProp];

    const handlePress = useCallback(
      (...args: any[]) => {
        if (!onlyWhenHandler || originalHandler) {
          triggerHaptic();
        }
        if (originalHandler) {
          originalHandler(...args);
        }
      },
      [originalHandler]
    );

    const handlerProps: Record<string, any> = {};
    if (onlyWhenHandler && !originalHandler) {
      handlerProps[pressProp] = undefined;
    } else {
      handlerProps[pressProp] = handlePress;
    }

    return <WrappedComponent ref={ref as any} {...(props as P)} {...handlerProps} />;
  });

  const displayName =
    (WrappedComponent as any).displayName ||
    (WrappedComponent as any).name ||
    'Component';
  WithHaptic.displayName = `WithHaptic(${displayName})`;

  return WithHaptic as any;
}

export async function triggerPullRefreshHaptic(): Promise<void> {
  if (Platform.OS !== 'web') {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}
