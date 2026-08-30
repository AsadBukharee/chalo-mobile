import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Avatar, Header, Screen } from '@/components/ChaloUI';
import { Appearance, useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatE164 } from '@/lib/phone';
import { useColors } from '@/hooks/useColors';

const items: { label: string; icon: keyof typeof Ionicons.glyphMap; value?: string }[] = [
  { label: 'Saved places', icon: 'bookmark-outline' },
  { label: 'Payment methods', icon: 'card-outline', value: 'Coming soon' },
  { label: 'Language', icon: 'language-outline', value: 'English' },
  { label: 'Help & Support', icon: 'help-circle-outline' },
  { label: 'Safety center', icon: 'shield-checkmark-outline' },
  { label: 'Terms & Privacy', icon: 'document-text-outline' },
  { label: 'Image upload test', icon: 'cloud-upload-outline', value: 'Cloudinary' },
  { label: 'Send test notification', icon: 'notifications-outline', value: 'FCM' },
];

const appearanceLabels: Record<Appearance, string> = { system: 'System', light: 'Light', dark: 'Dark' };

function SettingRow({ icon, label, value, onPress, colors, last = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress?: () => void; colors: ReturnType<typeof useColors>; last?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} onPress={onPress} style={({ pressed }) => [styles.setting, { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 }, last && styles.lastSetting]}><View style={[styles.settingIcon, { backgroundColor: label === 'Safety center' ? colors.greenSoft : colors.secondary }]}><Ionicons name={icon} size={17} color={label === 'Safety center' ? colors.green : colors.charcoal} /></View><Text style={[styles.settingLabel, { color: colors.charcoal }]}>{label}</Text>{value && <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>{value}</Text>}<Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} /></Pressable>;
}

