import { Feather, FontAwesome } from '@expo/vector-icons';
import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextStyle,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme/tokens';

type FeatherName = ComponentProps<typeof Feather>['name'];

export function AppScroll({
  children,
  contentStyle,
  refreshControl,
}: {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ScrollViewProps['refreshControl'];
}) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.keyboardAvoider}
      >
        <ScrollView
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          indicatorStyle="black"
          refreshControl={refreshControl}
          contentContainerStyle={[styles.scrollContent, contentStyle]}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function CenteredScreen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.centered}>
      <View style={styles.centeredInner}>{children}</View>
    </SafeAreaView>
  );
}

export function LoadingScreen() {
  return (
    <SafeAreaView style={styles.loading} edges={['top', 'bottom']}>
      <View style={styles.loadingStack}>
        <LogoMark size={58} />
        <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />
      </View>
    </SafeAreaView>
  );
}

export function LogoMark({ size = 45 }: { size?: number }) {
  const scale = size / 45;
  return (
    <View style={[styles.logo, { width: size, height: size, borderRadius: 13 * scale }]}>
      <View
        style={[
          styles.logoDocumentBack,
          {
            width: 25 * scale,
            height: 30 * scale,
            borderRadius: 6 * scale,
            transform: [{ rotate: '-7deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.logoDocument,
          {
            width: 25 * scale,
            height: 30 * scale,
            borderRadius: 5 * scale,
            padding: 4 * scale,
            transform: [{ rotate: '3deg' }],
          },
        ]}
      >
        <View style={styles.logoRecordRow}>
          <View
            style={[
              styles.logoRecordDot,
              { width: 6 * scale, height: 6 * scale, borderRadius: 3 * scale },
            ]}
          />
          <View
            style={[
              styles.logoLinePrimary,
              { width: 12 * scale, height: 3 * scale, borderRadius: 2 * scale },
            ]}
          />
        </View>
        <View
          style={[
            styles.logoLineMuted,
            { width: 16 * scale, height: 3 * scale, borderRadius: 2 * scale },
          ]}
        />
        <View
          style={[
            styles.logoLineMuted,
            { width: 12 * scale, height: 3 * scale, borderRadius: 2 * scale },
          ]}
        />
      </View>
      <View
        style={[
          styles.logoSignal,
          { width: 19 * scale, height: 19 * scale, borderRadius: 9.5 * scale },
        ]}
      >
        <Feather name="user-plus" size={11 * scale} color={colors.secondary} />
      </View>
    </View>
  );
}

export function BrandLockup({
  logoSize = 45,
  textStyle,
}: {
  logoSize?: number;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={styles.brand}>
      <LogoMark size={logoSize} />
      <Text style={[styles.brandText, textStyle]}>HealthFolio</Text>
    </View>
  );
}

export function Avatar({
  label,
  size = 42,
  color = colors.primary,
}: {
  label: string;
  size?: number;
  color?: string;
}) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: Math.max(10, size * 0.34) }]}>
        {label.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

export function ProfilePill({ name = 'Me', onPress }: { name?: string; onPress?: () => void }) {
  const content = (
    <>
      <Avatar label={name} size={28} />
      <Text style={styles.profilePillText}>{name}</Text>
    </>
  );

  if (!onPress) {
    return <View style={styles.profilePill}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open profile"
      onPress={onPress}
      style={styles.profilePill}
    >
      {content}
    </Pressable>
  );
}

export function TopBar({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.topBar}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrowMuted}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({
  icon,
  title,
  right,
  style,
}: {
  icon: FeatherName;
  title: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.sectionTitleGroup}>
        <View style={styles.sectionIcon}>
          <Feather name={icon} size={16} color={colors.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function HeroCard({
  children,
  tone = 'primary',
  style,
}: {
  children: ReactNode;
  tone?: 'primary' | 'light' | 'dark';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.heroCard,
        tone === 'light' && styles.heroLight,
        tone === 'dark' && styles.heroDark,
        style,
      ]}
    >
      <View style={styles.heroRing} />
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  left,
  style,
  textStyle,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'dark' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  left?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'dark' && styles.buttonDark,
        variant === 'danger' && styles.buttonDanger,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'secondary'
              ? colors.primary
              : variant === 'dark'
                ? colors.textPrimary
                : variant === 'danger'
                  ? colors.danger
                  : '#FFFFFF'
          }
        />
      ) : (
        <>
          {left}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.88}
            style={[
              styles.buttonText,
              variant === 'secondary' && styles.buttonSecondaryText,
              variant === 'dark' && styles.buttonDarkText,
              variant === 'danger' && styles.buttonDangerText,
              textStyle,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  variant = 'primary',
  style,
}: {
  icon: FeatherName;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const iconColor =
    variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.iconButton,
        variant === 'secondary' && styles.iconButtonSecondary,
        variant === 'danger' && styles.iconButtonDanger,
        style,
      ]}
    >
      <Feather name={icon} size={19} color={iconColor} />
    </Pressable>
  );
}

