import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useSegments } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDocument, listDocuments, listReadings } from '../lib/api/endpoints';
import { buildRecordsAssistantAnswer } from '../lib/assistant/recordsAssistant';
import { useAuthStore } from '../lib/auth/authStore';
import { useProfileStore } from '../lib/profile/profileStore';
import { colors, spacing } from '../theme/tokens';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sourceIds?: string[];
};

export function FloatingAssistant() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const unlocked = useAuthStore((state) => state.unlocked);
  const { activeProfileId, activeProfileName } = useProfileStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask about your uploaded docs, sent reports, or extracted readings.',
    },
  ]);
  const [isAnswering, setIsAnswering] = useState(false);
  const segmentNames = segments.map(String);

  const hiddenRoute =
    !unlocked ||
    segmentNames.includes('(auth)') ||
    segmentNames.includes('lock') ||
    segmentNames.includes('assistant');

  const { data: documents } = useQuery({
    queryKey: ['floating-assistant-documents', activeProfileId],
    queryFn: () =>
      listDocuments({ limit: 80, ...(activeProfileId ? { profileId: activeProfileId } : {}) }),
    enabled: unlocked,
  });
  const { data: readings } = useQuery({
    queryKey: ['floating-assistant-readings', activeProfileId],
    queryFn: () =>
      listReadings({ limit: 200, ...(activeProfileId ? { profileId: activeProfileId } : {}) }),
    enabled: unlocked,
  });

  if (hiddenRoute) return null;

  async function answerQuestion(question: string): Promise<ChatMessage> {
    const result = await buildRecordsAssistantAnswer({
      question,
      documents: documents?.items ?? [],
      readings: readings?.items ?? [],
      activeProfileName,
      getDocument: (id) => getDocument(id).catch(() => null),
    });
    return {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text: result.answer,
      sourceIds: result.sources.map((source) => source.id),
    };
  }

  async function send(): Promise<void> {
    const question = input.trim();
    if (!question || isAnswering) return;
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', text: question };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setIsAnswering(true);
    try {
      const reply = await answerQuestion(question);
      setMessages((current) => [...current, reply]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not query records.';
      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: 'assistant', text: message },
      ]);
    } finally {
      setIsAnswering(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open HealthFolio assistant"
        onPress={() => setOpen(true)}
        style={[styles.floatingButton, { bottom: Math.max(insets.bottom + 96, 112) }]}
      >
        <Feather name="message-circle" size={24} color="#FFFFFF" />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
          style={[
            styles.panel,
            {
              paddingTop: Math.max(insets.top + 10, 24),
              paddingBottom: Math.max(insets.bottom + spacing.md, spacing.md),
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>Records assistant</Text>
              <Text style={styles.title}>HealthFolio AI</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              style={styles.close}
            >
              <Feather name="x" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            style={styles.messageScroll}
            contentContainerStyle={styles.messages}
          >
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.bubble,
                  message.role === 'user' ? styles.userBubble : styles.aiBubble,
                ]}
              >
                <Text style={[styles.messageText, message.role === 'user' && styles.userText]}>
                  {message.text}
                </Text>
                {message.sourceIds?.length ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      const sourceId = message.sourceIds?.[0];
                      if (!sourceId) return;
                      setOpen(false);
                      router.push(`/documents/${sourceId}`);
                    }}
                  >
                    <Text style={styles.sourceLink}>Open source</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            {isAnswering ? <Text style={styles.typing}>Checking records...</Text> : null}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask about docs"
              placeholderTextColor={colors.textMuted}
              returnKeyType="send"
              style={styles.input}
              multiline
            />
            <Pressable accessibilityRole="button" onPress={() => void send()} style={styles.send}>
              <Feather name="arrow-up" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setOpen(false);
              router.push('/assistant');
            }}
            style={styles.fullAssistant}
          >
            <Text style={styles.fullAssistantText}>Open full assistant</Text>
            <Feather name="chevron-right" size={17} color={colors.primary} />
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    right: 18,
    zIndex: 50,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  panel: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerText: { flex: 1, paddingRight: spacing.md },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 34,
    lineHeight: 39,
    fontFamily: 'AvenirNext-Bold',
    fontWeight: '700',
  },
  close: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageScroll: { flex: 1 },
  messages: { flexGrow: 1, gap: spacing.sm, paddingBottom: spacing.md },
  bubble: {
    maxWidth: '92%',
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.mutedBorder,
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  messageText: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'AvenirNext-Regular',
  },
  userText: { color: '#FFFFFF', fontFamily: 'AvenirNext-Medium', fontWeight: '600' },
  sourceLink: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '700',
    marginTop: 8,
  },
  typing: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    backgroundColor: colors.surfaceRaised,
    padding: 7,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: 'AvenirNext-Regular',
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  fullAssistant: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  fullAssistantText: {
    color: colors.primary,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'AvenirNext-Medium',
    fontWeight: '700',
  },
});
