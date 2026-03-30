import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { useAppTheme } from '@/theme';
import { typography, TypographyVariant } from '@/theme/typography';

interface TypographyProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: string;
}

export function Heading({ style, color, children, ...props }: Omit<TypographyProps, 'variant'> & { variant?: 'largeTitle' | 'title1' | 'title2' | 'title3' }) {
  const t = useAppTheme();
  const variant = props.variant ?? 'title1';

  return (
    <RNText
      style={[typography[variant], { color: color ?? t.textPrimary }, style]}
      {...props}
    >
      {children}
    </RNText>
  );
}

export function Body({ style, variant = 'body', color, children, ...props }: TypographyProps) {
  const t = useAppTheme();

  return (
    <RNText
      style={[typography[variant], { color: color ?? t.textPrimary }, style]}
      {...props}
    >
      {children}
    </RNText>
  );
}

export function Caption({ style, color, children, ...props }: Omit<TypographyProps, 'variant'> & { variant?: 'caption1' | 'caption2' | 'footnote' }) {
  const t = useAppTheme();
  const variant = props.variant ?? 'caption1';

  return (
    <RNText
      style={[typography[variant], { color: color ?? t.textSecondary }, style]}
      {...props}
    >
      {children}
    </RNText>
  );
}
