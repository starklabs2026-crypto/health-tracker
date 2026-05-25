import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { colors, radius, spacing, tapTarget } from '../theme/tokens';

export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const bg =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.surface;
  const fg = variant === 'secondary' ? colors.primary : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: bg, opacity: disabled || loading ? 0.5 : 1 },
        variant === 'secondary' ? styles.buttonOutline : null,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function TextField({
  label,
  errorText,
  ...props
}: TextInputProps & { label?: string; errorText?: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, errorText ? { borderColor: colors.danger } : null]}
        {...props}
      />
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: ReadonlyArray<{ label: string; value: T }>;
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.segmentRow}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(opt.value)}
              style={[styles.segment, active ? styles.segmentActive : null]}
            >
              <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: colors.primary, marginBottom: spacing.xs },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginBottom: spacing.xl },
  label: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    minHeight: tapTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  errorText: { color: colors.danger, fontSize: 13, marginTop: spacing.xs },
  button: {
    minHeight: tapTarget,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  buttonOutline: { borderWidth: 1, borderColor: colors.primary },
  buttonText: { fontSize: 16, fontWeight: '600' },
  segmentRow: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    minHeight: tapTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  segmentActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  segmentText: { fontSize: 15, color: colors.textPrimary },
  segmentTextActive: { color: '#FFFFFF', fontWeight: '600' },
});
