import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemePreference, useThemeManager } from '@/hooks/useThemeManager';

const options: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: '☀️ Light' },
  { value: 'dark', label: '🌙 Dark' },
  { value: 'system', label: '💻 System' },
];

export function ThemeSettingsToggle() {
  const { colors, preference, setPreference, mode } = useThemeManager();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Theme</Text>
        <Text style={[styles.status, { color: colors.textSecondary }]}>
          {mode === 'dark' ? 'Dark active' : 'Light active'}
        </Text>
      </View>

      <View
        style={[
          styles.segmentedControl,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
      >
        {options.map((option) => {
          const selected = option.value === preference;

          return (
            <Pressable
              key={option.value}
              onPress={() => setPreference(option.value)}
              style={[
                styles.segment,
                selected && {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: selected ? '#ffffff' : colors.textSecondary },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
  },
  segmentedControl: {
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
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
