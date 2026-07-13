/**
 * Implementation Progress API hooks
 * Hand-written hooks (same pattern as generated api.ts) for the
 * /api/banks/:bankId/implementation endpoints.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  MutationFunction,
  QueryFunction,
  QueryKey,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

// ── Types ─────────────────────────────────────────────────────────────────

export interface ImplementationStageRow {
  id: number;
  bankId: string;
  stage: string;
  stageName: string;
  stageIndex: number;
  status: "not_started" | "in_progress" | "completed" | "blocked";
  completed: boolean;
  completedAt: string | null;
  notes: string | null;
  owner: string | null;
  daysInCurrentStage: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BankImplementationView {
  stages: ImplementationStageRow[];
  completionPercentage: number;
  currentStage: string | null;
  currentStageName: string | null;
  remainingStages: number;
  isBlocked: boolean;
}

export interface BankImplementationSummary {
  bankId: string;
  completionPercentage: number;
  currentStage: string | null;
  currentStageName: string | null;
  remainingStages: number;
  isBlocked: boolean;
}

export interface PatchImplementationStageBody {
  status?: string;
  completed?: boolean;
  completedAt?: string | null;
  notes?: string | null;
  owner?: string | null;
}

// ── Query keys ────────────────────────────────────────────────────────────

export const getGetBankImplementationQueryKey = (bankId: string): QueryKey =>
  [`/api/banks/${bankId}/implementation`] as const;

export const getGetImplementationSummaryQueryKey = (): QueryKey =>
  ["/api/implementation/summary"] as const;

// ── Fetchers ──────────────────────────────────────────────────────────────

export const getBankImplementation = (bankId: string): Promise<BankImplementationView> =>
  customFetch(`/api/banks/${bankId}/implementation`);

export const getImplementationSummary = (): Promise<BankImplementationSummary[]> =>
  customFetch("/api/implementation/summary");

export const patchImplementationStage = (
  bankId: string,
  stage: string,
  data: PatchImplementationStageBody
): Promise<BankImplementationView> =>
  customFetch(`/api/banks/${bankId}/implementation/${stage}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

// ── Hooks ─────────────────────────────────────────────────────────────────

export const useGetBankImplementation = <TData = BankImplementationView, TError = ErrorType<unknown>>(
  bankId: string,
  options?: { query?: Partial<UseQueryOptions<BankImplementationView, TError, TData>> }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } => {
  const queryKey = options?.query?.queryKey ?? getGetBankImplementationQueryKey(bankId);
  const query = useQuery({
    queryKey,
    queryFn: () => getBankImplementation(bankId),
    enabled: !!bankId,
    ...options?.query,
  } as UseQueryOptions<BankImplementationView, TError, TData>);
  return { ...query, queryKey } as UseQueryResult<TData, TError> & { queryKey: QueryKey };
};

export const useGetImplementationSummary = <TData = BankImplementationSummary[], TError = ErrorType<unknown>>(
  options?: { query?: Partial<UseQueryOptions<BankImplementationSummary[], TError, TData>> }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } => {
  const queryKey = options?.query?.queryKey ?? getGetImplementationSummaryQueryKey();
  const query = useQuery({
    queryKey,
    queryFn: getImplementationSummary,
    ...options?.query,
  } as UseQueryOptions<BankImplementationSummary[], TError, TData>);
  return { ...query, queryKey } as UseQueryResult<TData, TError> & { queryKey: QueryKey };
};

type PatchImplementationStageMutationArgs = {
  bankId: string;
  stage: string;
  data: PatchImplementationStageBody;
};

export const usePatchImplementationStage = <TError = ErrorType<unknown>, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<BankImplementationView, TError, PatchImplementationStageMutationArgs, TContext>;
  }
): UseMutationResult<BankImplementationView, TError, PatchImplementationStageMutationArgs, TContext> => {
  const mutationFn: MutationFunction<BankImplementationView, PatchImplementationStageMutationArgs> = ({
    bankId,
    stage,
    data,
  }) => patchImplementationStage(bankId, stage, data);

  return useMutation({ mutationFn, ...options?.mutation });
};
