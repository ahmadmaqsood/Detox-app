import { TextStyle } from 'react-native';

export const typography = {
  largeTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '800',
    letterSpacing: 0.37,
  } as TextStyle,

  title1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: 0.36,
  } as TextStyle,

  title2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: 0.35,
  } as TextStyle,

  title3: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: 0.38,
  } as TextStyle,

  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.41,
  } as TextStyle,

  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: -0.32,
  } as TextStyle,

  bodyMedium: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    letterSpacing: -0.32,
  } as TextStyle,

  callout: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: -0.24,
  } as TextStyle,

  subhead: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '400',
    letterSpacing: -0.15,
  } as TextStyle,

  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: -0.08,
  } as TextStyle,

  caption1: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  } as TextStyle,

  caption2: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '500',
    letterSpacing: 0.06,
  } as TextStyle,
} as const;

export type TypographyVariant = keyof typeof typography;
