import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Logo, PrimaryButton, Screen } from '@/components/ChaloUI';
import * as haptics from '@/components/haptics';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { COUNTRY_CODE, toE164 } from '@/lib/phone';

export default function LoginScreen() {
  const colors = useColors();
  const { sendCode, busy, error, unavailableReason } = useAuth();
  const [digits, setDigits] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const e164 = toE164(digits);
  const ready = Boolean(e164) && !busy;

  const submit = async () => {
    if (!e164) {
      haptics.warning();
      setLocalError('Enter a Pakistani mobile number, e.g. 0300 1234567.');
      return;
    }
    setLocalError(null);
    haptics.press();
    const sent = await sendCode(e164);
    if (sent) router.push('/verify');
  };

  const message = localError ?? error;

  return (
    <Screen>
      <View style={styles.brand}>
        <Logo />
      </View>

      <Text style={[styles.title, { color: colors.charcoal }]}>Your number, please</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        We will text you a six-digit code to confirm it is really you. No password to remember.
      </Text>

      <View style={[styles.field, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.prefix, { borderRightColor: colors.border }]}>
          <Text style={[styles.prefixText, { color: colors.charcoal }]}>{COUNTRY_CODE}</Text>
        </View>
        <TextInput
          autoFocus
          value={digits}
          onChangeText={(value) => {
            setDigits(value);
            setLocalError(null);
          }}
          placeholder="300 1234567"
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel="Mobile number"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          returnKeyType="done"
          onSubmitEditing={submit}
          maxLength={18}
          style={[styles.input, { color: colors.charcoal }]}
        />
      </View>

      {message && (
        <View style={[styles.notice, { backgroundColor: colors.accent }]}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.charcoal }]}>{message}</Text>
        </View>
      )}

      {unavailableReason && (
        <View style={[styles.notice, { backgroundColor: colors.secondary }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
            {unavailableReason}
          </Text>
        </View>
      )}

      <PrimaryButton
        label="Send code"
        icon="arrow-forward"
        onPress={submit}
        disabled={!ready}
        loading={busy}
      />

      <Text style={[styles.legal, { color: colors.mutedForeground }]}>
        By continuing you agree to Chalo&apos;s terms and privacy policy. Standard SMS rates may
        apply.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'flex-start', marginBottom: 34, marginTop: 12 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 27, marginBottom: 9 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginBottom: 26 },
  field: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  prefix: { paddingHorizontal: 16, paddingVertical: 17, borderRightWidth: 1 },
  prefixText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  input: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 16, paddingHorizontal: 15, paddingVertical: 17 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 13,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  legal: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10.5,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 18,
  },
});
