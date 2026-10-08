import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

import { Spacing, colors, typography } from '@/constants/theme';
import { getGreeting } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
};

const SUGGESTED_PROMPTS = ['Why am I spending more?', 'How can I reach my goal faster?', 'Any bills coming up?'];

export default function AiCoachScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  async function requestReply(userText: string, history: { role: 'user' | 'assistant'; content: string }[]) {
    setIsSending(true);
    const { data, error } = await supabase.functions.invoke('ai-coach', {
      body: { message: userText, history },
    });
    setIsSending(false);

    if (error || !data?.reply) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          content: "Sorry, I couldn't get a response just now.",
          isError: true,
        },
      ]);
    } else {
      setMessages((prev) => [...prev, { id: `${Date.now()}-assistant`, role: 'assistant', content: data.reply }]);
    }
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const userMessage: ChatMessage = { id: `${Date.now()}-user`, role: 'user', content: trimmed };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

    await requestReply(trimmed, history);
  }

  // Retries the request that produced a failed reply, without duplicating the
  // user's message bubble — it resends the same user text with the history as
  // it stood right before that attempt, then removes the error bubble.
  function handleRetry(failedMessageId: string) {
    const failedIndex = messages.findIndex((m) => m.id === failedMessageId);
    if (failedIndex === -1) return;

    const priorMessages = messages.slice(0, failedIndex);
    const lastUserMessage = [...priorMessages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) return;

    const historyBeforeLastUser = priorMessages.filter((m) => m.id !== lastUserMessage.id);
    setMessages((prev) => prev.filter((m) => m.id !== failedMessageId));
    requestReply(
      lastUserMessage.content,
      historyBeforeLastUser.map((m) => ({ role: m.role, content: m.content }))
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Coach</Text>
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {messages.length === 0 ? (
          <EmptyState onSelectPrompt={sendMessage} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardDismissMode="on-drag"
            renderItem={({ item }) => <MessageBubble message={item} onRetry={() => handleRetry(item.id)} />}
            ListFooterComponent={isSending ? <ThinkingBubble /> : null}
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your money..."
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <Pressable
            style={[styles.sendButton, (!input.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || isSending}>
            <Feather name="arrow-up" size={20} color={colors.background} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EmptyState({ onSelectPrompt }: { onSelectPrompt: (text: string) => void }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyGreeting}>{getGreeting()}</Text>
      <Text style={styles.emptySubtitle}>What would you like to know about your money?</Text>

      <View style={styles.promptList}>
        {SUGGESTED_PROMPTS.map((prompt) => (
          <Pressable key={prompt} style={styles.promptChip} onPress={() => onSelectPrompt(prompt)}>
            <Text style={styles.promptChipText}>{prompt}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function MessageBubble({ message, onRetry }: { message: ChatMessage; onRetry: () => void }) {
  const isUser = message.role === 'user';

  if (message.isError) {
    return (
      <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
        <View style={[styles.bubble, styles.bubbleError]}>
          <View style={styles.bubbleErrorHeader}>
            <Feather name="alert-circle" size={14} color={colors.secondaryAccent} />
            <Text style={styles.bubbleTextError}>{message.content}</Text>
          </View>
          <Pressable style={styles.retryButton} onPress={onRetry}>
            <Feather name="rotate-cw" size={13} color={colors.secondaryAccent} />
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant}>{message.content}</Text>
      </View>
    </View>
  );
}

function TypingDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(withTiming(1, { duration: 400 }), -1, true));
  }, [delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.typingDot, animatedStyle]} />;
}

function ThinkingBubble() {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
      <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
        <TypingDot delay={0} />
        <TypingDot delay={150} />
        <TypingDot delay={300} />
      </View>
    </View>
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
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  title: {
    color: colors.text,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
  },
  list: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  emptyGreeting: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  promptList: {
    marginTop: Spacing.five,
    gap: Spacing.two,
    width: '100%',
  },
  promptChip: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  promptChipText: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    textAlign: 'center',
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 20,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  bubbleUser: {
    backgroundColor: colors.primaryAccent,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.cardBackground,
    borderBottomLeftRadius: 4,
  },
  bubbleTextUser: {
    color: colors.background,
    fontSize: typography.body.fontSize,
  },
  bubbleTextAssistant: {
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
  bubbleError: {
    backgroundColor: colors.secondaryAccent + '14',
    borderWidth: 1,
    borderColor: colors.secondaryAccent + '40',
    borderBottomLeftRadius: 4,
    gap: Spacing.two,
  },
  bubbleErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  bubbleTextError: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    flexShrink: 1,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: colors.secondaryAccent,
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.three,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.text,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
    fontSize: typography.body.fontSize,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
