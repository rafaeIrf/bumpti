import type { StyleProp, ViewStyle } from 'react-native';

export type OnValueChangeEventPayload = {
  minValue: number;
  maxValue: number;
};

export type RangeSliderModuleEvents = {
  onValueChange: (params: OnValueChangeEventPayload) => void;
  onSlidingComplete: (params: OnValueChangeEventPayload) => void;
};

export type RangeSliderViewProps = {
  minValue?: number;
  maxValue?: number;
  lowerValue?: number;
  upperValue?: number;
  accentColor?: string;
  onValueChange?: (event: { nativeEvent: OnValueChangeEventPayload }) => void;
  onSlidingComplete?: (event: { nativeEvent: OnValueChangeEventPayload }) => void;
  style?: StyleProp<ViewStyle>;
};
