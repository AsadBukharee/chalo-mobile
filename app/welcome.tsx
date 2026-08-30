import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Celebration } from '@/components/Celebration';
import { PrimaryButton, Screen } from '@/components/ChaloUI';
import * as haptics from '@/components/haptics';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { formatE164 } from '@/lib/phone';

/**
 * The moment after a verified number, where the account either already existed
 * or has just been created.
 *
 * One screen for both because it is one decision from the rider's point of
 * view — "is this me?" — and because splitting it would mean a returning rider
 * seeing a sign-up screen flash past on every fresh install.
 *
 * The two halves behave differently on purpose. A returning rider is greeted,
 * confettied, and moved along without touching anything: they have nothing to
 * tell us, and a button in the way of their own app is friction, not welcome.
 * A new rider is stopped for exactly one thing — their name — because every
 * driver, seat list and booking after this shows it, and "+92 300 1234567" is
 * nobody's name.
 */

/** Long enough to read the greeting, short enough not to feel like a gate. */
const AUTO_CONTINUE_MS = 2600;

export default function WelcomeScreen() {
  const colors = useColors();
  const {
    profile,
    isNewAccount,
    celebrate,
    endCelebration,
    profileError,
    refreshProfile,
    completeWelcome,
    user,
    signOut,
  } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

  const phone = profile?.phone ?? user?.phoneNumber ?? null;
  const returning = !!profile && !isNewAccount;
  const knownName = profile?.full_name?.trim() ?? '';
  // A returning rider we have no name for is still a returning rider, but the
  // name has to be collected before the rest of the app can address them.
  const asksForName = !!profile && (isNewAccount || !knownName);

  const proceeding = useRef(false);

  const proceed = async (typed?: string) => {
    if (proceeding.current) return;
    const value = (typed ?? name).trim();
    if (asksForName && value.length < 2) {
      setNameTouched(true);
      return;
    }
    proceeding.current = true;
    haptics.press();
    setSaving(true);
    await completeWelcome(asksForName ? value : undefined);
    setSaving(false);
    router.replace('/(tabs)');
  };

  // A greeting nobody has to acknowledge. Only when there is nothing to
  // collect — a screen with a text field in it must wait for the person.
  useEffect(() => {
    if (!profile || asksForName || profileError) return;
    const timer = setTimeout(() => void proceed(), AUTO_CONTINUE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, asksForName, profileError]);

  // Confetti lands with a tap you can feel, not just see.
  useEffect(() => {
    if (celebrate) haptics.success();
  }, [celebrate]);

  // The session call has not landed yet. Nothing to decide until it does.
  if (!profile && !profileError) {
    return (
      <Screen>
        <View style={styles.centre}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.centreText, { color: colors.mutedForeground }]}>
            Setting up your account…
          </Text>
        </View>
      </Screen>
    );
  }

  // Verified with Firebase but the API is unreachable. Signing them in anyway
  // would produce an app that looks logged in and fails on every screen.
  if (!profile && profileError) {
    return (
      <Screen>
        <View style={styles.centre}>
          <View style={[styles.icon, { backgroundColor: colors.accent }]}>
            <Ionicons name="cloud-offline-outline" size={26} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.charcoal }]}>Can&apos;t reach Chalo</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Your number is verified, but we couldn&apos;t load your account. {profileError}
          </Text>
          <View style={styles.retryRow}>
            <PrimaryButton
              label="Try again"
              icon="refresh"
              loading={retrying}
              onPress={async () => {
                setRetrying(true);
                await refreshProfile();
                setRetrying(false);
              }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use a different number"
            onPress={() => void signOut()}
            style={({ pressed }) => [styles.secondary, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.secondaryText, { color: colors.mutedForeground }]}>
              Use a different number
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const greeting = returning
    ? `Welcome back${knownName ? `, ${knownName.split(' ')[0]}` : ''}`
    : 'Welcome to Chalo';

  const nameTooShort = asksForName && nameTouched && name.trim().length < 2;

  return (
    // The confetti sits outside Screen deliberately: Screen is a ScrollView,
    // and an absolutely-positioned child inside it would be clipped at the
    // content edge and would scroll with the page.
    <View style={styles.root}>
      <Screen>
        <View style={styles.header}>
          <View
            style={[styles.icon, { backgroundColor: returning ? colors.greenSoft : colors.accent }]}
          >
            <Ionicons
              name={returning ? 'happy-outline' : 'sparkles'}
              size={26}
              color={returning ? colors.green : colors.primary}
            />
          </View>
          <Text
            accessibilityRole="header"
            // Announced immediately: the confetti says nothing to a screen reader.
            accessibilityLiveRegion="polite"
            style={[styles.title, { color: colors.charcoal }]}
          >
            {greeting}
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {asksForName
              ? 'Your number is verified and your account is ready. What should we call you?'
              : 'Good to see you again. Your trips and bookings are where you left them.'}
          </Text>
          {phone && (
            <View style={[styles.phoneChip, { backgroundColor: colors.secondary }]}>
              <Ionicons name="checkmark-circle" size={14} color={colors.green} />
              <Text style={[styles.phoneText, { color: colors.charcoal }]}>{formatE164(phone)}</Text>
            </View>
          )}
        </View>

        {asksForName && (
          <>
            <View
              style={[
                styles.field,
                {
                  backgroundColor: colors.card,
                  borderColor: nameTooShort ? colors.destructive : colors.border,
                },
              ]}
            >
              <Ionicons name="person-outline" size={19} color={colors.mutedForeground} />
              <TextInput
                autoFocus
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  if (nameTouched) setNameTouched(false);
                }}
                placeholder="Your full name"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="Your full name"
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="done"
                onSubmitEditing={() => void proceed()}
                maxLength={60}
                style={[styles.input, { color: colors.charcoal }]}
              />
            </View>
            {nameTooShort && (
              <Text style={[styles.error, { color: colors.destructive }]}>
                Please enter your name so drivers know who to expect.
              </Text>
            )}
          </>
        )}

        {profileError && (
          <View style={[styles.notice, { backgroundColor: colors.accent }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
            <Text style={[styles.noticeText, { color: colors.charcoal }]}>{profileError}</Text>
          </View>
        )}

        <PrimaryButton
          label={asksForName ? 'Get started' : 'Continue'}
          icon="arrow-forward"
          onPress={() => void proceed()}
          loading={saving}
          disabled={saving || (asksForName && name.trim().length < 2)}
        />

        {asksForName && (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            You can change this later in your profile.
          </Text>
        )}
      </Screen>

      {/* Last child so it draws over everything; it never takes a touch. */}
      <Celebration active={celebrate} onDone={endCelebration} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  centreText: { fontFamily: 'Inter_500Medium', fontSize: 12.5 },
  header: { alignItems: 'flex-start', marginTop: 40, marginBottom: 28 },
  icon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 27, marginBottom: 9 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  phoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 16,
  },
  phoneText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  field: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 10,
    marginBottom: 18,
  },
  input: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15, paddingVertical: 17 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 11.5, marginTop: -10, marginBottom: 16 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 13,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  retryRow: { alignSelf: 'stretch', marginTop: 22 },
  secondary: { alignItems: 'center', paddingVertical: 18 },
  secondaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5 },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
  },
});
