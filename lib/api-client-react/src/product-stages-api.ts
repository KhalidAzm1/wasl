/**
 * Product Stages API hooks
 * Custom stages checklist per bank-product combination.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProductStage {
  id: number;
  productId: number;
  name: string;
  displayOrder: number;
  completed: boolean;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export function getProductStagesQueryKey(productId: number) {
  return ["product-stages", productId] as const;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useProductStages(productId: number, options?: { enabled?: boolean }) {
  return useQuery<ProductStage[]>({
    queryKey: getProductStagesQueryKey(productId),
    queryFn: () => customFetch<ProductStage[]>(`/api/products/${productId}/stages`),
    enabled: options?.enabled ?? true,
  });
}

export function useAddProductStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, name, notes }: { productId: number; name: string; notes?: string }) =>
      customFetch<ProductStage>(`/api/products/${productId}/stages`, {
        method: "POST",
        body: JSON.stringify({ name, notes }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: getProductStagesQueryKey(vars.productId) });
    },
  });
}

export function usePatchProductStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      productId,
      ...body
    }: {
      id: number;
      productId: number;
      name?: string;
      completed?: boolean;
      notes?: string;
    }) =>
      customFetch<ProductStage>(`/api/product-stages/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: getProductStagesQueryKey(vars.productId) });
    },
  });
}

export function useDeleteProductStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; productId: number }) =>
      customFetch<{ ok: boolean }>(`/api/product-stages/${id}`, { method: "DELETE" }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: getProductStagesQueryKey(vars.productId) });
    },
  });
}
