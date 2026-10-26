import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Stack, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import PagedList from "@/components/PagedList";
import { EmptyState, Screen, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { timeAgo } from "@/lib/format";
import { colors, radius } from "@/theme";

const ICONS = { order: "receipt-outline", listing: "pricetags-outline", payout: "wallet-outline", seller: "storefront-outline", server: "pulse-outline" };

/** Everything Elitezaar has told this account (order updates, listing reviews, payouts), newest first. */
export default function NotificationsScreen() {
  const { session, request } = useAuth();
  const toast = useToast();
  const [unread, setUnread] = useState(0);
  // Bumped to reload the list from the first page.
  const [version, setVersion] = useState(0);

  const fetchPage = useCallback(async (page) => {
    const data = await request(`/notifications?page=${page}`);
    setUnread(data.unread || 0);
    return data;
  }, [request]);

  if (!session) {
    return (
      <Screen>
        <EmptyState icon="notifications-outline" title="Sign in to see your notifications" message="Order updates and messages from Elitezaar appear here." actionLabel="Sign in" onAction={() => router.push("/login")} />
      </Screen>
    );
  }

  const open = (item, replace) => {
    if (!item.read) {
      replace({ ...item, read: true });
      setUnread((count) => Math.max(0, count - 1));
      request(`/notifications/${item.id}/read`, { method: "PATCH" }).catch(() => {});
    }
    if (item.app_url) router.push(item.app_url);
  };

  const markAllRead = async () => {
    try {
      await request("/notifications/read-all", { method: "POST" });
      setUnread(0);
      setVersion((current) => current + 1);
    } catch (error) {
      toast(error.message, "error");
    }
  };

  return (
    <>
      <Stack.Screen options={{
        headerRight: unread ? () => (
          <Pressable onPress={markAllRead} hitSlop={10} accessibilityRole="button" style={{ paddingHorizontal: 6 }}>
            <T variant="strong" color={colors.tealDark}>Mark all read</T>
          </Pressable>
        ) : undefined,
      }} />
      <PagedList
        fetchPage={fetchPage}
        deps={[version]}
        empty={<EmptyState icon="notifications-outline" title="No notifications yet" message="Order updates and messages from Elitezaar will appear here." />}
        renderItem={(item, index, { replace }) => (
          <Pressable
            onPress={() => open(item, replace)}
            accessibilityRole="button"
            accessibilityLabel={`${item.read ? "" : "Unread. "}${item.title}. ${item.body}`}
            style={({ pressed }) => [styles.row, !item.read && styles.rowUnread, pressed && { opacity: 0.85 }]}
          >
            <View style={[styles.icon, !item.read && styles.iconUnread]}>
              <Ionicons name={ICONS[item.kind] || "notifications-outline"} size={20} color={item.read ? colors.muted : colors.emerald} />
            </View>
            <View style={{ flex: 1 }}>
              <T variant="title" color={colors.ink} numberOfLines={2}>{item.title}</T>
              <T variant="small" style={{ marginTop: 2 }}>{item.body}</T>
              <T variant="small" color={colors.faint} style={{ marginTop: 6 }}>{timeAgo(item.created_at)}</T>
            </View>
            {!item.read ? <View style={styles.dot} accessibilityElementsHidden /> : null}
          </Pressable>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, padding: 14, backgroundColor: colors.white },
  rowUnread: { borderColor: "#cfe3dc", backgroundColor: "#f5fbf8" },
  icon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: colors.cream },
  iconUnread: { backgroundColor: colors.mint },
  dot: { width: 9, height: 9, marginTop: 6, borderRadius: 5, backgroundColor: colors.teal },
});
