import { Text as DefaultText, View as DefaultView } from 'react-native';
import { useAppTheme } from '@/theme';

export type TextProps = DefaultText['props'];
export type ViewProps = DefaultView['props'];

export function Text({ style, ...props }: TextProps) {
  const t = useAppTheme();
  return <DefaultText style={[{ color: t.textPrimary }, style]} {...props} />;
}

export function View({ style, ...props }: ViewProps) {
  const t = useAppTheme();
  return <DefaultView style={[{ backgroundColor: t.background }, style]} {...props} />;
}
