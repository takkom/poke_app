import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ImageStyle,
} from "react-native";

type CardListImageProps = {
  uri?: string | null;
  recyclingKey?: string;
  style?: StyleProp<ImageStyle>;
  backgroundColor?: string;
  iconColor?: string;
  fallbackIcon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
};

function isUsableImageUri(uri?: string | null): uri is string {
  const trimmed = uri?.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.startsWith("/")) {
    return false;
  }
  if (trimmed.includes("placeholder.png")) {
    return false;
  }
  return true;
}

/**
 * List thumbnails: avoid FlatList + transition blanking, and fall back when
 * a remote URI fails (common for large marketplace PNGs).
 */
export function CardListImage({
  uri,
  recyclingKey,
  style,
  backgroundColor,
  iconColor,
  fallbackIcon = "cards-outline",
}: CardListImageProps) {
  const resolved = isUsableImageUri(uri) ? uri.trim() : null;
  const [failedUri, setFailedUri] = useState<string | null>(null);

  useEffect(() => {
    setFailedUri(null);
  }, [resolved]);

  const failed = !resolved || failedUri === resolved;

  if (failed) {
    return (
      <View
        style={[
          style,
          styles.fallback,
          backgroundColor ? { backgroundColor } : null,
        ]}
      >
        <MaterialCommunityIcons
          name={fallbackIcon}
          size={28}
          color={iconColor}
        />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: resolved }}
      style={[style, backgroundColor ? { backgroundColor } : null]}
      contentFit="cover"
      recyclingKey={recyclingKey ?? resolved}
      cachePolicy="memory-disk"
      allowDownscaling
      onError={() => setFailedUri(resolved)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
});
