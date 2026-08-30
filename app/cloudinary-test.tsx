import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Header, PrimaryButton, Screen } from '@/components/ChaloUI';
import * as haptics from '@/components/haptics';
import { useColors } from '@/hooks/useColors';
import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_CONFIGURED,
  CLOUDINARY_UPLOAD_PRESET,
  uploadImageToCloudinary,
  type CloudinaryAsset,
} from '@/lib/cloudinary';

/** Test harness for the direct-to-Cloudinary upload. Not part of the rider flow. */
export default function CloudinaryTestScreen() {
  const colors = useColors();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);
  const [asset, setAsset] = useState<CloudinaryAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const pick = async () => {
    haptics.tap();
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Chalo needs access to your photos to pick an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled) return;
    const picked = result.assets[0];
    if (!picked) return;
    setLocalUri(picked.uri);
    // A new pick invalidates the previous result — showing both is confusing.
    setAsset(null);
    setPercent(null);
  };

  const upload = async () => {
    if (!localUri || uploading) return;
    haptics.press();
    setError(null);
    setAsset(null);
    setUploading(true);
    setPercent(0);
    controller.current = new AbortController();

    try {
      const uploaded = await uploadImageToCloudinary(localUri, {
        folder: 'chalo',
        signal: controller.current.signal,
        onProgress: ({ fraction }) => {
          if (fraction !== null) setPercent(Math.round(fraction * 100));
        },
      });
      setAsset(uploaded);
      haptics.success();
    } catch (caught) {
      setError((caught as Error)?.message ?? 'Upload failed.');
      haptics.warning();
    } finally {
      setUploading(false);
      controller.current = null;
    }
  };

  const cancel = () => {
    haptics.tap();
    controller.current?.abort();
  };

  const reset = () => {
    haptics.tap();
    setLocalUri(null);
    setAsset(null);
    setError(null);
    setPercent(null);
  };

  return (
    <Screen>
      <Header
        title="Image upload test"
        subtitle="Device → Cloudinary, no backend"
        back
        onBack={() => router.back()}
      />

      <View style={[styles.config, { backgroundColor: colors.secondary }]}>
        <Ionicons
          name={CLOUDINARY_CONFIGURED ? 'cloud-done-outline' : 'alert-circle-outline'}
          size={16}
          color={CLOUDINARY_CONFIGURED ? colors.green : colors.primary}
        />
        <Text style={[styles.configText, { color: colors.mutedForeground }]}>
          {CLOUDINARY_CONFIGURED
            ? `${CLOUDINARY_CLOUD_NAME} · preset ${CLOUDINARY_UPLOAD_PRESET} · unsigned`
            : 'Missing EXPO_PUBLIC_CLOUDINARY_* env vars — check .env, then restart with `npx expo start -c`.'}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={localUri ? 'Choose a different image' : 'Choose an image'}
        onPress={pick}
        disabled={uploading}
        style={({ pressed }) => [
          styles.dropzone,
          {
            backgroundColor: colors.card,
            borderColor: localUri ? colors.border : colors.primary,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        {localUri ? (
          <Image
            accessibilityLabel="Selected image preview"
            source={{ uri: localUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.dropzoneEmpty}>
            <Ionicons name="images-outline" size={28} color={colors.primary} />
            <Text style={[styles.dropzoneTitle, { color: colors.charcoal }]}>Choose an image</Text>
            <Text style={[styles.dropzoneBody, { color: colors.mutedForeground }]}>
              Pick a photo from your gallery to upload
            </Text>
          </View>
        )}

        {localUri && (
          <View style={[styles.changeChip, { backgroundColor: colors.card }]}>
            <Ionicons name="swap-horizontal" size={13} color={colors.charcoal} />
            <Text style={[styles.changeText, { color: colors.charcoal }]}>Change</Text>
          </View>
        )}
      </Pressable>

      {uploading && (
        <View style={styles.progressBlock}>
          <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.primary, width: `${percent ?? 0}%` },
              ]}
            />
          </View>
          <View style={styles.progressRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
              {percent === null ? 'Uploading…' : `Uploading… ${percent}%`}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel upload"
              onPress={cancel}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.cancelText, { color: colors.destructive }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {error && (
        <View style={[styles.notice, { backgroundColor: colors.accent }]}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.charcoal }]}>{error}</Text>
        </View>
      )}

      <PrimaryButton
        label={asset ? 'Upload again' : 'Upload'}
        icon="cloud-upload-outline"
        onPress={upload}
        disabled={!localUri || uploading || !CLOUDINARY_CONFIGURED}
        loading={uploading}
      />

      {asset && (
        <View style={[styles.result, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.resultHeader}>
            <View style={[styles.resultIcon, { backgroundColor: colors.greenSoft }]}>
              <Ionicons name="checkmark" size={16} color={colors.green} />
            </View>
            <Text style={[styles.resultTitle, { color: colors.charcoal }]}>Upload successful</Text>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>PUBLIC ID</Text>
          <Text selectable style={[styles.fieldValue, { color: colors.charcoal }]}>
            {asset.publicId}
          </Text>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>SECURE URL</Text>
          <Text selectable style={[styles.fieldValue, { color: colors.charcoal }]}>
            {asset.secureUrl}
          </Text>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DETAILS</Text>
          <Text style={[styles.fieldValue, { color: colors.charcoal }]}>
            {asset.format.toUpperCase()} · {asset.width}×{asset.height} ·{' '}
            {(asset.bytes / 1024).toFixed(0)} KB
          </Text>

          {/* Loaded from Cloudinary, not from disk — proof it really landed. */}
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            SERVED FROM CLOUDINARY
          </Text>
          <Image
            accessibilityLabel="Uploaded image, served from Cloudinary"
            source={{ uri: asset.secureUrl }}
            style={[styles.remoteImage, { backgroundColor: colors.secondary }]}
            resizeMode="cover"
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start over"
            onPress={reset}
            style={({ pressed }) => [styles.reset, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.resetText, { color: colors.primary }]}>Start over</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  config: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 11,
    marginBottom: 16,
  },
  configText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
  dropzone: {
    height: 240,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  dropzoneEmpty: { alignItems: 'center', gap: 7, paddingHorizontal: 24 },
  dropzoneTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, marginTop: 3 },
  dropzoneBody: { fontFamily: 'Inter_400Regular', fontSize: 11.5, textAlign: 'center' },
  changeChip: {
    position: 'absolute',
    right: 11,
    bottom: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  changeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10.5 },
  progressBlock: { marginBottom: 18 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 10 },
  progressText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11.5 },
  cancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 11.5 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 13,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  result: { borderWidth: 1, borderRadius: 19, padding: 16, marginTop: 22 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 16 },
  resultIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  fieldLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.8, marginBottom: 5 },
  fieldValue: { fontFamily: 'Inter_500Medium', fontSize: 11.5, lineHeight: 17, marginBottom: 14 },
  remoteImage: { width: '100%', height: 170, borderRadius: 13, marginBottom: 6 },
  reset: { alignItems: 'center', paddingTop: 14 },
  resetText: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5 },
});
