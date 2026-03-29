export * from "./generated/api";
export * from "./generated/api.schemas";
export { customFetch, setBaseUrl, setAuthTokenGetter } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";

import type { UseQueryOptions } from "@tanstack/react-query";

export type QueryOpts<T, TError = unknown> = Omit<
  UseQueryOptions<T, TError, T>,
  "queryKey" | "queryFn"
>;
