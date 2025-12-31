// src/app/lib/api/stockItems.ts
import { apiClient } from "@app/lib/apiClient";
import type { StockItem } from "../../../types/stock";

export interface SearchStockItemsParams {
  search?: string;
  type?: "MEDICINE" | "EQUIPMENT" | "CONSUMABLE";
  limit?: number;
  include_inactive?: boolean;
  sort_by?: "name" | "type" | "current_stock";
  sort_dir?: "asc" | "desc";
}

export type CreateStockItemPayload = Omit<StockItem, "id" | "created_at" | "updated_at">;
export type UpdateStockItemPayload = Partial<Omit<StockItem, "id" | "created_at" | "updated_at">>;

export async function searchStockItems(params: SearchStockItemsParams = {}): Promise<StockItem[]> {
  const res = await apiClient.get<StockItem[]>("/stock-items", { params });
  return res.data;
}

export async function getStockItem(id: string): Promise<StockItem> {
  const res = await apiClient.get<StockItem>(`/stock-items/${id}`);
  return res.data;
}

export async function createStockItem(data: CreateStockItemPayload): Promise<StockItem> {
  const res = await apiClient.post<StockItem>("/stock-items", data);
  return res.data;
}

export async function updateStockItem(id: string, data: UpdateStockItemPayload): Promise<StockItem> {
  const res = await apiClient.patch<StockItem>(`/stock-items/${id}`, data);
  return res.data;
}

export async function toggleStockItemActive(id: string, is_active: boolean): Promise<StockItem> {
  return updateStockItem(id, { is_active });
}

// Prescription helper (only medicines; excludes inactive by default)
export async function searchMedicines(search?: string, limit: number = 20): Promise<StockItem[]> {
  return searchStockItems({ search, type: "MEDICINE", limit, include_inactive: false });
}