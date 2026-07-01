import { AppLocale, ThemePreference, useThemeManager } from '@/hooks/useThemeManager';
import { useI18n } from '@/i18n';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  const { t } = useI18n();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
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
                <Text style={[styles.segmentText, { color: selected ? '#ffffff' : colors.textSecondary }]}>
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
                <Text style={[styles.segmentText, { color: selected ? '#ffffff' : colors.textSecondary }]}>
                  {t(option.labelKey)}
                </Text>
                <Text style={[styles.segmentMeta, { color: selected ? '#ffffff' : colors.textMuted }]}>
                  {option.meta}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

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
});
