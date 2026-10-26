import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ListRow } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { colors, fonts } from "@/theme";

/** "Notifications" menu row for signed-in users, with the number of unread messages. */
export default function NotificationsRow({ last }) {
  const { request } = useAuth();
  const [unread, setUnread] = useState(0);

  // Re-checked whenever the screen comes back into view, e.g. after reading them.
  useFocusEffect(useCallback(() => {
    let active = true;
    request("/notifications?per_page=1")
      .then((data) => { if (active) setUnread(data.unread || 0); })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [request]));

  return (
    <ListRow
      icon="notifications-outline"
      title="Notifications"
      subtitle={unread ? `${unread} new ${unread === 1 ? "message" : "messages"}` : "Order updates and messages"}
      onPress={() => router.push("/notifications")}
      right={unread ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text></View> : undefined}
      last={last}
    />
  );
}

const styles = StyleSheet.create({
  badge: { minWidth: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingHorizontal: 7, backgroundColor: colors.teal },
  badgeText: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 13 },
});
