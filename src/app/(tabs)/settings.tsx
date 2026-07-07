import { TermsOfServiceModal } from '@/components/TermsOfServiceModal';
import { useAuth } from '@/context/AuthContext';
import { AppLocale, ThemePreference, useThemeManager } from '@/hooks/useThemeManager';
import { useI18n } from '@/i18n';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const themeOptions: Array<{ value: ThemePreference; labelKey: 'settings.light' | 'settings.dark' | 'settings.system' }> = [
  { value: 'light', labelKey: 'settings.light' },
  { value: 'dark', labelKey: 'settings.dark' },
  { value: 'system', labelKey: 'settings.system' },
];

const localeOptions: Array<{ value: AppLocale; labelKey: 'settings.korean' | 'settings.english'; meta: string }> = [
  { value: 'ko-KR', labelKey: 'settings.korean', meta: 'KRW' },
  { value: 'en-US', labelKey: 'settings.english', meta: 'USD' },
];

export default function SettingsTab() {
  const { colors, preference, setPreference, mode, locale, setLocale, displayCurrency } = useThemeManager();
  const {
    user,
    logout,
    updateUsername,
    deleteAccount,
    checkUsernameAvailability,
  } = useAuth();
  const { t } = useI18n();
  const [isTermsVisible, setIsTermsVisible] = useState(false);
  const [isEditVisible, setIsEditVisible] = useState(false);
  const [draftUsername, setDraftUsername] = useState(user?.username ?? user?.email ?? '');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setDraftUsername(user?.username ?? user?.email ?? '');
  }, [user?.email, user?.username]);

  async function saveUsername() {
    const nextUsername = draftUsername.trim();

    if (!nextUsername) {
      Alert.alert('Username required', 'Please enter a username.');
      return;
    }

    setIsSavingUsername(true);

    try {
      const available = await checkUsernameAvailability(nextUsername);

      if (!available) {
        Alert.alert('Username unavailable', 'Please choose a different username.');
        return;
      }

      await updateUsername(nextUsername);
      setIsEditVisible(false);
    } catch (error) {
      Alert.alert('Could not save username', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSavingUsername(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account',
      'Your account will be disabled and you will be signed out.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void handleDeleteAccount(),
        },
      ],
    );
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);

    try {
      await deleteAccount();
    } catch (error) {
      Alert.alert('Could not delete account', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Account</Text>
            <Text style={[styles.sectionMeta, { color: colors.textSecondary }]}>
              {user?.email ?? 'Signed out'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setIsEditVisible(true)}
            style={[styles.smallButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.smallButtonText, { color: colors.textPrimary }]}>Edit</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.accountName, { color: colors.textPrimary }]}>
          {user?.username ?? user?.email ?? 'No user'}
        </Text>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('settings.theme')}</Text>
          <Text style={[styles.sectionMeta, { color: colors.textSecondary }]}>
            {mode === 'dark' ? t('settings.darkActive') : t('settings.lightActive')}
          </Text>
        </View>

        <View style={[styles.segmented, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {themeOptions.map((option) => {
            const selected = preference === option.value;

            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => setPreference(option.value)}
                style={[
                  styles.segment,
                  selected && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                <Text style={[styles.segmentText, { color: selected ? colors.onPrimary : colors.textSecondary }]}>
                  {t(option.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('settings.language')}</Text>
          <Text style={[styles.sectionMeta, { color: colors.textSecondary }]}>
            {displayCurrency}
          </Text>
        </View>

        <View style={[styles.segmented, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {localeOptions.map((option) => {
            const selected = locale === option.value;

            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => setLocale(option.value)}
                style={[
                  styles.segment,
                  selected && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                <Text style={[styles.segmentText, { color: selected ? colors.onPrimary : colors.textSecondary }]}>
                  {t(option.labelKey)}
                </Text>
                <Text style={[styles.segmentMeta, { color: selected ? colors.onPrimary : colors.textMuted }]}>
                  {option.meta}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Legal and session</Text>
        <TouchableOpacity
          onPress={() => setIsTermsVisible(true)}
          style={[styles.actionButton, { borderColor: colors.border }]}
        >
          <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>Review Terms of Service</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => void logout()}
          style={[styles.actionButton, { borderColor: colors.border }]}
        >
          <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>Log out</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={isDeleting}
          onPress={confirmDeleteAccount}
          style={[styles.actionButton, styles.dangerButton]}
        >
          {isDeleting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.dangerButtonText}>Delete my account</Text>
          )}
        </TouchableOpacity>
      </View>

      <TermsOfServiceModal
        onClose={() => setIsTermsVisible(false)}
        visible={isTermsVisible}
      />

      <Modal
        animationType="slide"
        onRequestClose={() => setIsEditVisible(false)}
        transparent
        visible={isEditVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit username</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setDraftUsername}
              placeholder="Username"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              value={draftUsername}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setIsEditVisible(false)}
                style={[styles.modalButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={isSavingUsername}
                onPress={() => void saveUsername()}
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                {isSavingUsername ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 16,
  },
  section: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  accountName: {
    fontSize: 24,
    fontWeight: '900',
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  dangerButton: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  dangerButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  input: {
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalButton: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  modalContent: {
    borderRadius: 8,
    gap: 14,
    padding: 18,
    width: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  sectionMeta: {
    fontSize: 12,
    fontWeight: '700',
  },
  segmented: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  segment: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '800',
  },
  segmentMeta: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  smallButton: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  smallButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
