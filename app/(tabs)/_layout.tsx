import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';

function NativeTabLayout() {
  return <NativeTabs><NativeTabs.Trigger name="index"><Icon sf={{ default: 'house', selected: 'house.fill' }} /><Label>Home</Label></NativeTabs.Trigger><NativeTabs.Trigger name="trips"><Icon sf={{ default: 'suitcase', selected: 'suitcase.fill' }} /><Label>Trips</Label></NativeTabs.Trigger><NativeTabs.Trigger name="inbox"><Icon sf={{ default: 'bell', selected: 'bell.fill' }} /><Label>Inbox</Label></NativeTabs.Trigger><NativeTabs.Trigger name="profile"><Icon sf={{ default: 'person', selected: 'person.fill' }} /><Label>Profile</Label></NativeTabs.Trigger></NativeTabs>;
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isWeb = Platform.OS === 'web';
  const icon = (name: React.ComponentProps<typeof Feather>['name']) => ({ color }: { color: string }) => <Feather name={name} size={21} color={color} />;
  const isIOS = Platform.OS === 'ios';
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.mutedForeground, tabBarStyle: { position: 'absolute', backgroundColor: isIOS ? 'transparent' : colors.card, borderTopWidth: isWeb ? 1 : 0, borderTopColor: colors.border, elevation: 0, ...(isWeb ? { height: 84 } : {}) }, tabBarBackground: () => isIOS ? <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} /> }}><Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} /><Tabs.Screen name="trips" options={{ title: 'My Trips', tabBarIcon: icon('briefcase') }} /><Tabs.Screen name="inbox" options={{ title: 'Inbox', tabBarIcon: icon('bell') }} /><Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('user') }} /></Tabs>;
}

export default function TabLayout() { return isLiquidGlassAvailable() ? <NativeTabLayout /> : <ClassicTabLayout />; }