import React from "react";
import { Stack, router } from "expo-router";
import { EmptyState, Screen } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <Screen>
        <EmptyState icon="compass-outline" title="This page doesn’t exist" message="It may have moved. Let’s get you back to the store." actionLabel="Go to the store" onAction={() => router.replace("/")} />
      </Screen>
    </>
  );
}
