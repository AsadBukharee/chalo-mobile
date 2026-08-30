import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Header, PrimaryButton, Screen } from '@/components/ChaloUI';
import * as haptics from '@/components/haptics';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { formatE164 } from '@/lib/phone';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 45;

export default function VerifyScreen() {
  const colors = useColors();
  const { pendingPhone, confirmCode, sendCode, cancelCode, busy, error, autoCode } = useAuth();
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputRef = useRef<TextInput | null>(null);
  const submitted = useRef(false);

  // Someone who deep-links here, or comes back after the code was cleared, has
  // nothing to confirm — send them back rather than showing a dead form.
  useEffect(() => {
    if (!pendingPhone) router.replace('/login');
  }, [pendingPhone]);

  // Android read the SMS for us. Sign-in is already underway; fill the boxes
  // so the digits are visibly there rather than the screen just disappearing.
  const [autoFilled, setAutoFilled] = useState(false);
  useEffect(() => {
    if (!autoCode) return;
    setCode(autoCode.slice(0, CODE_LENGTH));
    setAutoFilled(true);
    submitted.current = true;
    haptics.success();
  }, [autoCode]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const submit = async (value: string) => {
    if (value.length !== CODE_LENGTH || busy) return;
    haptics.press();
    const ok = await confirmCode(value);
    if (ok) {
      haptics.success();
      // The root layout redirects to the tabs once the user lands.
    } else {
      submitted.current = false;
      setCode('');
      inputRef.current?.focus();
    }
  };

  const onChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    // Auto-submit on the last digit — but only once, or a failed attempt would
    // resubmit itself the moment state settles.
    if (digits.length === CODE_LENGTH && !submitted.current) {
      submitted.current = true;
      void submit(digits);
    }
    if (digits.length < CODE_LENGTH) submitted.current = false;
  };

  const resend = async () => {
    if (!pendingPhone || secondsLeft > 0 || busy) return;
    haptics.tap();
    setCode('');
    submitted.current = false;
    const sent = await sendCode(pendingPhone);
    if (sent) setSecondsLeft(RESEND_SECONDS);
  };

  return (
    <Screen>
      <Header
        title="Enter the code"
        subtitle={pendingPhone ? `Sent to ${formatE164(pendingPhone)}` : undefined}
        back
        onBack={() => {
          cancelCode();
          router.replace('/login');
        }}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enter verification code"
        onPress={() => inputRef.current?.focus()}
        style={styles.boxes}
      >
        {Array.from({ length: CODE_LENGTH }).map((_, index) => {
          const filled = index < code.length;
          const active = index === code.length;
          return (
            <View
              key={index}
              style={[
                styles.box,
                {
                  backgroundColor: colors.card,
                  borderColor: active ? colors.primary : colors.border,
                  borderWidth: active ? 2 : 1,
                },
              ]}
            >
              <Text style={[styles.boxText, { color: colors.charcoal }]}>
                {filled ? code[index] : ''}
              </Text>
            </View>
          );
        })}
      </Pressable>

      {/* The real input sits off-screen; the boxes above are just its face. */}
      <TextInput
        ref={inputRef}
        autoFocus
        value={code}
        onChangeText={onChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={CODE_LENGTH}
        accessibilityLabel="Verification code"
        style={styles.hiddenInput}
      />

      {autoFilled && !error && (
        <View style={[styles.notice, { backgroundColor: colors.greenSoft }]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.green} />
          <Text style={[styles.noticeText, { color: colors.charcoal }]}>
            Code detected automatically — signing you in.
          </Text>
        </View>
      )}

      {error && (
        <View style={[styles.notice, { backgroundColor: colors.accent }]}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.charcoal }]}>{error}</Text>
        </View>
      )}

      <PrimaryButton
        label="Verify and continue"
        icon="checkmark"
        onPress={() => submit(code)}
        disabled={code.length !== CODE_LENGTH || busy}
        loading={busy}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send a new code"
        accessibilityState={{ disabled: secondsLeft > 0 }}
        onPress={resend}
        style={({ pressed }) => [styles.resend, { opacity: pressed && secondsLeft === 0 ? 0.6 : 1 }]}
      >
        <Text
          style={[
            styles.resendText,
            { color: secondsLeft > 0 ? colors.mutedForeground : colors.primary },
          ]}
        >
          {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Send a new code'}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', gap: 9, marginTop: 8, marginBottom: 20 },
  box: { flex: 1, height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  boxText: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 13,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  resend: { alignItems: 'center', paddingVertical: 18 },
  resendText: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5 },
});
