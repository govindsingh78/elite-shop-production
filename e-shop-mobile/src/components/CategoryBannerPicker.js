import React, { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Button, Row, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { categoryBannerUrl } from "@/lib/config";
import { uploadErrorMessage, uploadPhoto } from "@/lib/uploadPhoto";
import { colors, radius } from "@/theme";

/**
 * A main category's home page banner. `current` is the banner it has now; `change` is what saving will do to it,
 * { banner_temp_id, preview } for a new photo or { remove_banner: true }.
 */
export default function CategoryBannerPicker({ current, change, onChange, error }) {
  const { request } = useAuth();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const preview = change.preview || (change.remove_banner ? null : categoryBannerUrl(current));

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.85 });
    if (result.canceled) return;
    setUploading(true);
    try {
      const { upload, uri } = await uploadPhoto(request, result.assets[0], `banner-${Date.now()}.jpg`);
      onChange({ banner_temp_id: upload.id, preview: uri });
    } catch (uploadError) {
      toast(uploadErrorMessage(uploadError), "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={{ marginBottom: 14 }}>
      <T variant="label" style={{ marginBottom: 8 }}>Home page banner (optional)</T>
      {preview ? <Image source={{ uri: preview }} style={styles.preview} resizeMode="cover" accessibilityLabel="Banner preview" /> : (
        <View style={[styles.preview, styles.empty]}><T variant="small" center>No banner yet: a coloured one is used instead.</T></View>
      )}
      <Row gap={8} style={{ marginTop: 8 }}>
        <Button title={preview ? "Replace photo" : "Choose a photo"} icon="image-outline" variant="outline" small block={false} loading={uploading} onPress={pick} />
        {preview ? <Button title="Remove" variant="ghost" small block={false} onPress={() => onChange(current ? { remove_banner: true } : {})} /> : null}
      </Row>
      <T variant="small" style={{ marginTop: 6 }}>A clear photo with no words on it, at least 1200 pixels wide. It shows tall on computers and wide on phones, so keep the main subject in the centre. It shows on the home page once the category has live products.</T>
      {error ? <T variant="small" color={colors.danger} style={{ marginTop: 4 }}>{error}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.lineSoft },
  empty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, padding: 12, backgroundColor: colors.paper },
});
