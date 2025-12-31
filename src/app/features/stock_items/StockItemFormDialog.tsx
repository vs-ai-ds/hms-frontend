// src/app/features/stock_items/StockItemFormDialog.tsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Tooltip from "@mui/material/Tooltip";

import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@app/components/common/ToastProvider";
import type { StockItem, StockItemType } from "../../../types/stock";
import { createStockItem, updateStockItem } from "@app/lib/api/stockItems";

/* ---------------------- OPTIONS ---------------------- */

const FORM_OPTIONS = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Injection",
  "Ointment",
  "Cream",
  "Drops",
  "Inhaler",
  "Suspension",
  "Powder",
  "Other",
] as const;

const ROUTE_OPTIONS = [
  "Oral",
  "IV",
  "IM",
  "SC",
  "Topical",
  "Sublingual",
  "Inhalation",
  "Ophthalmic",
  "Nasal",
  "Rectal",
  "Vaginal",
  "Other",
] as const;

type FormOption = (typeof FORM_OPTIONS)[number];
type RouteOption = (typeof ROUTE_OPTIONS)[number];

/* ---------------------- SCHEMA ---------------------- */

const schema = z
  .object({
    type: z.enum(["MEDICINE", "CONSUMABLE", "EQUIPMENT"]),
    name: z.string().trim().min(1, "Name is required"),

    generic_name: z.string().trim().optional().nullable(),

    form: z
      .enum(FORM_OPTIONS, { errorMap: () => ({ message: "Invalid form" }) })
      .optional()
      .nullable(),

    strength: z.string().trim().optional().nullable(),

    route: z
      .enum(ROUTE_OPTIONS, { errorMap: () => ({ message: "Invalid route" }) })
      .optional()
      .nullable(),

    default_dosage: z.string().trim().optional().nullable(),
    default_frequency: z.string().trim().optional().nullable(),
    default_duration: z.string().trim().optional().nullable(),

    default_instructions: z.string().trim().max(500).optional().nullable(),

    current_stock: z.coerce.number().int().min(0, "Must be ≥ 0").default(0),
    reorder_level: z.coerce.number().int().min(0, "Must be ≥ 0").default(0),

    is_active: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    // Required fields for MEDICINE only
    if (data.type === "MEDICINE") {
      const req: Array<[keyof typeof data, string]> = [
        ["form", "Form is required for medicines"],
        ["strength", "Strength is required for medicines"],
        ["default_dosage", "Default dosage is required for medicines"],
        ["default_frequency", "Default frequency is required for medicines"],
        ["default_duration", "Default duration is required for medicines"],
      ];
      req.forEach(([key, msg]) => {
        const v = data[key];
        if (!v || (typeof v === "string" && v.trim() === "")) {
          ctx.addIssue({ path: [key], code: z.ZodIssueCode.custom, message: msg });
        }
      });
    }

    // If one of dose/freq/duration is filled, require all 3 (for ANY type)
    // This keeps defaults consistent (but MEDICINE already requires them).
    const trio = [data.default_dosage, data.default_frequency, data.default_duration];
    const filled = trio.filter((v) => v && v.trim() !== "").length;
    if (filled > 0 && filled < 3) {
      (["default_dosage", "default_frequency", "default_duration"] as const).forEach((k) => {
        if (!data[k] || data[k]!.trim() === "") {
          ctx.addIssue({
            path: [k],
            code: z.ZodIssueCode.custom,
            message: "Please complete dosage + frequency + duration together",
          });
        }
      });
    }
  });

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void; 
  onUpdated?: () => void;
  item?: StockItem | null;
}

function extractApiErrorMessage(err: any): string | null {
  // Handles common FastAPI + Axios shapes:
  // - { detail: "..." }
  // - { detail: [{ msg: "..." }, ...] } (validation)
  // - { message: "..." }
  const detail = err?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) return detail.trim();

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    const msg = first?.msg || first?.message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }

  const msg = err?.response?.data?.message || err?.message;
  if (typeof msg === "string" && msg.trim()) return msg.trim();

  return null;
}

