import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AppScroll,
  Button,
  Card,
  IconButton,
  Pill,
  Row,
  SectionHeader,
  TopBar,
} from '../src/components/healthfolio';
import { TextField } from '../src/components/ui';
import { getDocument, listDocuments, listReadings } from '../src/lib/api/endpoints';
import {
  buildRecordsAssistantAnswer,
  type AssistantResult,
} from '../src/lib/assistant/recordsAssistant';
import { useProfileStore } from '../src/lib/profile/profileStore';
import { colors, spacing } from '../src/theme/tokens';

export default function AssistantScreen() {
  const { activeProfileId, activeProfileName } = useProfileStore();
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);

  const { data: documents } = useQuery({
    queryKey: ['assistant-documents', activeProfileId],
    queryFn: () =>
      listDocuments({ limit: 100, ...(activeProfileId ? { profileId: activeProfileId } : {}) }),
  });
  const { data: readings } = useQuery({
    queryKey: ['assistant-readings', activeProfileId],
    queryFn: () =>
      listReadings({ limit: 200, ...(activeProfileId ? { profileId: activeProfileId } : {}) }),
  });

  async function buildAnswer(input: string): Promise<AssistantResult> {
    return buildRecordsAssistantAnswer({
      question: input,
      documents: documents?.items ?? [],
      readings: readings?.items ?? [],
      activeProfileName,
      getDocument: (documentId) => getDocument(documentId).catch(() => null),
    });
  }

  async function ask(input = question): Promise<void> {
    setIsAnswering(true);
    try {
      setResult(await buildAnswer(input));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not answer from records.';
      setResult({
        answer: `I could not query the records right now. ${message}`,
        sources: [],
      });
    } finally {
      setIsAnswering(false);
    }
  }

  return (
    <AppScroll>
      <TopBar
        title="Assistant"
        action={
          <IconButton
            icon="arrow-left"
            label="Back"
            variant="secondary"
            onPress={() => router.back()}
          />
        }
      />

      <Card style={styles.disclaimerCard}>
        <SectionHeader icon="shield" title="Records first" style={styles.cardHeader} />
        <Text style={styles.disclaimer}>
          HealthFolio summarizes uploaded records and OCR readings. It can help frame follow-up
          questions, but it does not diagnose or choose medication or dosage.
        </Text>
      </Card>

      <Card>
        <TextField
          label="Ask"
          value={question}
          onChangeText={setQuestion}
          placeholder="What was low in my latest CBC?"
          multiline
        />
        <Button
          label="Ask HealthFolio"
          onPress={() => void ask()}
          loading={isAnswering}
          disabled={!question.trim()}
        />
      </Card>

      <Card>
        <SectionHeader
          icon="message-circle"
          title="Answer"
          right={<Pill label="Records view" tone="blue" />}
          style={styles.cardHeader}
        />
        <Text style={styles.answer}>
          {result?.answer ?? 'Ask a question about documents, trends, or review items.'}
        </Text>
        {result?.sources.length ? (
          <View style={styles.sources}>
            <Text style={styles.sourcesTitle}>Sources</Text>
            {result.sources.map((source) => (
              <Row
                key={source.id}
                title={source.title}
                subtitle={source.subtitle}
                right={<Feather name="file-text" size={18} color={colors.primary} />}
                onPress={() => router.push(`/documents/${source.id}`)}
              />
            ))}
          </View>
        ) : null}
      </Card>

      <Card>
        <SectionHeader icon="zap" title="Quick asks" style={styles.cardHeader} />
        {['Latest sent report', 'What was low?', 'Latest hemoglobin', 'Summarize documents'].map(
          (prompt) => (
            <Row
              key={prompt}
              title={prompt}
              right={<Feather name="chevron-right" size={18} color={colors.textMuted} />}
              onPress={() => {
                setQuestion(prompt);
                void ask(prompt);
              }}
            />
          ),
        )}
      </Card>
    </AppScroll>
  );
}

const styles = StyleSheet.create({
  disclaimerCard: { backgroundColor: colors.primaryBg },
  cardHeader: { marginTop: 0 },
  disclaimer: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  answer: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  sources: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  sourcesTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
});
