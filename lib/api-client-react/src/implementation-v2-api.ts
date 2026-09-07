/**
 * Implementation v2 API hooks
 * Flexible, configurable stages per bank.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryKey, UseQueryOptions, UseQueryResult, UseMutationResult } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StageV2 {
  id: number;
  bankId: string;
  productId: number | null;
  trackType: "business" | "technical";
  activityType: "standard" | "nda" | "commercial_agreement" | "custom_agreement";
  name: string;
  displayOrder: number;
  percentage: number;
  status: "not_started" | "in_progress" | "under_review" | "completed" | "on_hold" | "skipped" | "blocked";
  skipped: boolean;
  completed: boolean;
  startedAt: string | null;
  completedAt: string | null;
  plannedDays: number | null;
  actualDays: number | null;
  varianceDays: number | null;
  owner: string | null;
  notes: string | null;
  daysInProgress: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubStageV2 {
  id: number;
  stageId: number;
  name: string;
  displayOrder: number;
  status: "not_started" | "in_progress" | "completed" | "skipped" | "blocked";
  skipped: boolean;
  completed: boolean;
  completedAt: string | null;
  owner: string | null;
  notes: string | null;
}

export interface BankStagesViewV2 {
  stages: StageV2[];
  completionPercentage: number;
  completedStages: number;
  remainingStages: number;
  skippedStages: number;
  totalStages: number;
  currentStageId: number | null;
  currentStageName: string | null;
  isBlocked: boolean;
  percentageMode: "dynamic" | "fixed";
}

export interface BankSummaryV2 {
  bankId: string;
  completionPercentage: number;
  completedStages: number;
  remainingStages: number;
  skippedStages: number;
  totalStages: number;
  currentStageId: number | null;
  currentStageName: string | null;
  isBlocked: boolean;
  percentageMode: "dynamic" | "fixed";
  ndaStatus: string | null;
  ndaOwner: string | null;
  ndaUpdatedAt: string | null;
  agreementStatus: string | null;
  agreementOwner: string | null;
  agreementUpdatedAt: string | null;
  agreementActivitiesTotal: number;
  agreementActivitiesCompleted: number;
  legalStatuses: Array<{
    productId: number;
    productCode: string;
    ndaStatus: string | null;
    ndaOwner: string | null;
    ndaUpdatedAt: string | null;
    agreementStatus: string | null;
    agreementOwner: string | null;
    agreementUpdatedAt: string | null;
  }>;
}

export interface ImplementationSettingsV2 {
  percentage_mode: "dynamic" | "fixed";
  default_stages: string; // JSON string of string[]
}

export interface PatchStageBodyV2 {
  name?: string;
  status?: string;
  skipped?: boolean;
  completed?: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  plannedDays?: number | null;
  owner?: string | null;
  notes?: string | null;
}

export interface NdaStatusHistoryV2 {
  id: number;
  stageId: number;
  fromStatus: string | null;
  toStatus: string;
  changedById: string | null;
  changedByName: string | null;
  changedAt: string;
}
export type AgreementStatusHistoryV2 = NdaStatusHistoryV2;
export interface AgreementCommentV2 { id: number; stageId: number; body: string; authorId: string | null; authorName: string | null; createdAt: string; }

export interface PatchSubStageBody {
  name?: string;
  status?: string;
  skipped?: boolean;
  completed?: boolean;
  completedAt?: string | null;
  owner?: string | null;
  notes?: string | null;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export type ImplementationTrackType = "business" | "technical";
export const getBankStagesV2QueryKey = (bankId: string, track: ImplementationTrackType = "business", productId?: number): QueryKey => [`/api/v2/banks/${bankId}/stages`, track, productId ?? null];
export const getSubStagesV2QueryKey = (stageId: number): QueryKey => [`/api/v2/stages/${stageId}/sub-stages`];
export const getImplSummaryV2QueryKey = (): QueryKey => ["/api/v2/implementation/summary"];
export const getImplSettingsV2QueryKey = (): QueryKey => ["/api/v2/admin/implementation-settings"];
export const getNdaStatusHistoryQueryKey = (stageId: number): QueryKey => ["/api/v2/stages", stageId, "nda-history"];
export const getAgreementStatusHistoryQueryKey = (stageId: number): QueryKey => ["/api/v2/stages", stageId, "agreement-history"];
export const getAgreementCommentsQueryKey = (stageId: number): QueryKey => ["/api/v2/stages", stageId, "agreement-comments"];

// ── Fetchers ──────────────────────────────────────────────────────────────────

const productParam = (productId?: number) => productId ? `&productId=${productId}` : "";
const fetchBankStages = (bankId: string, track: ImplementationTrackType, productId?: number) => customFetch<BankStagesViewV2>(`/api/v2/banks/${bankId}/stages?track=${track}${productParam(productId)}`);
const fetchSubStages = (stageId: number) => customFetch<SubStageV2[]>(`/api/v2/stages/${stageId}/sub-stages`);
const fetchImplSummaryV2 = () => customFetch<BankSummaryV2[]>("/api/v2/implementation/summary");
const fetchImplSettings = () => customFetch<ImplementationSettingsV2>("/api/v2/admin/implementation-settings");
const fetchNdaStatusHistory = (stageId: number) => customFetch<NdaStatusHistoryV2[]>("/api/v2/stages/" + stageId + "/nda-history");
const fetchAgreementStatusHistory = (stageId: number) => customFetch<AgreementStatusHistoryV2[]>("/api/v2/stages/" + stageId + "/agreement-history");
const fetchAgreementComments = (stageId: number) => customFetch<AgreementCommentV2[]>("/api/v2/stages/" + stageId + "/agreement-comments");

// ── Query hooks ───────────────────────────────────────────────────────────────

export function useNdaStatusHistory(stageId: number, enabled = true) {
  return useQuery({ queryKey: getNdaStatusHistoryQueryKey(stageId), queryFn: () => fetchNdaStatusHistory(stageId), enabled });
}
export function useAgreementStatusHistory(stageId: number, enabled = true) {
  return useQuery({ queryKey: getAgreementStatusHistoryQueryKey(stageId), queryFn: () => fetchAgreementStatusHistory(stageId), enabled });
}
export function useAgreementComments(stageId: number, enabled = true) {
  return useQuery({ queryKey: getAgreementCommentsQueryKey(stageId), queryFn: () => fetchAgreementComments(stageId), enabled });
}
export function useAddAgreementComment(stageId: number) {
  const qc = useQueryClient();
  return useMutation<AgreementCommentV2, ErrorType<unknown>, { body: string }>({
    mutationFn: ({ body }) => customFetch<AgreementCommentV2>("/api/v2/stages/" + stageId + "/agreement-comments", { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: getAgreementCommentsQueryKey(stageId) }),
  });
}

export function useGetBankStagesV2(
  bankId: string,
  track: ImplementationTrackType = "business",
  productId?: number,
  options?: { query?: Partial<UseQueryOptions<BankStagesViewV2, ErrorType<unknown>>> }
): UseQueryResult<BankStagesViewV2, ErrorType<unknown>> & { queryKey: QueryKey } {
  const qk = getBankStagesV2QueryKey(bankId, track, productId);
  const q = useQuery({ queryKey: qk, queryFn: () => fetchBankStages(bankId, track, productId), enabled: !!bankId && (productId === undefined || !!productId), ...options?.query });
  return { ...q, queryKey: qk };
}

export function useGetImplSummaryV2(
  options?: { query?: Partial<UseQueryOptions<BankSummaryV2[], ErrorType<unknown>>> }
): UseQueryResult<BankSummaryV2[], ErrorType<unknown>> & { queryKey: QueryKey } {
  const qk = getImplSummaryV2QueryKey();
  const q = useQuery({ queryKey: qk, queryFn: fetchImplSummaryV2, ...options?.query });
  return { ...q, queryKey: qk };
}

export function useGetSubStagesV2(stageId: number | null) {
  return useQuery({ queryKey: getSubStagesV2QueryKey(stageId ?? 0), queryFn: () => fetchSubStages(stageId!), enabled: stageId !== null });
}

export function useGetImplSettingsV2() {
  return useQuery({ queryKey: getImplSettingsV2QueryKey(), queryFn: fetchImplSettings, staleTime: 60_000 });
}

// ── Mutation helpers (optimistic) ─────────────────────────────────────────────

type MutFn<TArgs, TResult = BankStagesViewV2> = (args: TArgs) => Promise<TResult>;

function useBankStagesMutation<TArgs>(bankId: string, track: ImplementationTrackType, productId: number | undefined, fn: MutFn<TArgs>): UseMutationResult<BankStagesViewV2, ErrorType<unknown>, TArgs> {
  const qc = useQueryClient();
  const qk = getBankStagesV2QueryKey(bankId, track, productId);
  return useMutation<BankStagesViewV2, ErrorType<unknown>, TArgs>({
    mutationFn: fn,
    onSuccess: (data, args) => {
      qc.setQueryData(qk, data);
      qc.invalidateQueries({ queryKey: getImplSummaryV2QueryKey() });
      const stageId = (args as { stageId?: number }).stageId;
      if (stageId) qc.invalidateQueries({ queryKey: getNdaStatusHistoryQueryKey(stageId) });
      if (stageId) qc.invalidateQueries({ queryKey: getAgreementStatusHistoryQueryKey(stageId) });
    },
  });
}

// ── Mutation hooks ────────────────────────────────────────────────────────────

export function useAddStageV2(bankId: string, track: ImplementationTrackType = "business", productId?: number) {
  return useBankStagesMutation(bankId, track, productId, ({ name }: { name: string }) =>
    customFetch<BankStagesViewV2>(`/api/v2/banks/${bankId}/stages?track=${track}${productParam(productId)}`, { method: "POST", body: JSON.stringify({ name }) })
  );
}

export function useReorderStagesV2(bankId: string, track: ImplementationTrackType = "business", productId?: number) {
  return useBankStagesMutation(bankId, track, productId, ({ orderedIds }: { orderedIds: number[] }) =>
    customFetch<BankStagesViewV2>(`/api/v2/banks/${bankId}/stages/reorder?track=${track}${productParam(productId)}`, { method: "POST", body: JSON.stringify({ orderedIds }) })
  );
}

export function usePatchStageV2(bankId: string, track: ImplementationTrackType = "business", productId?: number) {
  return useBankStagesMutation<{ stageId: number; data: PatchStageBodyV2 }>(bankId, track, productId, ({ stageId, data }) =>
    customFetch<BankStagesViewV2>(`/api/v2/stages/${stageId}`, { method: "PATCH", body: JSON.stringify(data) })
  );
}

export function useDeleteStageV2(bankId: string, track: ImplementationTrackType = "business", productId?: number) {
  return useBankStagesMutation<{ stageId: number }>(bankId, track, productId, ({ stageId }) =>
    customFetch<BankStagesViewV2>(`/api/v2/stages/${stageId}`, { method: "DELETE" })
  );
}

export function useAddAgreementActivity(bankId: string, productId?: number) {
  return useBankStagesMutation<{ name: string; owner?: string | null }>(bankId, "business", productId, ({ name, owner }) =>
    customFetch<BankStagesViewV2>(`/api/v2/banks/${bankId}/agreement-activities?productId=${productId ?? ""}`, { method: "POST", body: JSON.stringify({ name, owner }) })
  );
}

export function useAdvanceImplementationStage(bankId: string, track: ImplementationTrackType, productId?: number) {
  return useBankStagesMutation<Record<string, never>>(bankId, track, productId, () =>
    customFetch<BankStagesViewV2>(`/api/v2/banks/${bankId}/stages/advance?track=${track}${productParam(productId)}`, { method: "POST" })
  );
}

export function useAddSubStageV2() {
  const qc = useQueryClient();
  return useMutation<SubStageV2, ErrorType<unknown>, { stageId: number; name: string }>({
    mutationFn: ({ stageId, name }) =>
      customFetch<SubStageV2>(`/api/v2/stages/${stageId}/sub-stages`, { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: (_, { stageId }) => { qc.invalidateQueries({ queryKey: getSubStagesV2QueryKey(stageId) }); },
  });
}

export function usePatchSubStageV2() {
  const qc = useQueryClient();
  return useMutation<SubStageV2, ErrorType<unknown>, { subStageId: number; stageId: number; data: PatchSubStageBody }>({
    mutationFn: ({ subStageId, data }) =>
      customFetch<SubStageV2>(`/api/v2/sub-stages/${subStageId}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: (_, { stageId }) => { qc.invalidateQueries({ queryKey: getSubStagesV2QueryKey(stageId) }); },
  });
}

export function useDeleteSubStageV2() {
  const qc = useQueryClient();
  return useMutation<void, ErrorType<unknown>, { subStageId: number; stageId: number }>({
    mutationFn: ({ subStageId }) =>
      customFetch<void>(`/api/v2/sub-stages/${subStageId}`, { method: "DELETE" }),
    onSuccess: (_, { stageId }) => { qc.invalidateQueries({ queryKey: getSubStagesV2QueryKey(stageId) }); },
  });
}

export function usePatchImplSettingsV2() {
  const qc = useQueryClient();
  return useMutation<ImplementationSettingsV2, ErrorType<unknown>, Partial<ImplementationSettingsV2>>({
    mutationFn: (data) =>
      customFetch<ImplementationSettingsV2>("/api/v2/admin/implementation-settings", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: (data) => {
      qc.setQueryData(getImplSettingsV2QueryKey(), data);
      qc.invalidateQueries({ queryKey: getImplSummaryV2QueryKey() });
    },
  });
}