const StockItemFormDialog: React.FC<Props> = ({ open, onClose, onCreated, onUpdated, item }) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!item;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? {
          type: item.type,
          name: item.name,
          generic_name: item.generic_name || "",
          form: (item.form as FormOption) || undefined,
          strength: item.strength || "",
          route: (item.route as RouteOption) || undefined,
          default_dosage: item.default_dosage || "",
          default_frequency: item.default_frequency || "",
          default_duration: item.default_duration || "",
          default_instructions: item.default_instructions || "",
          current_stock: (item as any).current_stock ?? 0,
          reorder_level: (item as any).reorder_level ?? 0,
          is_active: item.is_active,
        }
      : {
          type: "MEDICINE",
          name: "",
          generic_name: "",
          form: undefined,
          strength: "",
          route: undefined,
          default_dosage: "",
          default_frequency: "",
          default_duration: "",
          default_instructions: "",
          current_stock: 0,
          reorder_level: 0,
          is_active: true,
        },
  });

  React.useEffect(() => {
    if (item) {
      reset({
        type: item.type,
        name: item.name,
        generic_name: item.generic_name || "",
        form: (item.form as FormOption) || undefined,
        strength: item.strength || "",
        route: (item.route as RouteOption) || undefined,
        default_dosage: item.default_dosage || "",
        default_frequency: item.default_frequency || "",
        default_duration: item.default_duration || "",
        default_instructions: item.default_instructions || "",
        current_stock: (item as any).current_stock ?? 0,
        reorder_level: (item as any).reorder_level ?? 0,
        is_active: item.is_active,
      });
    } else {
      reset({
        type: "MEDICINE",
        name: "",
        generic_name: "",
        form: undefined,
        strength: "",
        route: undefined,
        default_dosage: "",
        default_frequency: "",
        default_duration: "",
        default_instructions: "",
        current_stock: 0,
        reorder_level: 0,
        is_active: true,
      });
    }
  }, [item, reset]);

  const selectedType = useWatch({ control, name: "type" }) as StockItemType;
  const isMedicine = selectedType === "MEDICINE";

  // If user changes type while creating, auto-clear medicine-only fields when switching away from MEDICINE.
  React.useEffect(() => {
    if (!isEdit && selectedType !== "MEDICINE") {
      setValue("form", undefined);
      setValue("strength", "");
      setValue("route", undefined);
      setValue("default_dosage", "");
      setValue("default_frequency", "");
      setValue("default_duration", "");
      setValue("default_instructions", "");
    }
  }, [selectedType, isEdit, setValue]);

  const normalizePayload = (data: FormValues) => ({
    ...data,
    generic_name: data.generic_name || null,
    form: data.form || null,
    strength: data.strength || null,
    route: data.route || null,
    default_dosage: data.default_dosage || null,
    default_frequency: data.default_frequency || null,
    default_duration: data.default_duration || null,
    default_instructions: data.default_instructions || null,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return createStockItem(normalizePayload(data) as any);
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "stock-items",
      });

      showSuccess(
        t("notifications.stockItemCreated", {
          defaultValue: `"{{name}}" created successfully.`,
          name: created?.name ?? "Stock item",
        })
      );

      // Important: callback must be defined in props, otherwise it was throwing at runtime.
      onCreated?.();
    },
    onError: (e: any) => {
      const msg =
        extractApiErrorMessage(e) ||
        t("notifications.stockItemCreateError", { defaultValue: "Failed to create stock item." });

      showError(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return updateStockItem(item!.id, normalizePayload(data) as any);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] === "stock-items" || q.queryKey[0] === "stock-item"),
      });

      showSuccess(
        t("notifications.stockItemUpdated", {
          defaultValue: `"{{name}}" updated successfully.`,
          name: updated?.name ?? "Stock item",
        })
      );

      onUpdated?.();
    },
    onError: (e: any) => {
      const msg =
        extractApiErrorMessage(e) ||
        t("notifications.stockItemUpdateError", { defaultValue: "Failed to update stock item." });

      showError(msg);
    },
  });

  const onSubmit = (data: FormValues) => {
    if (isEdit) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  const help = (text: string) => (
    <Tooltip title={text}>
      <InfoOutlinedIcon fontSize="inherit" sx={{ ml: 0.5, cursor: "help" }} />
    </Tooltip>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={{ "& .MuiPaper-root": { borderRadius: 2 } }}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>
          {isEdit
            ? t("stockItems.editTitle", { defaultValue: "Edit Stock Item" })
            : t("stockItems.createTitle", { defaultValue: "Create Stock Item" })}
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* ROW 1: Type + Status */}
            <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth size="small" error={!!errors.type} variant="outlined">
                    <InputLabel id="type-label" required>
                      {t("stockItems.type", { defaultValue: "Type" })}
                    </InputLabel>
                    <Select
                      {...field}
                      labelId="type-label"
                      label={t("stockItems.type", { defaultValue: "Type" })}
                      required
                      disabled={isEdit}
                    >
                      <MenuItem value="MEDICINE">
                        {t("stockItems.medicine", { defaultValue: "Medicine" })}
                      </MenuItem>
                      <MenuItem value="EQUIPMENT">
                        {t("stockItems.equipment", { defaultValue: "Equipment" })}
                      </MenuItem>
                      <MenuItem value="CONSUMABLE">
                        {t("stockItems.consumable", { defaultValue: "Consumable" })}
                      </MenuItem>
                    </Select>
                    <FormHelperText>
                      {errors.type?.message ??
                        (isEdit
                          ? t("stockItems.typeLockedHelp", {
                              defaultValue: "Type can’t be changed after creation.",
                            })
                          : t("stockItems.typeHelp", {
                              defaultValue: "Decides required fields and prescription behavior.",
                            }))}
                    </FormHelperText>
                  </FormControl>
                )}
              />

              <Controller
                name="is_active"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth size="small" variant="outlined">
                    <InputLabel id="status-label">
                      {t("stockItems.status", { defaultValue: "Status" })}
                    </InputLabel>
                    <Select
                      {...field}
                      labelId="status-label"
                      label={t("stockItems.status", { defaultValue: "Status" })}
                      value={field.value ? "active" : "inactive"}
                      onChange={(e) => field.onChange(e.target.value === "active")}
                    >
                      <MenuItem value="active">
                        {t("stockItems.active", { defaultValue: "Active" })}
                      </MenuItem>
                      <MenuItem value="inactive">
                        {t("stockItems.inactive", { defaultValue: "Inactive" })}
                      </MenuItem>
                    </Select>
                    <FormHelperText>
                      {t("stockItems.statusHelp", {
                        defaultValue: "Inactive items are hidden from prescription search.",
                      })}
                    </FormHelperText>
                  </FormControl>
                )}
              />
            </Box>

            {/* ROW 2: Name + Generic */}
            <Box sx={{ display: "flex", gap: 2 }}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={t("stockItems.name", { defaultValue: "Display Name" })}
                    required
                    error={!!errors.name}
                    helperText={
                      errors.name?.message ??
                      t("stockItems.nameHelp", {
                        defaultValue:
                          "What staff will search/select (e.g., Paracetamol 500 mg).",
                      })
                    }
                    fullWidth
                    size="small"
                  />
                )}
              />
              <Controller
                name="generic_name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={t("stockItems.genericName", { defaultValue: "Generic Name" })}
                    error={!!errors.generic_name}
                    helperText={
                      errors.generic_name?.message ??
                      t("stockItems.genericNameHelp", {
                        defaultValue: "Optional. Useful for medicine search grouping.",
                      })
                    }
                    fullWidth
                    size="small"
                    disabled={!isMedicine}
                  />
                )}
              />
            </Box>

            {/* Show medicine-only fields only when MEDICINE */}
            {isMedicine && (
              <>
                {/* ROW 3: Form + Strength */}
                <Box sx={{ display: "flex", gap: 2 }}>
                  <Controller
                    name="form"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth size="small" error={!!errors.form} variant="outlined">
                        <InputLabel id="form-label" required>
                          {t("stockItems.form", { defaultValue: "Form" })}
                        </InputLabel>
                        <Select
                          {...field}
                          labelId="form-label"
                          label={t("stockItems.form", { defaultValue: "Form" })}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange((e.target.value || undefined) as FormOption | undefined)
                          }
                          required
                        >
                          {FORM_OPTIONS.map((opt) => (
                            <MenuItem key={opt} value={opt}>
                              {opt}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          {errors.form?.message ?? (
                            <>
                              {t("stockItems.formHelp", {
                                defaultValue: "Tablet / Syrup / Injection etc.",
                              })}
                              {help(
                                t("stockItems.formHelpMore", {
                                  defaultValue:
                                    "This keeps prescriptions consistent (no Tab vs Tablet mismatch).",
                                })
                              )}
                            </>
                          )}
                        </FormHelperText>
                      </FormControl>
                    )}
                  />

                  <Controller
                    name="strength"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label={t("stockItems.strength", { defaultValue: "Strength" })}
                        required
                        error={!!errors.strength}
                        helperText={
                          errors.strength?.message ?? (
                            <>
                              {t("stockItems.strengthHelp", {
                                defaultValue: "e.g., 500 mg, 250 mg/5 ml, 2%.",
                              })}
                              {help(
                                t("stockItems.strengthHelpMore", {
                                  defaultValue: "Used to distinguish variants in search.",
                                })
                              )}
                            </>
                          )
                        }
                        size="small"
                        fullWidth
                      />
                    )}
                  />
                </Box>

                {/* ROW 4: Route + Default Dosage */}
                <Box sx={{ display: "flex", gap: 2 }}>
                  <Controller
                    name="route"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth size="small" error={!!errors.route} variant="outlined">
                        <InputLabel id="route-label">
                          {t("stockItems.route", { defaultValue: "Route" })}
                        </InputLabel>
                        <Select
                          {...field}
                          labelId="route-label"
                          label={t("stockItems.route", { defaultValue: "Route" })}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange((e.target.value || undefined) as RouteOption | undefined)
                          }
                        >
                          {ROUTE_OPTIONS.map((opt) => (
                            <MenuItem key={opt} value={opt}>
                              {opt}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          {errors.route?.message ?? (
                            <>
                              {t("stockItems.routeHelp", {
                                defaultValue: "Oral / IV / IM / Topical etc.",
                              })}
                              {help(
                                t("stockItems.routeHelpMore", {
                                  defaultValue: "Helps avoid IV vs IM confusion.",
                                })
                              )}
                            </>
                          )}
                        </FormHelperText>
                      </FormControl>
                    )}
                  />

                  <Controller
                    name="default_dosage"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label={t("stockItems.defaultDosage", { defaultValue: "Default Dosage" })}
                        required
                        error={!!errors.default_dosage}
                        helperText={
                          errors.default_dosage?.message ??
                          t("stockItems.defaultDosageHelp", { defaultValue: "e.g., 1 tablet, 5 ml." })
                        }
                        size="small"
                        fullWidth
                      />
                    )}
                  />
                </Box>

                {/* ROW 5: Frequency + Duration */}
                <Box sx={{ display: "flex", gap: 2 }}>
                  <Controller
                    name="default_frequency"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label={t("stockItems.defaultFrequency", { defaultValue: "Default Frequency" })}
                        required
                        error={!!errors.default_frequency}
                        helperText={
                          errors.default_frequency?.message ??
                          t("stockItems.defaultFrequencyHelp", { defaultValue: "e.g., OD, BD, TDS." })
                        }
                        size="small"
                        fullWidth
                      />
                    )}
                  />
                  <Controller
                    name="default_duration"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label={t("stockItems.defaultDuration", { defaultValue: "Default Duration" })}
                        required
                        error={!!errors.default_duration}
                        helperText={
                          errors.default_duration?.message ??
                          t("stockItems.defaultDurationHelp", { defaultValue: "e.g., 5 days, 7 days." })
                        }
                        size="small"
                        fullWidth
                      />
                    )}
                  />
                </Box>

                {/* ROW 6: Instructions */}
                <Controller
                  name="default_instructions"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label={t("stockItems.defaultInstructions", { defaultValue: "Default Instructions" })}
                      error={!!errors.default_instructions}
                      helperText={
                        errors.default_instructions?.message ??
                        t("stockItems.defaultInstructionsHelp", {
                          defaultValue: "Pre-filled text such as ‘Take after food’.",
                        })
                      }
                      fullWidth
                      multiline
                      rows={3}
                      size="small"
                    />
                  )}
                />
              </>
            )}

            {/* ROW: Stock numbers (keep for all types; still “master-level”) */}
            <Box sx={{ display: "flex", gap: 2 }}>
              <Controller
                name="current_stock"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    label={t("stockItems.currentStock", { defaultValue: "Current Stock" })}
                    error={!!errors.current_stock}
                    helperText={
                      errors.current_stock?.message ??
                      t("stockItems.currentStockHelp", {
                        defaultValue: "Simple count used for low-stock hinting.",
                      })
                    }
                    size="small"
                    fullWidth
                    inputProps={{ min: 0 }}
                  />
                )}
              />
              <Controller
                name="reorder_level"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    label={t("stockItems.reorderLevel", { defaultValue: "Reorder Level" })}
                    error={!!errors.reorder_level}
                    helperText={
                      errors.reorder_level?.message ??
                      t("stockItems.reorderLevelHelp", {
                        defaultValue: "Alert when stock ≤ this value.",
                      })
                    }
                    size="small"
                    fullWidth
                    inputProps={{ min: 0 }}
                  />
                )}
              />
            </Box>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
          >
            {isSubmitting || createMutation.isPending || updateMutation.isPending
              ? t("common.saving", { defaultValue: "Saving..." })
              : isEdit
              ? t("common.save", { defaultValue: "Save" })
              : t("common.create", { defaultValue: "Create" })}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default StockItemFormDialog;