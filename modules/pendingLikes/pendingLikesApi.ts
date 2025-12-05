import { fetchPendingLikes } from "@/modules/pendingLikes/api";
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";

export const pendingLikesApi = createApi({
  reducerPath: "pendingLikesApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["PendingLikes"],
  endpoints: (builder) => ({
    getPendingLikes: builder.query<
      { count: number },
      void
    >({
      queryFn: async () => {
        try {
          const res = await fetchPendingLikes();
          return { data: { count: res.count } };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      providesTags: [{ type: "PendingLikes", id: "LIST" }],
      keepUnusedDataFor: __DEV__ ? 30 : 60, // cache for 1 minute in prod
    }),
  }),
});

export const { useGetPendingLikesQuery, util: pendingLikesUtil } = pendingLikesApi;
