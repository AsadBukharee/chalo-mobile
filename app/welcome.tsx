import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
 */
export default function WelcomeScreen() {
  const colors = useColors();
  const { profile, isNewAccount, profileError, refreshProfile, completeWelcome, user, signOut } =
    useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const phone = profile?.phone ?? user?.phoneNumber ?? null;

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

  const returning = !isNewAccount;
  const knownName = profile?.full_name?.trim() ?? '';

  const proceed = async () => {
    haptics.press();
    setSaving(true);
    await completeWelcome(returning ? undefined : name);
    setSaving(false);
    router.replace('/(tabs)');
  };

  return (
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
        <Text style={[styles.title, { color: colors.charcoal }]}>
          {returning ? `Welcome back${knownName ? `, ${knownName.split(' ')[0]}` : ''}` : 'Welcome to Chalo'}
        </Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          {returning
            ? 'Good to see you again. Your trips and bookings are where you left them.'
            : 'Your number is verified and your account is ready. What should we call you?'}
        </Text>
        {phone && (
          <View style={[styles.phoneChip, { backgroundColor: colors.secondary }]}>
            <Ionicons name="checkmark-circle" size={14} color={colors.green} />
            <Text style={[styles.phoneText, { color: colors.charcoal }]}>{formatE164(phone)}</Text>
          </View>
        )}
      </View>

      {!returning && (
        <View style={[styles.field, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="person-outline" size={19} color={colors.mutedForeground} />
          <TextInput
            autoFocus
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel="Your name"
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="done"
            onSubmitEditing={proceed}
            maxLength={60}
            style={[styles.input, { color: colors.charcoal }]}
          />
        </View>
      )}

      {profileError && (
        <View style={[styles.notice, { backgroundColor: colors.accent }]}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.charcoal }]}>{profileError}</Text>
        </View>
      )}

      <PrimaryButton
        label={returning ? 'Continue' : 'Get started'}
        icon="arrow-forward"
        onPress={proceed}
        loading={saving}
        // A name is optional — nobody should be locked out of a ride over it.
        disabled={saving}
      />

      {!returning && (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          You can change this later in your profile.
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
