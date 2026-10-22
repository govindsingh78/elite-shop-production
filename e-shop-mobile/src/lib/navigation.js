import { colors, fonts } from "@/theme";

/** Shared header look for every stack. */
export const stackHeader = {
  headerStyle: { backgroundColor: colors.cream },
  headerShadowVisible: false,
  headerTintColor: colors.emerald,
  headerTitleStyle: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink },
  headerBackButtonDisplayMode: "minimal",
  contentStyle: { backgroundColor: colors.cream },
};

/** Shared tab bar look for the store, vendor and admin tabs. */
export const tabBarOptions = {
  headerStyle: { backgroundColor: colors.cream },
  headerShadowVisible: false,
  headerTitleStyle: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink },
  tabBarActiveTintColor: colors.emerald,
  tabBarInactiveTintColor: colors.muted,
  tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 12 },
  tabBarStyle: { borderTopColor: colors.line, backgroundColor: colors.white },
  sceneStyle: { backgroundColor: colors.cream },
};
