import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { PasswordInput } from '@/components/password-input';
import { Spacing, colors, typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  async function handleLogIn() {
    setErrorMessage('');
    setInfoMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email and password.');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    // No navigation call needed here — once supabase.auth updates the session,
    // the root layout's Stack.Protected guard swaps us into the tabs automatically.
  }

  async function handleForgotPassword() {
    setErrorMessage('');
    setInfoMessage('');

    if (!email.trim()) {
      setErrorMessage('Enter your email above first, then tap "Forgot password?".');
      return;
    }

    setIsSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setIsSendingReset(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setInfoMessage('Check your email for a password reset link.');
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BrandMark />
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to see your money story.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Password</Text>
        <PasswordInput value={password} onChangeText={setPassword} placeholder="••••••••" />

        <Pressable style={styles.forgotLink} onPress={handleForgotPassword} disabled={isSendingReset}>
          <Text style={styles.forgotLinkText}>{isSendingReset ? 'Sending…' : 'Forgot password?'}</Text>
        </Pressable>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        {infoMessage ? <Text style={styles.info}>{infoMessage}</Text> : null}

        <Pressable style={styles.primaryButton} onPress={handleLogIn} disabled={isSaving}>
          <Text style={styles.primaryButtonText}>{isSaving ? 'Logging in…' : 'Log In'}</Text>
        </Pressable>

        <Link href="/signup" style={styles.switchLink}>
          <Text style={styles.switchLinkText}>
            Don&apos;t have an account? <Text style={styles.switchLinkAccent}>Sign up</Text>
          </Text>
        </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
    marginTop: Spacing.one,
    marginBottom: Spacing.four,
  },
  label: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  input: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: Spacing.three,
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: Spacing.two,
  },
  forgotLinkText: {
    color: colors.primaryAccent,
    fontSize: typography.caption.fontSize,
  },
  error: {
    color: colors.secondaryAccent,
    marginTop: Spacing.three,
  },
  info: {
    color: colors.chartSage,
    marginTop: Spacing.three,
  },
  primaryButton: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 20,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  primaryButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: typography.body.fontSize,
  },
  switchLink: {
    marginTop: Spacing.four,
    alignItems: 'center',
  },
  switchLinkText: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
  },
  switchLinkAccent: {
    color: colors.primaryAccent,
    fontWeight: '700',
  },
});
