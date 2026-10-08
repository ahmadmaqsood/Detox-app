import { Body, Heading } from '@/components/Typography';
import { useAppTheme } from '@/theme';
import { spacing } from '@/theme/spacing';
import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function NotFoundScreen() {
  const t = useAppTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={[styles.container, { backgroundColor: t.background }]}>
        <Heading variant="title2">This is the screen doesn't exist.</Heading>
        <Link href="/" style={styles.link}>
          <Body color={t.accent}>Go to home screen</Body>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  link: {
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
  },
});
