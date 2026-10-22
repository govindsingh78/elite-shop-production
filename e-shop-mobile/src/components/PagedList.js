import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { EmptyState, Notice } from "@/components/ui";
import { colors } from "@/theme";

/**
 * Infinite list over a Laravel paginator ({ data, current_page, last_page, total }).
 * `fetchPage(page)` returns the paginator; changing `deps` (e.g. filters) starts again from page 1.
 */
export default function PagedList({ fetchPage, deps = [], renderItem, header, empty, onTotal, contentStyle, numColumns, columnWrapperStyle }) {
  const queryKey = JSON.stringify(deps);
  // Rows are tagged with the query they belong to, so a filter change shows the spinner until new rows arrive.
  const [result, setResult] = useState({ key: null, items: [], page: 1, last: 1 });
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef({ fetchPage, onTotal, queryKey });
  const requestId = useRef(0);

  useEffect(() => {
    latest.current = { fetchPage, onTotal, queryKey };
  });

  const load = useCallback(async (page, key) => {
    const id = ++requestId.current;
    try {
      const paginator = await latest.current.fetchPage(page);
      if (id !== requestId.current) return;
      const rows = paginator.data || [];
      setResult((current) => ({
        key,
        items: page === 1 || current.key !== key ? rows : [...current.items, ...rows.filter((row) => !current.items.some((existing) => existing.id === row.id))],
        page: paginator.current_page || page,
        last: paginator.last_page || 1,
      }));
      latest.current.onTotal?.(paginator.total ?? rows.length);
      setError("");
    } catch (loadError) {
      if (id === requestId.current) {
        setError(loadError.message);
        setResult((current) => ({ ...current, key }));
      }
    } finally {
      if (id === requestId.current) {
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load(1, queryKey);
  }, [load, queryKey]);

  // Coming back from a detail or edit screen quietly refreshes the first page.
  const visited = useRef(false);
  useFocusEffect(useCallback(() => {
    if (visited.current) load(1, latest.current.queryKey);
    visited.current = true;
  }, [load]));

  const loading = result.key !== queryKey;

  const loadMore = () => {
    if (loading || loadingMore || result.page >= result.last) return;
    setLoadingMore(true);
    load(result.page + 1, queryKey);
  };

  const refresh = () => {
    setRefreshing(true);
    load(1, queryKey);
  };

  const helpers = {
    replace: (next) => setResult((current) => ({ ...current, items: current.items.map((row) => (row.id === next.id ? next : row)) })),
    remove: (rowId) => setResult((current) => ({ ...current, items: current.items.filter((row) => row.id !== rowId) })),
  };

  return (
    <FlatList
      data={loading ? [] : result.items}
      keyExtractor={(item) => String(item.id)}
      numColumns={numColumns}
      columnWrapperStyle={columnWrapperStyle}
      renderItem={({ item, index }) => renderItem(item, index, helpers)}
      ListHeaderComponent={(
        <View>
          {header}
          {error ? <Notice tone="error" message={error} style={{ marginBottom: 12 }} /> : null}
        </View>
      )}
      ListEmptyComponent={loading ? <ActivityIndicator color={colors.emerald} size="large" style={{ marginTop: 50 }} /> : !error ? (empty || <EmptyState title="Nothing here yet" />) : null}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.emerald} style={{ marginVertical: 18 }} /> : null}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      refreshing={refreshing}
      onRefresh={refresh}
      contentContainerStyle={[{ padding: 16, paddingBottom: 40 }, contentStyle]}
      style={{ backgroundColor: colors.cream }}
      keyboardShouldPersistTaps="handled"
    />
  );
}