export default function ProfileScreen() {
  const colors = useColors();
  const { appearance, setAppearance, registration } = useApp();
  const { user, signOut } = useAuth();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const openSetting = (label: string) => {
    if (label === 'Safety center') {
      router.push('/journey');
      return;
    }
    if (label === 'Image upload test') {
      router.push('/cloudinary-test');
      return;
    }
    if (label === 'Send test notification') {
      void (async () => {
        try {
          const result = await api.sendTestPush();
          setNotice(
            result.delivered > 0
              ? `Sent to ${result.delivered} of ${result.devices} device(s). Check your tray.`
              : `No device accepted it (${result.devices} registered). Check the server logs.`,
          );
        } catch (caught) {
          setNotice((caught as Error)?.message ?? 'Could not send the test notification.');
        }
      })();
      return;
    }
    setNotice(`${label} isn't wired up in this build yet.`);
  };

  return <Screen><Header title="Profile" subtitle="Your Chalo account" action={() => setAppearanceOpen(true)} actionIcon="settings-outline" actionLabel="Open appearance settings" /><View style={[styles.profileCard, { backgroundColor: colors.inverseSurface }]}><Avatar initials="AS" size={62} accent /><View style={styles.profileCopy}><Text style={[styles.name, { color: colors.inverseForeground }]}>Asad</Text><Text style={[styles.phone, { color: colors.inverseMuted }]}>{user?.phoneNumber ? formatE164(user.phoneNumber) : 'Not signed in'}</Text><View style={styles.member}><Ionicons name="sparkles" size={12} color={colors.primary} /><Text style={[styles.memberText, { color: colors.primary }]}>Chalo member</Text></View></View><Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={() => setAppearanceOpen(true)} style={[styles.edit, { borderColor: colors.inverseMuted }]}><Ionicons name="pencil" size={16} color={colors.inverseForeground} /></Pressable></View><Text style={[styles.section, { color: colors.charcoal }]}>Driver tools</Text><Pressable onPress={() => router.push('/register-car')} style={[styles.driverBanner, { backgroundColor: colors.cream, borderColor: colors.primary }]}><View style={[styles.driverIcon, { backgroundColor: colors.primary }]}><Ionicons name="car-sport-outline" size={21} color={colors.charcoal} /></View><View style={styles.driverCopy}><Text style={[styles.driverTitle, { color: colors.charcoal }]}>{registration ? 'Manage your registered car' : 'Register your car'}</Text><Text style={[styles.driverBody, { color: colors.mutedForeground }]}>{registration ? 'Application under review · View details' : 'Share rides between cities and earn on the way'}</Text></View><Ionicons name="arrow-forward" size={18} color={colors.primary} /></Pressable><Text style={[styles.section, { color: colors.charcoal }]}>Preferences</Text><View style={[styles.settings, { backgroundColor: colors.card, borderColor: colors.border }]}><SettingRow icon="contrast-outline" label="Appearance" value={appearanceLabels[appearance]} colors={colors} onPress={() => setAppearanceOpen(true)} />{items.map((item, index) => <SettingRow key={item.label} {...item} colors={colors} last={index === items.length - 1} onPress={() => openSetting(item.label)} />)}<View style={[styles.setting, styles.lastSetting]}><View style={[styles.settingIcon, { backgroundColor: colors.secondary }]}><Ionicons name="notifications-outline" size={17} color={colors.charcoal} /></View><Text style={[styles.settingLabel, { color: colors.charcoal }]}>Notifications</Text><Switch value={notificationsOn} onValueChange={setNotificationsOn} trackColor={{ false: colors.muted, true: colors.green }} thumbColor={colors.white} /></View></View><Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={() => { void signOut(); }} style={styles.logout}><Ionicons name="log-out-outline" size={18} color={colors.destructive} /><Text style={[styles.logoutText, { color: colors.destructive }]}>Log out</Text></Pressable>{notice && <Pressable accessibilityRole="button" accessibilityLabel={`${notice}. Dismiss`} onPress={() => setNotice(null)} style={[styles.notice, { backgroundColor: colors.accent }]}><Ionicons name="information-circle-outline" size={16} color={colors.primary} /><Text style={[styles.noticeText, { color: colors.charcoal }]}>{notice}</Text><Ionicons name="close" size={15} color={colors.mutedForeground} /></Pressable>}<Text style={[styles.version, { color: colors.mutedForeground }]}>Chalo v1.0 · Made for journeys together</Text><Modal visible={appearanceOpen} transparent animationType="slide" onRequestClose={() => setAppearanceOpen(false)}><View style={styles.modalOverlay}><View style={[styles.sheet, { backgroundColor: colors.card }]}><View style={[styles.sheetHandle, { backgroundColor: colors.border }]} /><Text style={[styles.sheetTitle, { color: colors.charcoal }]}>App appearance</Text><Text style={[styles.sheetBody, { color: colors.mutedForeground }]}>Choose how Chalo looks on this device.</Text>{(['system', 'light', 'dark'] as Appearance[]).map((mode) => <Pressable key={mode} onPress={() => { setAppearance(mode); setAppearanceOpen(false); }} style={[styles.appearanceRow, { borderBottomColor: colors.border }]}><View style={[styles.appearanceIcon, { backgroundColor: mode === 'dark' ? colors.inverseSurface : colors.secondary }]}><Ionicons name={mode === 'system' ? 'phone-portrait-outline' : mode === 'light' ? 'sunny-outline' : 'moon-outline'} size={17} color={mode === 'dark' ? colors.inverseForeground : colors.charcoal} /></View><Text style={[styles.appearanceText, { color: colors.charcoal }]}>{appearanceLabels[mode]}</Text><Ionicons name={appearance === mode ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={appearance === mode ? colors.primary : colors.mutedForeground} /></Pressable>)}<Pressable onPress={() => setAppearanceOpen(false)} style={styles.close}><Text style={[styles.closeText, { color: colors.mutedForeground }]}>Cancel</Text></Pressable></View></View></Modal></Screen>;
}

const styles = StyleSheet.create({ profileCard: { borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 25 }, profileCopy: { flex: 1 }, name: { fontFamily: 'Inter_700Bold', fontSize: 22 }, phone: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 }, member: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 9 }, memberText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 }, edit: { width: 35, height: 35, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, section: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 11 }, driverBanner: { borderRadius: 19, borderWidth: 1.5, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 25 }, driverIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, driverCopy: { flex: 1 }, driverTitle: { fontFamily: 'Inter_700Bold', fontSize: 13 }, driverBody: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 4 }, settings: { borderWidth: 1, borderRadius: 19, overflow: 'hidden' }, setting: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, borderBottomWidth: 1 }, lastSetting: { borderBottomWidth: 0 }, settingIcon: { width: 33, height: 33, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, settingLabel: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12 }, settingValue: { fontFamily: 'Inter_400Regular', fontSize: 10, marginRight: 3 }, logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 23 }, logoutText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 }, notice: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, padding: 12, marginBottom: 16 }, noticeText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11.5 }, version: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 10 }, modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,17,17,0.45)' }, sheet: { borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 21, paddingBottom: 35 }, sheetHandle: { width: 35, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }, sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 20 }, sheetBody: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 5, marginBottom: 12 }, appearanceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, gap: 11 }, appearanceIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, appearanceText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14 }, close: { alignItems: 'center', paddingTop: 18 }, closeText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 } });