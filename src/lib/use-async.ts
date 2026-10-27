"use client";

import { useEffect, useRef, useState } from "react";

export function useAsync<T>(loader: () => Promise<T>, key = "") {
  const loaderRef = useRef(loader);
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  useEffect(() => {
    let cancelled = false;

    loaderRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "No se pudieron cargar los datos.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key, tick]);

  return {
    ...state,
    reload: () => setTick((value) => value + 1),
  };
}
