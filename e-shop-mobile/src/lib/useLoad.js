import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

/**
 * Loads data for a screen. Returns { data, setData, loading, refreshing, error, reload, refresh }.
 * Changing `deps` loads again. With `refocus`, the data is refreshed quietly whenever the screen
 * comes back into view (e.g. after editing something on another screen).
 */
export function useLoad(loader, deps = [], { refocus = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const loaderRef = useRef(loader);
  const hasLoaded = useRef(false);

  useEffect(() => {
    loaderRef.current = loader;
  });

  const run = useCallback(async (mode) => {
    try {
      const result = await loaderRef.current();
      setData(result);
      setError("");
      hasLoaded.current = true;
    } catch (loadError) {
      // Keep showing what we had if a quiet refresh fails.
      if (mode !== "quiet" || !hasLoaded.current) setError(loadError.message || "Something went wrong.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    run("initial");
    // `deps` are the caller's inputs to `loader`; the latest loader is read from loaderRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(useCallback(() => {
    if (refocus && hasLoaded.current) run("quiet");
  }, [refocus, run]));

  const reload = useCallback(() => {
    setRefreshing(true);
    run("refresh");
  }, [run]);
  const refresh = useCallback(() => run("quiet"), [run]);

  return { data, setData, loading, refreshing, error, reload, refresh };
}
