import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { OptionPickerField } from '@/components/option-picker-field';
import { Spacing, colors, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useCurrency } from '@/hooks/use-currency';
import { CURRENCY_OPTIONS, type CurrencyCode } from '@/lib/currency';
import { supabase } from '@/lib/supabase';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function ProfileScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { currency, setCurrency } = useCurrency();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [savedDisplayName, setSavedDisplayName] = useState('');
  const [savedPhone, setSavedPhone] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      if (!session) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, phone, notifications_enabled, avatar_url')
        .eq('id', session.user.id)
        .maybeSingle();
      if (error) {
        console.error('Failed to fetch profile:', error.message);
        return;
      }
      if (data) {
        setDisplayName(data.display_name ?? '');
        setPhone(data.phone ?? '');
        setSavedDisplayName(data.display_name ?? '');
        setSavedPhone(data.phone ?? '');
        setNotificationsEnabled(data.notifications_enabled);
        setAvatarUrl(data.avatar_url);
      }
    }
    fetchProfile();
  }, [session]);

  function clearStatus() {
    setErrorMessage('');
    setSavedMessage('');
  }

  async function handlePickAvatar() {
    if (!session) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage('Photo library permission is required to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (result.canceled || !result.assets[0]) return;

    clearStatus();
    setIsUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const contentType = asset.mimeType ?? 'image/jpeg';
      const extension = contentType.split('/')[1] ?? 'jpg';
      const path = `${session.user.id}/avatar.${extension}`;

      const arraybuffer = await fetch(asset.uri).then((response) => response.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arraybuffer, { contentType, upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
      // Cache-bust: the path is stable per user, so without this a cached image
      // viewer would keep showing the old photo after a re-upload.
      const bustedUrl = `${publicUrlData.publicUrl}?updated=${Date.now()}`;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: session.user.id, avatar_url: bustedUrl, updated_at: new Date().toISOString() });
      if (profileError) throw profileError;

      setAvatarUrl(bustedUrl);
    } catch (error) {
      setErrorMessage(error instanceof Error ? `Couldn't update photo: ${error.message}` : "Couldn't update photo.");
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleSaveDetails() {
    clearStatus();
    if (!session) {
      setErrorMessage('You need to be logged in to save your profile.');
      return;
    }

    setIsSavingName(true);
    const trimmedName = displayName.trim();
    const trimmedPhone = phone.trim();
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      display_name: trimmedName || null,
      phone: trimmedPhone || null,
      updated_at: new Date().toISOString(),
    });
    setIsSavingName(false);

    if (error) {
      setErrorMessage(`Save failed: ${error.message}`);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSavedMessage('Profile updated.');
    setSavedDisplayName(trimmedName);
    setSavedPhone(trimmedPhone);
    setJustSaved(true);
    setTimeout(() => {
      setJustSaved(false);
      setIsEditingDetails(false);
    }, 1200);
  }

  function handleCancelEditDetails() {
    setDisplayName(savedDisplayName);
    setPhone(savedPhone);
    setIsEditingDetails(false);
    clearStatus();
  }

  async function handleChangeCurrency(value: CurrencyCode) {
    clearStatus();
    const { error } = await setCurrency(value);
    if (error) {
      setErrorMessage(`Couldn't update currency: ${error}`);
    }
  }

  async function handleToggleNotifications(value: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const previous = notificationsEnabled;
    setNotificationsEnabled(value);
    clearStatus();

    if (!session) return;
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, notifications_enabled: value, updated_at: new Date().toISOString() });
    if (error) {
      setNotificationsEnabled(previous);
      setErrorMessage(`Couldn't update notifications: ${error.message}`);
    }
  }

  async function handleLogOut() {
    await supabase.auth.signOut();
    // No navigation call needed — clearing the session flips the root layout's
    // Stack.Protected guard and it swaps us back to the login screen automatically.
  }

  function handleContactSupport() {
    Alert.alert('Coming soon', "In-app support isn't available yet — check back in a future update.");
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and all of your data — transactions, bills, and savings goals. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDeleteAccount },
      ]
    );
  }

  async function confirmDeleteAccount() {
    setIsDeletingAccount(true);
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) {
      setIsDeletingAccount(false);
      setErrorMessage(`Couldn't delete account: ${error.message}`);
      return;
    }
    await supabase.auth.signOut();
    // No navigation call needed — clearing the session flips the root layout's
    // Stack.Protected guard and it swaps us back to the login screen automatically.
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.card}>
          <Avatar
            uri={avatarUrl}
            name={displayName || session?.user.email || ''}
            onPress={isUploadingAvatar ? undefined : handlePickAvatar}
          />
          {isUploadingAvatar ? (
            <Text style={styles.uploadingText}>Uploading…</Text>
          ) : (
            <Text style={styles.avatarHint}>Tap photo to change</Text>
          )}

          {session ? <Text style={styles.email}>{session.user.email}</Text> : null}

          {isEditingDetails ? (
            <>
              <Text style={styles.label}>Display name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={(text) => {
                  setDisplayName(text);
                  clearStatus();
                }}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />

              <Text style={styles.label}>Phone number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  clearStatus();
                }}
                placeholder="Optional"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />

              <View style={styles.editActionsRow}>
                <Pressable style={styles.cancelButton} onPress={handleCancelEditDetails} disabled={isSavingName}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveButton, styles.saveButtonFlex, justSaved && styles.saveButtonSuccess]}
                  onPress={handleSaveDetails}
                  disabled={isSavingName}>
                  {justSaved ? (
                    <View style={styles.saveButtonSuccessContent}>
                      <Feather name="check" size={16} color={colors.background} />
                      <Text style={styles.saveButtonText}>Saved</Text>
                    </View>
                  ) : (
                    <Text style={styles.saveButtonText}>{isSavingName ? 'Saving…' : 'Save changes'}</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Pressable style={styles.detailRow} onPress={() => setIsEditingDetails(true)}>
                <View>
                  <Text style={styles.detailLabel}>Display name</Text>
                  <Text style={styles.detailValue}>{displayName || 'Not set'}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
              <Pressable style={[styles.detailRow, styles.detailRowLast]} onPress={() => setIsEditingDetails(true)}>
                <View>
                  <Text style={styles.detailLabel}>Phone number</Text>
                  <Text style={styles.detailValue}>{phone || 'Not set'}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
            </>
          )}
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        {savedMessage ? <Text style={styles.saved}>{savedMessage}</Text> : null}

        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Currency</Text>
          <OptionPickerField label="Currency" value={currency} options={CURRENCY_OPTIONS} onChange={handleChangeCurrency} />

          <View style={[styles.placeholderRow, styles.placeholderRowLast, styles.notificationsRow]}>
            <Text style={styles.placeholderLabel}>Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: colors.secondaryAccent, true: colors.chartSage }}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Help & Support</Text>
        <View style={styles.card}>
          <Pressable style={[styles.placeholderRow, styles.placeholderRowLast]} onPress={handleContactSupport}>
            <Text style={styles.placeholderLabel}>Contact support</Text>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <View style={[styles.placeholderRow, styles.placeholderRowLast]}>
            <Text style={styles.placeholderLabel}>App version</Text>
            <Text style={styles.placeholderValue}>{APP_VERSION}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <Pressable style={[styles.linkRow, styles.linkRowBordered]} onPress={() => router.push('/change-password')}>
            <Text style={styles.linkRowText}>Change password</Text>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable style={styles.linkRow} onPress={handleDeleteAccount} disabled={isDeletingAccount}>
            <Text style={styles.deleteRowText}>{isDeletingAccount ? 'Deleting account…' : 'Delete account'}</Text>
            <Feather name="chevron-right" size={18} color={colors.secondaryAccent} />
          </Pressable>
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogOut}>
          <Text style={styles.logoutButtonText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  title: {
    color: colors.text,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    marginBottom: Spacing.three,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: typography.sectionLabel.fontSize,
    fontWeight: typography.sectionLabel.fontWeight,
    textTransform: typography.sectionLabel.textTransform,
    letterSpacing: typography.sectionLabel.letterSpacing,
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: Spacing.three,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  uploadingText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: Spacing.one,
    textAlign: 'center',
  },
  avatarHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: Spacing.one,
    textAlign: 'center',
  },
  email: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  label: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    marginBottom: Spacing.one,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: Spacing.three,
    color: colors.text,
    fontSize: typography.body.fontSize,
    marginBottom: Spacing.two,
  },
  error: {
    color: colors.secondaryAccent,
    marginTop: Spacing.three,
  },
  saved: {
    color: colors.chartSage,
    marginTop: Spacing.three,
  },
  saveButton: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 20,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  saveButtonFlex: {
    flex: 1,
  },
  saveButtonSuccess: {
    backgroundColor: colors.chartSage,
  },
  saveButtonSuccessContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  saveButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: typography.body.fontSize,
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  cancelButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: typography.body.fontSize,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.background,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 2,
  },
  detailValue: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.background,
  },
  placeholderRowLast: {
    borderBottomWidth: 0,
  },
  notificationsRow: {
    marginTop: Spacing.three,
  },
  placeholderLabel: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  placeholderValue: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  linkRowBordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.background,
  },
  linkRowText: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  deleteRowText: {
    color: colors.secondaryAccent,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  logoutButtonText: {
    color: colors.secondaryAccent,
    fontWeight: '700',
    fontSize: typography.body.fontSize,
  },
});
