export type NearbyPaginationInput = {
  page: number;
  pageSize: number;
  totalLoaded: number;
  maxPages: number;
};

export const shouldHaveMorePages = ({
  page,
  pageSize,
  totalLoaded,
  maxPages,
}: NearbyPaginationInput): boolean => {
  if (page < 1) return false;
  if (page >= maxPages) return false;
  if (page >= 2) {
    return totalLoaded >= page * pageSize;
  }
  return totalLoaded >= pageSize;
};
