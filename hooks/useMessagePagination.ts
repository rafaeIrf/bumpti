import { useCallback, useState } from 'react';

/**
 * Hook para gerenciar paginação de mensagens
 */
export function useMessagePagination(initialLimit = 50) {
  const [limit, setLimit] = useState(initialLimit);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = useCallback(() => {
    setLimit((prev) => prev + 50);
  }, []);

  const reset = useCallback(() => {
    setLimit(initialLimit);
    setHasMore(true);
  }, [initialLimit]);

  return {
    limit,
    hasMore,
    loadMore,
    reset,
    setHasMore,
  };
}
