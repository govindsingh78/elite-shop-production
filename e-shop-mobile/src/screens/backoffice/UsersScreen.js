import React, { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import PagedList from "@/components/PagedList";
import { Chip, EmptyState, IconButton, Pill, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { formatDate, initials } from "@/lib/format";
import { colors, fonts, radius, shadow } from "@/theme";

export const ROLES = {
  customer: { label: "Customer", color: colors.tealDark, background: colors.tealSoft },
  seller: { label: "Seller", color: colors.goldDeep, background: colors.goldSoft },
  admin: { label: "Admin", color: "#5b43a6", background: "#efeafb" },
  superadmin: { label: "Super admin", color: "#5b43a6", background: "#efeafb" },
};

export default function UsersScreen() {
  const { request } = useAuth();
  const [role, setRole] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(null);

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <View style={{ marginRight: Platform.OS === "web" ? 12 : 0 }}><IconButton icon="person-add-outline" label="Add user" size={36} background={colors.emerald} color={colors.white} onPress={() => router.push("/admin/user-form")} /></View> }} />
      <PagedList
        deps={[role, search]}
        onTotal={setTotal}
        fetchPage={(page) => request("/admin/users", { query: { role, search, page } })}
        header={(
          <View>
            <View style={styles.search}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput value={searchDraft} onChangeText={setSearchDraft} onSubmitEditing={() => setSearch(searchDraft.trim())} placeholder="Name or email" placeholderTextColor={colors.faint} returnKeyType="search" autoCapitalize="none" style={styles.searchInput} />
              {searchDraft ? <Pressable onPress={() => { setSearchDraft(""); setSearch(""); }}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
              <Chip label="Everyone" active={!role} onPress={() => setRole("")} />
              {Object.entries(ROLES).map(([value, config]) => <Chip key={value} label={config.label} active={role === value} onPress={() => setRole(value)} />)}
            </ScrollView>
            {total !== null ? <T variant="label" style={{ marginBottom: 10 }}>{total} user{total === 1 ? "" : "s"}</T> : null}
          </View>
        )}
        renderItem={(user) => {
          const config = ROLES[user.role] || { label: user.role, color: colors.muted, background: colors.lineSoft };
          return (
            <Pressable onPress={() => router.push({ pathname: "/admin/user-form", params: { id: String(user.id) } })} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
              <View style={[styles.avatar, { backgroundColor: config.background }]}><Text style={[styles.avatarText, { color: config.color }]}>{initials(user.name)}</Text></View>
              <View style={{ flex: 1 }}>
                <T variant="title" numberOfLines={1}>{user.name}</T>
                <T variant="small" numberOfLines={1}>{user.email}</T>
                <T variant="small">Joined {formatDate(user.created_at)}</T>
              </View>
              <Pill label={config.label} color={config.color} background={config.background} />
            </Pressable>
          );
        }}
        empty={<EmptyState icon="people-outline" title="No users found" />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 16, backgroundColor: colors.white },
  searchInput: { flex: 1, height: "100%", color: colors.text, fontFamily: fonts.bodySemi, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, padding: 14, backgroundColor: colors.white, ...shadow.card },
  avatar: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 15 },
  avatarText: { fontFamily: fonts.heading, fontSize: 16 },
});
