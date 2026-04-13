import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import { signUpWithEmail } from "@/lib/firebase";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";

function mapAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code;
  switch (code) {
    case "auth/invalid-email":
      return "That email doesn’t look valid.";
    case "auth/email-already-in-use":
      return "An account already exists for this email. Sign in instead.";
    case "auth/weak-password":
      return "Choose a stronger password (at least 6 characters).";
    case "auth/operation-not-allowed":
      return "Email/password sign-in isn’t enabled in Firebase Console.";
    default:
      return "Couldn’t create account. Try again.";
  }
}

export default function SignupScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter email and password.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don’t match.");
      return;
    }
    if (password.length < 6) {
      setError("Password should be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await signUpWithEmail(email, password);
      router.replace("/(drawer)/(tabs)/today");
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      setBusy(false);
    }
  }, [email, password, confirm, router]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <PlatformSymbol ios="chevron.left" material="arrow-back" tintColor={t.textPrimary} size={22} />
        </Pressable>

        <Heading variant="title1" style={styles.title}>
          Create account
        </Heading>
        <Body variant="body" color={t.textSecondary} style={styles.sub}>
          Your habits and progress are stored under this account.
        </Body>

        <Card style={[styles.card, { backgroundColor: t.card }]}>
          <Caption variant="caption2" color={t.textMuted} style={styles.label}>
            Email
          </Caption>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={t.textMuted}
            style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
          />
          <Caption variant="caption2" color={t.textMuted} style={[styles.label, styles.labelSp]}>
            Password
          </Caption>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="At least 6 characters"
            placeholderTextColor={t.textMuted}
            style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
          />
          <Caption variant="caption2" color={t.textMuted} style={[styles.label, styles.labelSp]}>
            Confirm password
          </Caption>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            placeholder="Repeat password"
            placeholderTextColor={t.textMuted}
            style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
          />
          {error ? (
            <Caption variant="caption1" style={{ color: t.warning, marginTop: spacing.sm }}>
              {error}
            </Caption>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={busy}
            style={[styles.primaryBtn, { backgroundColor: t.accent, opacity: busy ? 0.7 : 1 }]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Body variant="bodyMedium" style={{ color: "#fff", fontWeight: "700" }}>
                Sign up
              </Body>
            )}
          </Pressable>

          <Link href="/(auth)/login" asChild>
            <Pressable style={styles.linkRow}>
              <Caption variant="caption1" color={t.accent}>
                Already have an account? Sign in
              </Caption>
            </Pressable>
          </Link>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  back: {
    alignSelf: "flex-start",
    marginBottom: spacing.sm,
  },
  title: {
    marginTop: spacing.sm,
  },
  sub: {
    marginBottom: spacing.lg,
  },
  card: {
    padding: spacing.xl,
    borderRadius: radius.xl,
    gap: spacing.xs,
  },
  label: {
    fontWeight: "600",
  },
  labelSp: {
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === "ios" ? spacing.md : spacing.sm,
    marginTop: spacing.xs,
    fontSize: 16,
  },
  primaryBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  linkRow: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
});
