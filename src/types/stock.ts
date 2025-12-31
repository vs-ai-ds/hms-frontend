// src/types/stock.ts
export type StockItemType = "MEDICINE" | "EQUIPMENT" | "CONSUMABLE";

export interface StockItem {
  id: string;
  type: StockItemType;
  name: string;
  generic_name?: string | null;
  form?: string | null;
  strength?: string | null;
  route?: string | null;
  default_dosage?: string | null;
  default_frequency?: string | null;
  default_duration?: string | null;
  default_instructions?: string | null;
  current_stock?: number;
  reorder_level?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}