export function Pill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'active' | 'green' | 'amber' | 'red' | 'blue';
}) {
  return (
    <View
      style={[
        styles.pill,
        tone === 'active' && styles.pillActive,
        tone === 'green' && styles.pillGreen,
        tone === 'amber' && styles.pillAmber,
        tone === 'red' && styles.pillRed,
        tone === 'blue' && styles.pillBlue,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          tone === 'active' && styles.pillActiveText,
          tone === 'green' && styles.pillGreenText,
          tone === 'amber' && styles.pillAmberText,
          tone === 'red' && styles.pillRedText,
          tone === 'blue' && styles.pillBlueText,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function SelectablePill({
  label,
  selected,
  onPress,
  tone = 'active',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: 'neutral' | 'active' | 'green' | 'amber' | 'red' | 'blue';
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}>
      <Pill label={label} tone={selected ? tone : 'neutral'} />
    </Pressable>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
  ...props
}: Omit<TextInputProps, 'style'> & {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchField}>
      <View style={styles.searchIconBubble}>
        <Feather name="search" size={17} color={colors.primary} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={styles.searchInput}
        {...props}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
        >
          <View style={styles.searchClear}>
            <Feather name="x" size={14} color={colors.primary} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

export function MetricTile({
  value,
  label,
  tone,
}: {
  value: string | number;
  label: string;
  tone?: 'green' | 'amber' | 'red';
}) {
  return (
    <View style={styles.metricTile}>
      <Text
        style={[
          styles.metricValue,
          tone === 'green' && { color: colors.rangeNormal },
          tone === 'amber' && { color: colors.amber },
          tone === 'red' && { color: colors.danger },
        ]}
      >
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: FeatherName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function ListIcon({ icon }: { icon: FeatherName }) {
  return (
    <View style={styles.listIcon}>
      <Feather name={icon} size={16} color={colors.primary} />
    </View>
  );
}

export function Row({
  left,
  title,
  subtitle,
  right,
  onPress,
}: {
  left?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <>
      {left}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </>
  );
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
        {content}
      </Pressable>
    );
  }
  return <View style={styles.row}>{content}</View>;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, value)) * 100}%` }]} />
    </View>
  );
}

export function DocumentVisual() {
  return (
    <View style={styles.docVisual}>
      <View style={styles.docLineMuted} />
      <View style={styles.docLinePrimary} />
      <View style={styles.docLineMuted} />
      <View style={[styles.docLineMuted, { width: '62%' }]} />
    </View>
  );
}

export function UploadSourceTile({
  code,
  label,
  onPress,
  icon,
}: {
  code: string;
  label: string;
  onPress: () => void;
  icon?: ReactNode;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.uploadTile}>
      <View style={styles.uploadGlyph}>
        {icon ?? <Text style={styles.uploadGlyphText}>{code}</Text>}
      </View>
      <Text style={styles.uploadLabel}>{label}</Text>
    </Pressable>
  );
}

export function AppleMark() {
  return <FontAwesome name="apple" size={18} color={colors.textPrimary} />;
}

export function GoogleMark() {
  return (
    <View style={styles.googleMark}>
      <FontAwesome name="google" size={15} color="#4285F4" />
    </View>
  );
}

export function MiniTrendLine() {
  return (
    <View style={styles.miniChart}>
      <View
        style={[
          styles.chartSegment,
          { left: 12, top: 47, width: 52, transform: [{ rotate: '-6deg' }] },
        ]}
      />
      <View
        style={[
          styles.chartSegment,
          { left: 58, top: 43, width: 50, transform: [{ rotate: '5deg' }] },
        ]}
      />
      <View
        style={[
          styles.chartSegment,
          { left: 103, top: 38, width: 56, transform: [{ rotate: '-16deg' }] },
        ]}
      />
      <View
        style={[
          styles.chartSegment,
          { left: 154, top: 28, width: 54, transform: [{ rotate: '10deg' }] },
        ]}
      />
      <View style={[styles.chartDot, { left: 11, top: 48 }]} />
      <View style={[styles.chartDot, { left: 155, top: 27 }]} />
      <View style={[styles.chartDot, styles.chartDotDark, { left: 205, top: 35 }]} />
    </View>
  );
}

export function FamilyProfilesVisual() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1650,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(550),
      ]),
      { resetBeforeIteration: true },
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const plusScale = progress.interpolate({
    inputRange: [0, 0.42, 1],
    outputRange: [0.9, 1.16, 1],
  });
  const haloScale = progress.interpolate({
    inputRange: [0, 0.68, 1],
    outputRange: [0.55, 1.4, 1.7],
  });
  const haloOpacity = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.32, 0.14, 0],
  });
  const secondTranslateY = progress.interpolate({
    inputRange: [0, 0.62, 1],
    outputRange: [30, -4, 0],
  });
  const secondTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const secondScale = progress.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [0.92, 1.02, 1],
  });
  const secondOpacity = progress.interpolate({
    inputRange: [0, 0.28, 1],
    outputRange: [0, 1, 1],
  });
  const lineScale = progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.18, 1, 1],
  });
  const lineOpacity = progress.interpolate({
    inputRange: [0, 0.32, 1],
    outputRange: [0.12, 0.54, 0.38],
  });

  return (
    <View style={styles.familyVisual}>
      <View style={styles.familyVisualGlow} />
      <View style={styles.familyCard}>
        <View style={styles.familyCardTop}>
          <Avatar label="A" size={30} />
          <View style={styles.familyCardText}>
            <Text style={styles.familyName}>You</Text>
            <Text style={styles.familySub}>Current profile</Text>
          </View>
        </View>
        <View style={styles.familyLines}>
          <View style={styles.familyLinePrimary} />
          <View style={styles.familyLineMuted} />
          <View style={[styles.familyLineMuted, styles.familyLineShort]} />
        </View>
      </View>
      <Animated.View
        style={[styles.addHalo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
      />
      <Animated.View style={[styles.addCircle, { transform: [{ scale: plusScale }] }]}>
        <Feather name="user-plus" size={18} color="#FFFFFF" />
      </Animated.View>
      <Animated.View
        style={[
          styles.motionLine,
          {
            opacity: lineOpacity,
            transform: [{ scaleX: lineScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.familyCard,
          styles.familyCardSecond,
          {
            opacity: secondOpacity,
            transform: [
              { translateX: secondTranslateX },
              { translateY: secondTranslateY },
              { scale: secondScale },
            ],
          },
        ]}
      >
        <View style={styles.familyCardTop}>
          <Avatar label="M" size={30} color={colors.violet} />
          <View style={styles.familyCardText}>
            <Text style={styles.familyName}>Family member</Text>
            <Text style={styles.familySub}>Separate record</Text>
          </View>
        </View>
        <View style={styles.familyLines}>
          <View style={styles.familyLinePrimary} />
          <View style={styles.familyLineMuted} />
          <View style={[styles.familyLineMuted, styles.familyLineShort]} />
        </View>
      </Animated.View>
      <Animated.View style={[styles.familyStatusChip, { opacity: secondOpacity }]}>
        <Feather name="check" size={13} color={colors.secondary} />
        <Text style={styles.familyStatusText}>Profile ready</Text>
      </Animated.View>
    </View>
  );
}

export function OcrProcessingVisual() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(350),
      ]),
      { resetBeforeIteration: true },
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const beamTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 82],
  });
  const badgeScale = progress.interpolate({
    inputRange: [0, 0.48, 1],
    outputRange: [0.94, 1.08, 1],
  });
  const pulseScale = progress.interpolate({
    inputRange: [0, 0.75, 1],
    outputRange: [0.68, 1.45, 1.62],
  });
  const pulseOpacity = progress.interpolate({
    inputRange: [0, 0.52, 1],
    outputRange: [0.3, 0.12, 0],
  });
  const activeDotScale = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.92, 1.12, 1],
  });
  const activeDotOpacity = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.66, 1, 0.78],
  });

  return (
    <View style={styles.ocrCard}>
      <View style={styles.ocrCardGlow} />
      <Text style={styles.ocrTitle}>Reading your report</Text>
      <Text style={styles.ocrCopy}>Your file is on its way.</Text>

      <View style={styles.ocrPreview}>
        <View style={styles.ocrDocument}>
          <View style={styles.ocrDocumentHeader}>
            <View style={styles.ocrDocumentDot} />
            <View style={styles.ocrDocumentLead} />
          </View>
          <View style={styles.ocrDocumentLineLong} />
          <View style={styles.ocrDocumentLineMid} />
          <View style={styles.ocrDocumentLineShort} />
        </View>
        <Animated.View
          style={[styles.ocrPulse, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]}
        />
        <Animated.View
          style={[styles.ocrScanBeam, { transform: [{ translateY: beamTranslateY }] }]}
        />
        <Animated.View style={[styles.ocrBadge, { transform: [{ scale: badgeScale }] }]}>
          <Feather name="file-text" size={15} color={colors.primary} />
        </Animated.View>
      </View>

      <View style={styles.ocrSteps}>
        <View style={styles.ocrStep}>
          <View style={[styles.ocrStepDot, styles.ocrStepDotDone]}>
            <Feather name="check" size={11} color="#FFFFFF" />
          </View>
          <Text style={styles.ocrStepText}>Upload</Text>
        </View>
        <View style={styles.ocrStepLine} />
        <View style={styles.ocrStep}>
          <Animated.View
            style={[
              styles.ocrStepDot,
              styles.ocrStepDotActive,
              { opacity: activeDotOpacity, transform: [{ scale: activeDotScale }] },
            ]}
          >
            <Feather name="activity" size={11} color="#FFFFFF" />
          </Animated.View>
          <Text style={styles.ocrStepText}>Extract</Text>
        </View>
        <View style={styles.ocrStepLine} />
        <View style={styles.ocrStep}>
          <View style={styles.ocrStepDotPending}>
            <Feather name="file-text" size={11} color={colors.textSecondary} />
          </View>
          <Text style={styles.ocrStepTextMuted}>Save</Text>
        </View>
      </View>
    </View>
  );
}

export const typography = StyleSheet.create({
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  h1: {
    color: colors.textPrimary,
    fontSize: 32,
    lineHeight: 38,
    fontFamily: 'AvenirNext-Bold',
    fontWeight: '700',
  },
  h2: {
    color: colors.textPrimary,
    fontSize: 23,
    lineHeight: 29,
    fontFamily: 'AvenirNext-Bold',
    fontWeight: '700',
  },
  h3: {
    color: colors.textPrimary,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
  },
  body: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'AvenirNext-Regular',
  },
  bodySmall: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'AvenirNext-Regular',
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  keyboardAvoider: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl * 3,
  },
  centered: { flex: 1, backgroundColor: colors.background },
  centeredInner: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingStack: { alignItems: 'center', justifyContent: 'center' },
  loadingIndicator: { marginTop: spacing.md },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  brandText: {
    color: colors.textPrimary,
    fontSize: 20,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
  },
  logo: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  logoDocument: {
    zIndex: 1,
    overflow: 'hidden',
    backgroundColor: colors.textPrimary,
    justifyContent: 'center',
    gap: 3,
  },
  logoDocumentBack: {
    position: 'absolute',
    left: 9,
    top: 7,
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoFold: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderBottomColor: colors.softSurface,
  },
  logoRecordRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  logoRecordDot: { backgroundColor: colors.primary },
  logoLinePrimary: { backgroundColor: colors.primary },
  logoLineMuted: { backgroundColor: colors.secondary },
  logoSignal: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontFamily: 'AvenirNext-Medium', fontWeight: '600' },
  profilePill: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 5,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
  },
  profilePillText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  eyebrowMuted: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 42,
    lineHeight: 48,
    fontFamily: 'AvenirNext-Bold',
    fontWeight: '700',
  },
  sectionHeader: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  sectionTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    lineHeight: 25,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.mutedBorder,
    borderRadius: radius.card,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#15232B',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  heroCard: {
    minHeight: 118,
    overflow: 'hidden',
    borderRadius: radius.hero,
    padding: spacing.lg,
    backgroundColor: colors.primaryBg,
    borderWidth: 0,
    marginBottom: 14,
  },
  heroLight: { backgroundColor: colors.surfaceRaised },
  heroDark: { backgroundColor: colors.primaryBg },
  heroRing: {
    position: 'absolute',
    right: -34,
    top: -44,
    width: 142,
    height: 142,
    borderRadius: 71,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    minHeight: 44,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  buttonSecondary: {
    backgroundColor: colors.primaryBg,
    borderWidth: 0,
  },
  buttonDark: {
    backgroundColor: colors.softSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDanger: {
    backgroundColor: colors.redBg,
    borderWidth: 1,
    borderColor: 'rgba(255,92,92,0.32)',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonSecondaryText: { color: colors.primary, fontWeight: '600' },
  buttonDarkText: { color: colors.textPrimary, fontWeight: '600' },
  buttonDangerText: { color: colors.danger, fontWeight: '600' },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  iconButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
  },
  iconButtonDanger: {
    backgroundColor: colors.redBg,
    borderWidth: 1,
    borderColor: 'rgba(255,92,92,0.3)',
    shadowOpacity: 0,
  },
  disabled: { opacity: 0.5 },
  pill: {
    minHeight: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
  },
  pillActive: { backgroundColor: colors.primaryBg, borderColor: '#B9DCFF' },
  pillActiveText: { color: colors.primary },
  pillGreen: { backgroundColor: colors.greenBg, borderColor: '#BDEFD2' },
  pillGreenText: { color: colors.rangeNormal },
  pillAmber: { backgroundColor: colors.amberBg, borderColor: '#F3D89E' },
  pillAmberText: { color: colors.amber },
  pillRed: { backgroundColor: colors.redBg, borderColor: '#F3B6B6' },
  pillRedText: { color: colors.danger },
  pillBlue: { backgroundColor: colors.blueBg, borderColor: '#B9DCFF' },
  pillBlueText: { color: colors.blue },
  metricTile: {
    flex: 1,
    minHeight: 88,
    justifyContent: 'center',
    borderRadius: radius.card,
    borderWidth: 0,
    backgroundColor: colors.surfaceRaised,
    padding: 15,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 34,
    fontFamily: 'AvenirNext-Bold',
    fontWeight: '700',
    lineHeight: 38,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
    marginTop: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'AvenirNext-Regular',
    textAlign: 'center',
    marginTop: 3,
  },
  emptyAction: { alignSelf: 'stretch', marginTop: spacing.sm },
  searchField: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 0,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    marginBottom: 12,
    shadowColor: '#15232B',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
  },
  searchIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
  },
  searchInput: {
    flex: 1,
    minHeight: 54,
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: 'AvenirNext-Regular',
    paddingVertical: 0,
  },
  searchClear: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.mutedBorder,
  },
  listIcon: {
    width: 50,
    height: 50,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '600',
  },
  rowSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'AvenirNext-Regular',
    marginTop: 2,
  },
  progressTrack: {
    height: 7,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.mutedBorder,
    marginTop: 2,
    marginBottom: 18,
  },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  docVisual: {
    position: 'absolute',
    right: 14,
    top: 24,
    width: 74,
    height: 88,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  docLineMuted: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedBorder,
    marginBottom: 10,
  },
  docLinePrimary: {
    width: '68%',
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginBottom: 10,
  },
  uploadTile: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    borderWidth: 0,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  uploadGlyph: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  uploadGlyphText: { color: '#FFFFFF', fontSize: 9, fontWeight: '600' },
  uploadLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  googleMark: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.textPrimary,
  },
  miniChart: {
    height: 88,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.card,
    borderWidth: 0,
    backgroundColor: colors.surfaceInset,
    marginTop: 12,
  },
  chartSegment: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  chartDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  chartDotDark: { backgroundColor: colors.textPrimary },
  familyVisual: {
    minHeight: 222,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.hero,
    backgroundColor: colors.surfaceInset,
    marginBottom: 10,
  },
  familyVisualGlow: {
    position: 'absolute',
    right: -42,
    top: -54,
    width: 172,
    height: 172,
    borderRadius: 86,
    backgroundColor: colors.blueBg,
  },
  familyCard: {
    position: 'absolute',
    left: 16,
    top: 42,
    width: 136,
    minHeight: 112,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    padding: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
  },
  familyCardSecond: { left: undefined, right: 16, top: 72 },
  familyCardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  familyCardText: { flex: 1 },
  familyName: { color: colors.textPrimary, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  familySub: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  familyLines: { gap: 6, marginTop: 13 },
  familyLinePrimary: {
    width: '76%',
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  familyLineMuted: {
    width: '100%',
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedBorder,
  },
  familyLineShort: { width: '58%' },
  motionLine: {
    position: 'absolute',
    left: '38%',
    right: '38%',
    top: 112,
    borderTopWidth: 2,
    borderColor: colors.primary,
  },
  motionDot: {
    position: 'absolute',
    left: 123,
    top: 64,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  addHalo: {
    position: 'absolute',
    left: '50%',
    marginLeft: -34,
    top: 76,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(34,216,131,0.18)',
  },
  addCircle: {
    position: 'absolute',
    left: '50%',
    marginLeft: -21,
    top: 89,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    zIndex: 2,
  },
  addCircleText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', lineHeight: 22 },
  familyStatusChip: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.softSurface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
  },
  familyStatusText: { color: colors.secondary, fontSize: 11, fontWeight: '700' },
  ocrCard: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  ocrCardGlow: {
    position: 'absolute',
    right: -28,
    top: -34,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: colors.blueBg,
  },
  ocrEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  ocrTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  ocrCopy: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  ocrPreview: {
    height: 124,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceInset,
    marginTop: spacing.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocrDocument: {
    width: 136,
    height: 92,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#15232B',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 7 },
  },
  ocrDocumentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  ocrDocumentDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  ocrDocumentLead: {
    width: 52,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  ocrDocumentLineLong: {
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  ocrDocumentLineMid: {
    width: '82%',
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.softSurface,
    marginBottom: 10,
  },
  ocrDocumentLineShort: {
    width: '68%',
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.softSurface,
  },
  ocrPulse: {
    position: 'absolute',
    right: 32,
    top: 30,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryBg,
  },
  ocrScanBeam: {
    position: 'absolute',
    left: 46,
    right: 46,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  ocrBadge: {
    position: 'absolute',
    right: 22,
    bottom: 18,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceInset,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  ocrBadgeText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  ocrSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  ocrStep: { alignItems: 'center', gap: 6 },
  ocrStepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 10,
    backgroundColor: colors.border,
  },
  ocrStepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocrStepDotDone: { backgroundColor: colors.primary },
  ocrStepDotActive: { backgroundColor: colors.primaryDark },
  ocrStepDotPending: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mutedBorder,
  },
  ocrStepText: { color: colors.textPrimary, fontSize: 11, fontWeight: '700' },
  ocrStepTextMuted: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
});
