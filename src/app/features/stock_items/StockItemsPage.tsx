// src/app/features/stock_items/StockItemsPage.tsx
import React from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  CircularProgress,
  Chip,
  IconButton,
  Button,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Divider,
  Alert,
  TableSortLabel,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  FormHelperText,
  TablePagination,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  Edit as EditIcon,
  Add as AddIcon,
  Inbox as EmptyIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  Warning as WarningIcon,
  Inventory as InventoryIcon,
  PowerSettingsNew as PowerSettingsNewIcon,
  PowerOff as PowerOffIcon,
} from "@mui/icons-material";

import { getStockItem, searchStockItems, toggleStockItemActive } from "@app/lib/api/stockItems";
import PermissionGuard from "@app/components/common/PermissionGuard";
import PageToolbar from "@app/components/common/PageToolbar";
import ConfirmationDialog from "@app/components/common/ConfirmationDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@app/store/authStore";
import { can } from "@app/lib/abac";
import { useToast } from "@app/components/common/ToastProvider";
import type { StockItem, StockItemType } from "../../../types/stock";
import StockItemFormDialog from "./StockItemFormDialog";


type SortKey = "name" | "type" | "current_stock";

const StockItemsPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const user = useAuthStore((s) => s.user);

  const canCreate = can(user, "stock_items:manage");
  const canUpdate = can(user, "stock_items:manage");

  // Create/Edit dialog
  const [openForm, setOpenForm] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<StockItem | null>(null);

  // Detail dialog
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null);

  // Confirm dialogs
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = React.useState(false);
  const [confirmActivateOpen, setConfirmActivateOpen] = React.useState(false);
  const [itemToToggle, setItemToToggle] = React.useState<StockItem | null>(null);

  // Filters
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<StockItemType | "">(""); // "" => All
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive">("active");

  // Sorting
  const [sortBy, setSortBy] = React.useState<SortKey>("name");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  // Pagination (client-side)
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  // Debounce search input -> search, min 2 chars, keep focus
  React.useEffect(() => {
    const handle = setTimeout(() => {
      const v = searchInput.trim();
      if (v.length === 0 || v.length >= 2) {
        setSearch(v);
        // keep focus reliably
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // reset to first page when filters/search change
  React.useEffect(() => {
    setPage(0);
  }, [search, typeFilter, statusFilter]);

  const includeInactive = statusFilter !== "active";

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["stock-items", search || undefined, typeFilter || undefined, includeInactive],
    queryFn: () =>
      searchStockItems({
        search: search || undefined,
        type: (typeFilter as any) || undefined,
        include_inactive: includeInactive || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const stockItems = data ?? [];

  // Filter by status locally (backend supports include_inactive only)
  const filteredItems = React.useMemo(() => {
    if (statusFilter === "inactive") return stockItems.filter((x) => !x.is_active);
    if (statusFilter === "active") return stockItems.filter((x) => x.is_active);
    return stockItems;
  }, [stockItems, statusFilter]);

  const sortedItems = React.useMemo(() => {
    const items = [...filteredItems];
    const dir = sortDirection === "asc" ? 1 : -1;

    items.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name) * dir;
      if (sortBy === "type") return a.type.localeCompare(b.type) * dir;
      if (sortBy === "current_stock") {
        const av = a.current_stock ?? 0;
        const bv = b.current_stock ?? 0;
        if (av === bv) return 0;
        return av > bv ? dir : -dir;
      }
      return 0;
    });
    return items;
  }, [filteredItems, sortBy, sortDirection]);

  const pagedItems = React.useMemo(() => {
    const start = page * rowsPerPage;
    return sortedItems.slice(start, start + rowsPerPage);
  }, [sortedItems, page, rowsPerPage]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDirection((p) => (p === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDirection("asc");
    }
  };

  const handleCreate = () => {
    setSelectedItem(null);
    setOpenForm(true);
  };

  const handleEdit = (item: StockItem) => {
    setSelectedItem(item);
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setSelectedItem(null);
  };

  const handleView = (item: StockItem) => {
    setSelectedItemId(item.id);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedItemId(null);
  };

  // Detail query only when dialog open
  const { data: stockItemDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["stock-item", selectedItemId],
    queryFn: () => (selectedItemId ? getStockItem(selectedItemId) : null),
    enabled: !!selectedItemId && detailOpen,
  });

  // Single toggle mutation (activate/deactivate)
  type ToggleVars = { id: string; is_active: boolean; name?: string };

  const toggleActiveMutation = useMutation<StockItem, any, ToggleVars>({
    mutationFn: (vars) => toggleStockItemActive(vars.id, vars.is_active),

    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] === "stock-items" || q.queryKey[0] === "stock-item"),
      });

      const displayName =
        vars.name ?? data?.name ?? t("stockItems.item", { defaultValue: "Stock item" });

      showSuccess(
        vars.is_active
          ? t("notifications.stockItemActivated", {
              defaultValue: `"{{name}}" activated successfully.`,
              name: displayName,
            })
          : t("notifications.stockItemDeactivated", {
              defaultValue: `"{{name}}" deactivated successfully.`,
              name: displayName,
            })
      );

      setItemToToggle(null);
    },

    onError: (error: any, vars) => {
      const displayName = vars.name ?? t("stockItems.item", { defaultValue: "Stock item" });

      showError(
        error?.response?.data?.detail ||
          (vars.is_active
            ? t("notifications.stockItemActivateError", {
                defaultValue: `Failed to activate "${displayName}".`,
              })
            : t("notifications.stockItemDeactivateError", {
                defaultValue: `Failed to deactivate "${displayName}".`,
              }))
      );

      setItemToToggle(null);
    },
  });
  
  const openDeactivateConfirm = (item: StockItem) => {
    if (!item.is_active) return;
    setItemToToggle(item);
    setConfirmActivateOpen(false);
    setConfirmDeactivateOpen(true);
  };

  const openActivateConfirm = (item: StockItem) => {
    if (item.is_active) return;
    setItemToToggle(item);
    setConfirmDeactivateOpen(false);
    setConfirmActivateOpen(true);
  };

  const cancelDeactivateConfirm = () => {
    setConfirmDeactivateOpen(false);
    setItemToToggle(null);
  };
  
  const cancelActivateConfirm = () => {
    setConfirmActivateOpen(false);
    setItemToToggle(null);
  };

  const confirmDeactivate = () => {
    if (!itemToToggle) return;
    setConfirmDeactivateOpen(false);
    toggleActiveMutation.mutate({
      id: itemToToggle.id,
      is_active: false,
      name: itemToToggle.name,
    });
  };
  
  const confirmActivate = () => {
    if (!itemToToggle) return;
    setConfirmActivateOpen(false);
    toggleActiveMutation.mutate({
      id: itemToToggle.id,
      is_active: true, 
      name: itemToToggle.name,
    });
  };

  if (isLoading && !data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* HEADER ROW */}
      <PageToolbar
        title={t("stockItems.title", { defaultValue: "Stock Items" })}
        subtitle={t("stockItems.subtitle", {
          defaultValue: "Manage medicines, consumables and equipment catalog.",
        })}
        titleIcon={<InventoryIcon sx={{ fontSize: 32 }} />}
        primaryAction={
          canCreate
            ? {
                label: t("stockItems.create", { defaultValue: "Create Stock Item" }),
                onClick: handleCreate,
                icon: <AddIcon />,
              }
            : undefined
        }
      />
      {/* SEARCH + FILTERS (perfect alignment) */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          mb: 2,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <TextField
          size="small"
          inputRef={searchRef}
          label={t("stockItems.searchPlaceholder", {
            defaultValue: "Search by name or generic name...",
          })}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{ minWidth: 260, maxWidth: 360 }}
          helperText=" "
        />

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="type-filter-label" shrink>
            {t("stockItems.type", { defaultValue: "Type" })}
          </InputLabel>

          <Select
            labelId="type-filter-label"
            value={typeFilter}
            label={t("stockItems.type", { defaultValue: "Type" })}
            onChange={(e) => setTypeFilter(e.target.value as StockItemType | "")}
            displayEmpty
            notched
            renderValue={(val) =>
              !val || val === "" ? t("common.all", { defaultValue: "All" }) : String(val)
            }
          >
            <MenuItem value="">{t("common.all", { defaultValue: "All" })}</MenuItem>
            <MenuItem value="MEDICINE">{t("stockItems.medicine", { defaultValue: "Medicine" })}</MenuItem>
            <MenuItem value="CONSUMABLE">{t("stockItems.consumable", { defaultValue: "Consumable" })}</MenuItem>
            <MenuItem value="EQUIPMENT">{t("stockItems.equipment", { defaultValue: "Equipment" })}</MenuItem>
          </Select>

          <FormHelperText sx={{ visibility: "hidden" }}>.</FormHelperText>
        </FormControl>

        {canUpdate && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="status-filter-label">
              {t("stockItems.status", { defaultValue: "Status" })}
            </InputLabel>
            <Select
              labelId="status-filter-label"
              value={statusFilter}
              label={t("stockItems.status", { defaultValue: "Status" })}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "active" | "inactive")
              }
              displayEmpty
            >
              <MenuItem value="active">
                {t("stockItems.activeOnly", { defaultValue: "Active Only" })}
              </MenuItem>
              <MenuItem value="inactive">
                {t("stockItems.inactiveOnly", { defaultValue: "Inactive Only" })}
              </MenuItem>
              <MenuItem value="all">{t("stockItems.all", { defaultValue: "All" })}</MenuItem>
            </Select>
            <FormHelperText sx={{ visibility: "hidden" }}>.</FormHelperText>
          </FormControl>
        )}

        {/* subtle fetching indicator without shaking */}
        {isFetching ? (
          <Box sx={{ display: "flex", alignItems: "center", height: 40 }}>
            <Typography variant="caption" color="text.secondary">
              {t("common.loading", { defaultValue: "Loading..." })}
            </Typography>
          </Box>
        ) : null}
      </Box>
      {/* TABLE */}
      <Paper
        elevation={2}
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid rgba(0, 0, 0, 0.05)",
        }}
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: "36%" }}>
                  <TableSortLabel
                    active={sortBy === "name"}
                    direction={sortBy === "name" ? sortDirection : "asc"}
                    onClick={() => handleSort("name")}
                  >
                    {t("stockItems.name", { defaultValue: "Name" })}
                  </TableSortLabel>
                </TableCell>

                <TableCell sx={{ width: "12%" }}>
                  <TableSortLabel
                    active={sortBy === "type"}
                    direction={sortBy === "type" ? sortDirection : "asc"}
                    onClick={() => handleSort("type")}
                  >
                    {t("stockItems.type", { defaultValue: "Type" })}
                  </TableSortLabel>
                </TableCell>

                <TableCell sx={{ width: "22%" }}>
                  {t("stockItems.formStrength", { defaultValue: "Form / Strength" })}
                </TableCell>

                <TableCell sx={{ width: "12%" }}>
                  <TableSortLabel
                    active={sortBy === "current_stock"}
                    direction={sortBy === "current_stock" ? sortDirection : "asc"}
                    onClick={() => handleSort("current_stock")}
                  >
                    {t("stockItems.currentStockShort", { defaultValue: "Stock" })}
                  </TableSortLabel>
                </TableCell>

                <TableCell sx={{ width: "10%" }}>
                  {t("stockItems.status", { defaultValue: "Status" })}
                </TableCell>

                <TableCell align="right" sx={{ width: "8%" }}>
                  {t("common.actions", { defaultValue: "Actions" })}
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {pagedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 7 }}>
                    <EmptyIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2, opacity: 0.45 }} />
                    <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                      {t("stockItems.empty", { defaultValue: "No stock items found" })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("stockItems.emptyDescription", {
                        defaultValue: search
                          ? "Try adjusting your search or filters."
                          : "Get started by creating your first stock item.",
                      })}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                pagedItems.map((item) => {
                  const current = item.current_stock ?? 0;
                  const reorder = item.reorder_level ?? 0;
                  const isLowStock = reorder > 0 && current <= reorder;
                  const formStrength = [item.form || undefined, item.strength || undefined]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <TableRow
                      key={item.id}
                      hover
                      onClick={() => handleView(item)}
                      sx={{ cursor: "pointer" }}
                    >
                      {/* Name + Generic (generic only if exists) */}
                      <TableCell sx={{ maxWidth: 360 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Tooltip title={item.name}>
                              <Typography variant="body2" fontWeight={600} noWrap>
                                {item.name}
                              </Typography>
                            </Tooltip>

                            {item.generic_name ? (
                              <Tooltip title={item.generic_name}>
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  {item.generic_name}
                                </Typography>
                              </Tooltip>
                            ) : null}
                          </Box>

                          {isLowStock ? <WarningIcon fontSize="small" color="warning" /> : null}
                        </Box>
                      </TableCell>

                      {/* Type */}
                      <TableCell>
                        <Chip
                          label={item.type}
                          size="small"
                          color={item.type === "MEDICINE" ? "primary" : "secondary"}
                          sx={{ borderRadius: 2 }}
                        />
                      </TableCell>

                      {/* Form/Strength */}
                      <TableCell sx={{ maxWidth: 260 }}>
                        {formStrength ? (
                          <Tooltip title={formStrength}>
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}
                            >
                              {formStrength}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.disabled">
                            —
                          </Typography>
                        )}
                      </TableCell>

                      {/* Stock */}
                      <TableCell>
                        <Typography
                          variant="body2"
                          color={isLowStock ? "error" : "inherit"}
                          fontWeight={isLowStock ? 700 : 400}
                        >
                          {current}
                        </Typography>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Chip
                          label={item.is_active ? "Active" : "Inactive"}
                          size="small"
                          color={item.is_active ? "success" : "default"}
                          sx={{ borderRadius: 2 }}
                        />
                      </TableCell>

                      {/* Actions */}
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title={t("common.view", { defaultValue: "View details" })}>
                            <IconButton size="small" onClick={() => handleView(item)} sx={{ borderRadius: 1 }}>
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <PermissionGuard permission="stock_items:manage">
                            <Tooltip title={t("common.edit", { defaultValue: "Edit" })}>
                              <IconButton size="small" onClick={() => handleEdit(item)} sx={{ borderRadius: 1 }}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </PermissionGuard>

                          <PermissionGuard permission="stock_items:manage">
                            <Tooltip title={item.is_active ? "Deactivate" : "Activate"}>
                              <IconButton
                                size="small"
                                sx={{ borderRadius: 1 }}
                                onClick={() => {
                                  if (item.is_active) openDeactivateConfirm(item);
                                  else openActivateConfirm(item);
                                }}
                                disabled={toggleActiveMutation.isPending}
                              >
                                {item.is_active ? (
                                  <PowerOffIcon fontSize="small" color="action" />
                                ) : (
                                  <PowerSettingsNewIcon fontSize="small" color="success" />
                                )}
                              </IconButton>
                            </Tooltip>
                          </PermissionGuard>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          component="div"
          count={sortedItems.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </Paper>
      {/* FORM DIALOG */}
      <StockItemFormDialog 
        open={openForm} 
        onClose={handleCloseForm}
        onCreated={() => {
          // Child dialog already showed success toast
          // Parent only needs to close dialog and refresh data
          handleCloseForm();
        }}
        onUpdated={() => {
          // Child dialog already showed success toast
          // Parent only needs to close dialog and refresh data
          handleCloseForm();
        }}
        item={selectedItem} 
      />
      {/* CONFIRM DEACTIVATE */}
      <ConfirmationDialog
        open={confirmDeactivateOpen}
        title={t("stockItems.confirmDeactivateTitle", { defaultValue: "Deactivate stock item" })}
        message={
          itemToToggle
            ? t("stockItems.confirmDeactivateMsg", {
                defaultValue: `Are you sure you want to deactivate "${itemToToggle.name}"?`,
              })
            : ""
        }
        confirmText={t("common.deactivate", { defaultValue: "Deactivate" })}
        cancelText={t("common.cancel", { defaultValue: "Cancel" })}
        onConfirm={confirmDeactivate}
        onClose={cancelDeactivateConfirm}
      />
      {/* CONFIRM ACTIVATE */}
      <ConfirmationDialog
        open={confirmActivateOpen}
        title={t("stockItems.confirmActivateTitle", { defaultValue: "Activate stock item" })}
        message={
          itemToToggle
            ? t("stockItems.confirmActivateMsg", {
                defaultValue: `Are you sure you want to activate "${itemToToggle.name}"?`,
              })
            : ""
        }
        confirmText={t("common.activate", { defaultValue: "Activate" })}
        cancelText={t("common.cancel", { defaultValue: "Cancel" })}
        onConfirm={confirmActivate}
        onClose={cancelActivateConfirm}
      />
      {/* DETAIL DIALOG */}
      <Dialog open={detailOpen} onClose={closeDetail} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="h6">
              {t("stockItems.details", { defaultValue: "Stock Item Details" })}
            </Typography>
            <IconButton onClick={closeDetail} size="large">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {detailLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : !stockItemDetail ? (
            <Alert severity="error">
              {t("common.loadError", { defaultValue: "Unable to load details." })}
            </Alert>
          ) : (
            <>
              {(() => {
                const current = stockItemDetail.current_stock ?? 0;
                const reorder = stockItemDetail.reorder_level ?? 0;
                const low = reorder > 0 && current <= reorder;

                return (
                  <>
                    {low && (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        {t("stockItems.lowStockAlert", {
                          defaultValue: "Low stock! Current stock is below reorder level.",
                        })}
                      </Alert>
                    )}

                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                      <Chip
                        label={stockItemDetail.type}
                        size="small"
                        color={stockItemDetail.type === "MEDICINE" ? "primary" : "secondary"}
                        sx={{ borderRadius: 2 }}
                      />
                      <Chip
                        label={stockItemDetail.is_active ? "Active" : "Inactive"}
                        size="small"
                        color={stockItemDetail.is_active ? "success" : "default"}
                        sx={{ borderRadius: 2 }}
                      />
                      {low ? (
                        <Chip label="Low stock" size="small" color="warning" variant="outlined" sx={{ borderRadius: 2 }} />
                      ) : null}
                    </Box>

                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Paper sx={{ p: 2, borderRadius: 3 }}>
                          <Typography variant="subtitle1" sx={{ mb: 1 }}>
                            {t("stockItems.summary", { defaultValue: "Summary" })}
                          </Typography>
                          <Divider sx={{ mb: 1 }} />
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                {t("stockItems.name", { defaultValue: "Name" })}
                              </Typography>
                              <Typography variant="body1" fontWeight={700}>
                                {stockItemDetail.name}
                              </Typography>
                            </Box>

                            {stockItemDetail.generic_name ? (
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  {t("stockItems.genericName", { defaultValue: "Generic Name" })}
                                </Typography>
                                <Typography variant="body2">{stockItemDetail.generic_name}</Typography>
                              </Box>
                            ) : null}

                            <Box sx={{ display: "flex", gap: 2 }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {t("stockItems.form", { defaultValue: "Form" })}
                                </Typography>
                                <Typography variant="body2">{stockItemDetail.form || "—"}</Typography>
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {t("stockItems.strength", { defaultValue: "Strength" })}
                                </Typography>
                                <Typography variant="body2">{stockItemDetail.strength || "—"}</Typography>
                              </Box>
                            </Box>

                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                {t("stockItems.route", { defaultValue: "Route" })}
                              </Typography>
                              <Typography variant="body2">{stockItemDetail.route || "—"}</Typography>
                            </Box>
                          </Box>
                        </Paper>
                      </Grid>

                      <Grid size={{ xs: 12, md: 6 }}>
                        <Paper sx={{ p: 2, borderRadius: 3 }}>
                          <Typography variant="subtitle1" sx={{ mb: 1 }}>
                            {t("stockItems.stockDefaults", { defaultValue: "Stock & Defaults" })}
                          </Typography>
                          <Divider sx={{ mb: 1 }} />
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            <Box sx={{ display: "flex", gap: 2 }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {t("stockItems.currentStock", { defaultValue: "Current Stock" })}
                                </Typography>
                                <Typography variant="h6" fontWeight={800} color={low ? "error" : "inherit"}>
                                  {current}
                                </Typography>
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {t("stockItems.reorderLevel", { defaultValue: "Reorder Level" })}
                                </Typography>
                                <Typography variant="body1" fontWeight={700}>
                                  {reorder}
                                </Typography>
                              </Box>
                            </Box>

                            <Divider sx={{ my: 1 }} />

                            <Box sx={{ display: "flex", gap: 2 }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {t("stockItems.defaultDosage", { defaultValue: "Default Dosage" })}
                                </Typography>
                                <Typography variant="body2">{stockItemDetail.default_dosage || "—"}</Typography>
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {t("stockItems.defaultFrequency", { defaultValue: "Default Frequency" })}
                                </Typography>
                                <Typography variant="body2">{stockItemDetail.default_frequency || "—"}</Typography>
                              </Box>
                            </Box>

                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                {t("stockItems.defaultDuration", { defaultValue: "Default Duration" })}
                              </Typography>
                              <Typography variant="body2">{stockItemDetail.default_duration || "—"}</Typography>
                            </Box>

                            {stockItemDetail.default_instructions ? (
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  {t("stockItems.defaultInstructions", { defaultValue: "Default Instructions" })}
                                </Typography>
                                <Typography variant="body2">{stockItemDetail.default_instructions}</Typography>
                              </Box>
                            ) : null}
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>
                  </>
                );
              })()}
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDetail} variant="outlined">
            {t("common.close", { defaultValue: "Close" })}
          </Button>

          {stockItemDetail && (
            <PermissionGuard permission="stock_items:manage">
              <Button
                variant="contained"
                onClick={() => {
                  setSelectedItem(stockItemDetail as any);
                  setOpenForm(true);
                }}
                startIcon={<EditIcon />}
              >
                {t("common.edit", { defaultValue: "Edit" })}
              </Button>
            </PermissionGuard>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StockItemsPage;