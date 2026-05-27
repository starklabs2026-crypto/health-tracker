import { Feather, FontAwesome } from '@expo/vector-icons';
import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextStyle,
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
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        contentContainerStyle={[styles.scrollContent, contentStyle]}
      >
        {children}
      </ScrollView>
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
          <View style={[styles.logoLinePrimary, { width: 12 * scale, height: 3 * scale, borderRadius: 2 * scale }]} />
        </View>
        <View style={[styles.logoLineMuted, { width: 16 * scale, height: 3 * scale, borderRadius: 2 * scale }]} />
        <View style={[styles.logoLineMuted, { width: 12 * scale, height: 3 * scale, borderRadius: 2 * scale }]} />
      </View>
      <View style={[styles.logoSignal, { width: 19 * scale, height: 19 * scale, borderRadius: 9.5 * scale }]}>
        <Feather name="user-plus" size={11 * scale} color={colors.primary} />
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
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.avatarText, { fontSize: Math.max(10, size * 0.34) }]}>{label.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export function ProfilePill({ name = 'Me' }: { name?: string }) {
  return (
    <View style={styles.profilePill}>
      <Avatar label={name} size={28} />
      <Text style={styles.profilePillText}>{name}</Text>
    </View>
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

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function HeroCard({
  children,
  tone = 'primary',
  style,
}: {
  children: ReactNode;
  tone?: 'primary' | 'light' | 'dark';
  style?: ViewStyle;
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
  style?: ViewStyle;
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
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : '#FFFFFF'} />
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

export function Row({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <>
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
  return <FontAwesome name="apple" size={18} color="#FFFFFF" />;
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
      <View style={[styles.chartSegment, { left: 12, top: 47, width: 52, transform: [{ rotate: '-6deg' }] }]} />
      <View style={[styles.chartSegment, { left: 58, top: 43, width: 50, transform: [{ rotate: '5deg' }] }]} />
      <View style={[styles.chartSegment, { left: 103, top: 38, width: 56, transform: [{ rotate: '-16deg' }] }]} />
      <View style={[styles.chartSegment, { left: 154, top: 28, width: 54, transform: [{ rotate: '10deg' }] }]} />
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
      <Animated.View style={[styles.addHalo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />
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
          <Avatar label="M" size={30} color={colors.navy} />
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
        <Feather name="check" size={13} color={colors.primaryDark} />
        <Text style={styles.familyStatusText}>Profile ready</Text>
      </Animated.View>
    </View>
  );
}

export const typography = StyleSheet.create({
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  h1: { color: colors.textPrimary, fontSize: 24, lineHeight: 29, fontWeight: '800' },
  h2: { color: colors.textPrimary, fontSize: 20, lineHeight: 25, fontWeight: '800' },
  h3: { color: colors.textPrimary, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  bodySmall: { color: colors.textSecondary, fontSize: 11, lineHeight: 15 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xl * 2 },
  centered: { flex: 1, backgroundColor: colors.background },
  centeredInner: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingStack: { alignItems: 'center', justifyContent: 'center' },
  loadingIndicator: { marginTop: spacing.md },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  brandText: { color: colors.textPrimary, fontSize: 21, fontWeight: '800' },
  logo: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
  },
  logoDocument: {
    zIndex: 1,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    gap: 3,
  },
  logoDocumentBack: {
    position: 'absolute',
    left: 9,
    top: 7,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
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
  logoLineMuted: { backgroundColor: '#B9D8D3' },
  logoSignal: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,118,110,0.18)',
  },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '800' },
  profilePill: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 4,
    paddingRight: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  profilePillText: { color: colors.textPrimary, fontSize: 12, fontWeight: '800' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  eyebrowMuted: { color: colors.textSecondary, fontSize: 12, lineHeight: 15 },
  title: { color: colors.textPrimary, fontSize: 24, lineHeight: 29, fontWeight: '800' },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 13,
    marginBottom: 10,
  },
  heroCard: {
    minHeight: 96,
    overflow: 'hidden',
    borderRadius: radius.hero,
    padding: spacing.md,
    backgroundColor: colors.primary,
    marginBottom: 10,
  },
  heroLight: { backgroundColor: colors.softSurface, borderWidth: 1, borderColor: 'rgba(15,118,110,0.24)' },
  heroDark: { backgroundColor: colors.navy },
  heroRing: {
    position: 'absolute',
    right: -34,
    top: -44,
    width: 142,
    height: 142,
    borderRadius: 71,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  button: {
    minHeight: 42,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  buttonDark: { backgroundColor: colors.textPrimary },
  buttonDanger: { backgroundColor: colors.redBg, borderWidth: 1, borderColor: '#F0B8B3' },
  buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  buttonSecondaryText: { color: colors.primary, fontWeight: '800' },
  buttonDangerText: { color: colors.danger, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pill: {
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 9,
  },
  pillText: { color: colors.textSecondary, fontSize: 10, fontWeight: '800' },
  pillActive: { backgroundColor: colors.softSurface, borderColor: 'rgba(15,118,110,0.28)' },
  pillActiveText: { color: colors.primaryDark },
  pillGreen: { backgroundColor: colors.greenBg, borderColor: '#BDEBD2' },
  pillGreenText: { color: '#087344' },
  pillAmber: { backgroundColor: colors.amberBg, borderColor: '#EFD17E' },
  pillAmberText: { color: '#744A09' },
  pillRed: { backgroundColor: colors.redBg, borderColor: '#F0B8B3' },
  pillRedText: { color: '#9A251D' },
  pillBlue: { backgroundColor: colors.blueBg, borderColor: '#C6D9FF' },
  pillBlueText: { color: '#1D4ED8' },
  metricTile: {
    flex: 1,
    minHeight: 64,
    justifyContent: 'center',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10,
  },
  metricValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', lineHeight: 22 },
  metricLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '800', marginTop: 5 },
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
    backgroundColor: colors.softSurface,
    marginBottom: spacing.sm,
  },
  emptyTitle: { color: colors.textPrimary, fontSize: 14, lineHeight: 19, fontWeight: '800', textAlign: 'center' },
  emptyBody: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 3 },
  emptyAction: { alignSelf: 'stretch', marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
  rowSubtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 16, marginTop: 2 },
  progressTrack: { height: 6, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.border, marginTop: 2, marginBottom: 18 },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  docVisual: {
    position: 'absolute',
    right: 14,
    top: 24,
    width: 74,
    height: 88,
    borderRadius: 10,
    backgroundColor: colors.surface,
    padding: 12,
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  docLineMuted: { height: 6, borderRadius: radius.pill, backgroundColor: colors.border, marginBottom: 10 },
  docLinePrimary: { width: '68%', height: 6, borderRadius: radius.pill, backgroundColor: colors.primary, marginBottom: 10 },
  uploadTile: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  uploadGlyph: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  uploadGlyphText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  uploadLabel: { color: colors.textPrimary, fontSize: 11, fontWeight: '800' },
  googleMark: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  miniChart: {
    height: 88,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginTop: 12,
  },
  chartSegment: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: colors.primary },
  chartDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  chartDotDark: { backgroundColor: colors.navy },
  familyVisual: {
    minHeight: 222,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15,118,110,0.18)',
    borderRadius: radius.hero,
    backgroundColor: colors.softSurface,
    marginBottom: 10,
  },
  familyVisualGlow: {
    position: 'absolute',
    right: -42,
    top: -54,
    width: 172,
    height: 172,
    borderRadius: 86,
    backgroundColor: 'rgba(255,255,255,0.46)',
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
    backgroundColor: colors.surface,
    padding: 12,
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
  },
  familyCardSecond: { left: undefined, right: 16, top: 72 },
  familyCardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  familyCardText: { flex: 1 },
  familyName: { color: colors.textPrimary, fontSize: 12, lineHeight: 16, fontWeight: '800' },
  familySub: { color: colors.textSecondary, fontSize: 10, lineHeight: 13, fontWeight: '700', marginTop: 1 },
  familyLines: { gap: 6, marginTop: 13 },
  familyLinePrimary: { width: '76%', height: 5, borderRadius: radius.pill, backgroundColor: colors.primary },
  familyLineMuted: { width: '100%', height: 5, borderRadius: radius.pill, backgroundColor: colors.mutedBorder },
  familyLineShort: { width: '58%' },
  motionLine: {
    position: 'absolute',
    left: '38%',
    right: '38%',
    top: 112,
    borderTopWidth: 2,
    borderColor: 'rgba(15,118,110,0.34)',
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
    backgroundColor: 'rgba(15,118,110,0.18)',
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
  addCircleText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', lineHeight: 22 },
  familyStatusChip: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(15,118,110,0.16)',
    paddingHorizontal: 10,
  },
  familyStatusText: { color: colors.primaryDark, fontSize: 11, fontWeight: '800' },
});
