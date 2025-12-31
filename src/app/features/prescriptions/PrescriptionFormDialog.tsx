// src/app/features/prescriptions/PrescriptionFormDialog.tsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  IconButton,
  Typography,
  Box,
  Autocomplete,
  CircularProgress,
  Alert,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  prescriptionSchema,
  PrescriptionFormValues,
} from "@app/lib/validation/prescriptionValidation";
import { createPrescription, fetchPrescriptions, getPrescription, updatePrescription } from "@app/lib/api/prescriptions";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import { useToast } from "@app/components/common/ToastProvider";
import { useTranslation } from "react-i18next";
import { searchStockItems } from "@app/lib/api/stockItems";
import PatientMiniCard from "@app/components/patients/PatientMiniCard";
import ClinicalSnapshotPanel from "@app/components/patients/ClinicalSnapshotPanel";
import { getEligibleOPDAppointments } from "@app/lib/utils/appointmentEligibility";
import type { Appointment } from "../../../types/appointment";
import { createAppointment } from "@app/lib/api/appointments";
import { useAuthStore } from "@app/store/authStore";
import { can } from "@app/lib/abac";
import { getNext15MinuteSlot, toUTCISOString } from "@app/lib/dateTimeUtils";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialPatientId?: string;
  initialAppointmentId?: string;
  initialAdmissionId?: string;
  initialPrescriptionId?: string;
  onExistingRxFound?: (prescriptionId: string) => void;
}

interface MedicineRowProps {
  index: number;
  field: { id: string };
  control: any;
  register: any;
  errors: any;
  watch: any;
  setValue: any;
  clearErrors: any;
  remove: (index: number) => void;
  fieldsLength: number;
  searchTerms: Record<number, string>;
  setSearchTerms: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  debouncedSearchTerms: Record<number, string>;
  open: boolean;
  t: (key: string, options?: any) => string;
}

const MedicineRow: React.FC<MedicineRowProps> = ({
  index,
  field,
  control,
  register,
  errors,
  watch,
  setValue,
  clearErrors,
  remove,
  fieldsLength,
  searchTerms,
  setSearchTerms,
  debouncedSearchTerms,
  open,
  t,
}) => {
  const debouncedSearch = debouncedSearchTerms[index] || "";

  const {
    data: stockItems,
    isLoading: loadingStockItems,
    error: stockItemsError,
  } = useQuery({
    queryKey: ["stock-items", debouncedSearch, "MEDICINE", index],
    queryFn: () =>
      searchStockItems({
        search: debouncedSearch || undefined,
        type: "MEDICINE",
        limit: 20,
      }),
    enabled: open && debouncedSearch.length >= 2,
  });

  const currentMedicine = watch(`medicines.${index}`);
  const selectedStockItem =
    stockItems?.find((item: any) => item.id === currentMedicine?.stock_item_id) || null;

  const shrinkIfValue = (v: any) => v !== null && v !== undefined && String(v).trim() !== "";

  return (
    <Box key={field.id} sx={{ width: "100%", mb: 2 }}>
      <Grid container spacing={2}>
        {/* Row 1 */}
        <Grid size={{ xs: 12, sm: 1 }} sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography variant="body1" fontWeight={600}>
            {index + 1}.
          </Typography>
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name={`medicines.${index}.name` as const}
            control={control}
            render={({ field: nameField }) => (
              <Autocomplete
                freeSolo
                options={stockItems || []}
                loading={loadingStockItems}
                getOptionLabel={(option) => {
                  if (typeof option === "string") return option;
                  return option.name || "";
                }}
                groupBy={(option) => {
                  if (typeof option === "string") return "";
                  return option.type;
                }}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props;
                  if (typeof option === "string") return <li key={key} {...otherProps}>{option}</li>;
                  const label = `${option.name}${option.strength ? ` - ${option.strength}` : ""}${
                    option.form ? ` (${option.form})` : ""
                  } — ${option.type}`;
                  return <li key={key} {...otherProps}>{label}</li>;
                }}
                value={selectedStockItem}
                onChange={(_, newValue) => {
                  if (newValue && typeof newValue !== "string") {
                    setValue(`medicines.${index}.stock_item_id`, newValue.id);
                    setValue(`medicines.${index}.name`, newValue.name);
                    setSearchTerms((prev) => ({ ...prev, [index]: newValue.name }));

                    // Clear previous errors for this medicine row when stock item is selected
                    clearErrors(`medicines.${index}`);

                    // Prefill defaults only if empty
                    if (!currentMedicine?.dosage && newValue.default_dosage) {
                      setValue(`medicines.${index}.dosage`, newValue.default_dosage);
                    }
                    if (!currentMedicine?.frequency && newValue.default_frequency) {
                      setValue(`medicines.${index}.frequency`, newValue.default_frequency);
                    }
                    if (!currentMedicine?.duration && newValue.default_duration) {
                      setValue(`medicines.${index}.duration`, newValue.default_duration);
                    }
                    if (!currentMedicine?.instructions && newValue.default_instructions) {
                      setValue(`medicines.${index}.instructions`, newValue.default_instructions || "");
                    }
                  } else {
                    setValue(`medicines.${index}.stock_item_id`, null);
                    if (typeof newValue === "string") {
                      setValue(`medicines.${index}.name`, newValue);
                      setSearchTerms((prev) => ({ ...prev, [index]: newValue }));
                    } else if (newValue === null) {
                      setValue(`medicines.${index}.name`, "");
                      setSearchTerms((prev) => ({ ...prev, [index]: "" }));
                    }
                  }
                }}
                onInputChange={(_, newInputValue, reason) => {
                  if (reason === "input") {
                    setSearchTerms((prev) => ({ ...prev, [index]: newInputValue }));
                    setValue(`medicines.${index}.name`, newInputValue);

                    if (!selectedStockItem || selectedStockItem.name !== newInputValue) {
                      setValue(`medicines.${index}.stock_item_id`, null);
                    }
                  } else if (reason === "clear") {
                    setSearchTerms((prev) => ({ ...prev, [index]: "" }));
                  }
                }}
                inputValue={
                  selectedStockItem
                    ? selectedStockItem.name
                    : searchTerms[index] !== undefined
                      ? searchTerms[index]
                      : nameField.value || ""
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t("prescriptions.medicineName", { defaultValue: "Medicine Name" })}
                    error={!!errors.medicines?.[index]?.name}
                    helperText={
                      errors.medicines?.[index]?.name?.message ||
                      (stockItemsError
                        ? t("prescriptions.stockItemsLoadError", {
                            defaultValue:
                              "Couldn't load medicine suggestions. You can still type the medicine name manually.",
                          })
                        : undefined)
                    }
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingStockItems ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                noOptionsText={t("prescriptions.noMedicinesFound", {
                  defaultValue: "No medicines found. You can type a custom name.",
                })}
              />
            )}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 2 }}>
          <TextField
            label={t("prescriptions.dosage", { defaultValue: "Dosage" })}
            fullWidth
            {...register(`medicines.${index}.dosage` as const)}
            error={!!errors.medicines?.[index]?.dosage}
            helperText={errors.medicines?.[index]?.dosage?.message}
            InputLabelProps={{ shrink: shrinkIfValue(currentMedicine?.dosage) }}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 2 }}>
          <TextField
            label={t("prescriptions.frequency", { defaultValue: "Frequency" })}
            fullWidth
            {...register(`medicines.${index}.frequency` as const)}
            error={!!errors.medicines?.[index]?.frequency}
            helperText={errors.medicines?.[index]?.frequency?.message}
            InputLabelProps={{ shrink: shrinkIfValue(currentMedicine?.frequency) }}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 1 }} sx={{ display: "flex", alignItems: "center" }}>
          <IconButton aria-label="remove" onClick={() => remove(index)} disabled={fieldsLength === 1} size="small">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Grid>

        {/* Row 2 */}
        <Grid size={{ xs: 12, sm: 1 }} />
        <Grid size={{ xs: 12, sm: 1.5 }}>
          <TextField
            label={t("prescriptions.duration", { defaultValue: "Duration" })}
            fullWidth
            {...register(`medicines.${index}.duration` as const)}
            error={!!errors.medicines?.[index]?.duration}
            helperText={errors.medicines?.[index]?.duration?.message}
            InputLabelProps={{ shrink: shrinkIfValue(currentMedicine?.duration) }}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6.5 }}>
          <TextField
            label={t("prescriptions.instructions", { defaultValue: "Instructions" })}
            fullWidth
            {...register(`medicines.${index}.instructions` as const)}
            InputLabelProps={{ shrink: shrinkIfValue(currentMedicine?.instructions) }}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 2 }}>
          <Controller
            name={`medicines.${index}.quantity` as const}
            control={control}
            render={({ field }) => (
              <TextField
                label={t("prescriptions.quantity", { defaultValue: "Quantity" })}
                type="number"
                fullWidth
                inputProps={{ min: 1 }}
                value={field.value ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  field.onChange(value === "" ? null : Number(value));
                }}
                onBlur={field.onBlur}
                error={!!errors.medicines?.[index]?.quantity}
                helperText={errors.medicines?.[index]?.quantity?.message}
                required={true}
                InputLabelProps={{ shrink: currentMedicine?.quantity !== null && currentMedicine?.quantity !== undefined }}
              />
            )}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 1 }} />
      </Grid>
    </Box>
  );
};

const PrescriptionFormDialog: React.FC<Props> = ({
  open,
  onClose,
  onCreated,
  initialPatientId,
  initialAppointmentId,
  initialAdmissionId,
  initialPrescriptionId,
  onExistingRxFound,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const { user } = useAuthStore();

  // Helper function to determine if label should shrink (move to top)
  const shrinkIfValue = (v: any) => v !== null && v !== undefined && String(v).trim() !== "";

  const canViewDepartments = user ? can(user, "departments:view") : false;
  const canViewUsers = user ? can(user, "users:view") : false;
  const userRoles = user?.roles?.map((r: any) => r.name) || [];
  const isDoctor = userRoles.includes("DOCTOR");

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    clearErrors,
    formState: { isSubmitting, errors },
  } = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: {
      patient_id: initialPatientId || "",
      appointment_id: initialAppointmentId || null,
      admission_id: initialAdmissionId || null,
      medicines: [
        {
          stock_item_id: null,
          name: "",
          dosage: "",
          frequency: "",
          duration: "",
          instructions: "",
          quantity: null,
        },
      ],
    },
  });

  const selectedPatientId = watch("patient_id");
  const selectedAppointmentId = watch("appointment_id");
  const isEditMode = !!initialPrescriptionId;
  
  // Load prescription data for editing
  const { data: prescriptionData } = useQuery({
    queryKey: ["prescription", initialPrescriptionId],
    queryFn: async () => {
      if (!initialPrescriptionId) return null;
      return await getPrescription(initialPrescriptionId);
    },
    enabled: !!initialPrescriptionId && open,
  });

  // Populate form when prescription data loads
  React.useEffect(() => {
    if (prescriptionData && open && isEditMode) {
      reset({
        patient_id: prescriptionData.patient_id,
        appointment_id: prescriptionData.appointment_id || null,
        admission_id: prescriptionData.admission_id || null,
        chief_complaint: prescriptionData.chief_complaint || "",
        diagnosis: prescriptionData.diagnosis || "",
        medicines: (prescriptionData.items || []).map((item: any) => ({
          stock_item_id: item.stock_item_id || null,
          name: item.medicine_name || "",
          dosage: item.dosage || "",
          frequency: item.frequency || "",
          duration: item.duration || "",
          instructions: item.instructions || "",
          quantity: item.quantity ?? null,
        })),
      });
    }
  }, [prescriptionData, open, isEditMode, reset]);

  const patientIdToCheck = selectedPatientId || initialPatientId || prescriptionData?.patient_id;
  const { data: activeAdmissions } = useQuery({
    queryKey: ["admissions", "active", patientIdToCheck],
    queryFn: async () => {
      if (!patientIdToCheck) return [];
      try {
        const res = await apiClient.get("/admissions", {
          params: { patient_id: patientIdToCheck, status: "ACTIVE" },
        });
        return res.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!patientIdToCheck && open,
  });

  const hasActiveAdmission = !!(activeAdmissions && activeAdmissions.length > 0);
  const activeAdmission = activeAdmissions && activeAdmissions.length > 0 ? activeAdmissions[0] : null;
  
  const isWalkIn = selectedAppointmentId === "WALK_IN";
  const showDoctorDeptFields = !isDoctor && isWalkIn && !hasActiveAdmission;
  
  // State for walk-in doctor and department selection (for non-doctor users)
  const [walkInDoctorId, setWalkInDoctorId] = React.useState<string>("");
  const [walkInDepartmentId, setWalkInDepartmentId] = React.useState<string>("");

  const { data: patientsData } = useQuery({
    queryKey: ["patients", "for-prescription"],
    queryFn: async () => {
      let allPatients: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const res = await apiClient.get("/patients", {
          params: { page, page_size: 20 },
        });
        const data = res.data;

        if (data?.items && data.items.length > 0) {
          allPatients = [...allPatients, ...data.items];
          hasMore = allPatients.length < data.total;
          page++;
        } else {
          hasMore = false;
        }
        if (page > 50) break;
      }

      return { items: allPatients, total: allPatients.length };
    },
    enabled: open,
  });

  const eligiblePatients = React.useMemo(() => {
    if (!patientsData?.items) return [];
    return patientsData.items.filter((p: any) => !p.is_deceased);
  }, [patientsData]);

  const { data: patientAppointments } = useQuery({
    queryKey: ["appointments", selectedPatientId],
    queryFn: async () => {
      if (!selectedPatientId) return [];
      try {
        const res = await apiClient.get("/appointments", {
          params: { patient_id: selectedPatientId },
        });
        return res.data?.items || res.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!selectedPatientId && open,
  });

  const eligibleOPDAppointments = React.useMemo(() => {
    if (!patientAppointments) return [];
    return getEligibleOPDAppointments(patientAppointments as Appointment[]);
  }, [patientAppointments]);

  const { data: departments } = useQuery({
    queryKey: ["departments", "for_patients"],
    queryFn: async () => {
      const res = await apiClient.get("/departments", {
        params: { for_patients: true },
      });
      return res.data || [];
    },
    enabled: open && canViewDepartments,
  });

  // Fetch doctors list (for walk-in prescriptions when user is not a doctor)
  const { data: doctors } = useQuery({
    queryKey: ["users", "doctors", walkInDepartmentId],
    queryFn: async () => {
      const res = await apiClient.get("/users");
      let filtered = res.data.filter((u: any) => 
        u.roles?.some((r: any) => r.name === "DOCTOR") && u.is_active !== false
      );
      
      // Filter by department if selected
      if (walkInDepartmentId && departments) {
        const selectedDept = departments.find((d: any) => d.id === walkInDepartmentId);
        if (selectedDept) {
          filtered = filtered.filter((u: any) => {
            // Check if user's department matches the selected department
            if (u.department_id === walkInDepartmentId) return true;
            // Also check department name match (for backward compatibility)
            if (u.department === selectedDept.name) return true;
            return false;
          });
        }
      }
      
      return filtered;
    },
    enabled: open && canViewUsers && showDoctorDeptFields,
  });

  React.useEffect(() => {
    if (open && initialPatientId) {
      const admissionId = initialAdmissionId || (activeAdmission ? activeAdmission.id : null);
      reset({
        patient_id: initialPatientId,
        appointment_id: hasActiveAdmission ? null : initialAppointmentId || null,
        admission_id: hasActiveAdmission ? admissionId : null,
        chief_complaint: "",
        diagnosis: "",
        no_medicines: false,
        no_medicines_note: "",
        medicines: [
          {
            stock_item_id: null,
            name: "",
            dosage: "",
            frequency: "",
            duration: "",
            instructions: "",
            quantity: null,
          },
        ],
      });
    }
  }, [open, initialPatientId, initialAppointmentId, initialAdmissionId, activeAdmission, hasActiveAdmission, reset]);

  React.useEffect(() => {
    if (initialAppointmentId && selectedPatientId) {
      setValue("appointment_id", initialAppointmentId);
      return;
    }
    if (!initialAppointmentId && selectedPatientId && eligibleOPDAppointments.length > 0) {
      setValue("appointment_id", eligibleOPDAppointments[0].id);
    }
  }, [selectedPatientId, eligibleOPDAppointments, initialAppointmentId, setValue]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "medicines",
  });

  const [searchTerms, setSearchTerms] = React.useState<Record<number, string>>({});
  const [debouncedSearchTerms, setDebouncedSearchTerms] = React.useState<Record<number, string>>({});

  React.useEffect(() => {
    const timers: Record<number, ReturnType<typeof setTimeout>> = {};
    Object.keys(searchTerms).forEach((key) => {
      const index = Number(key);
      if (timers[index]) clearTimeout(timers[index]);
      timers[index] = setTimeout(() => {
        setDebouncedSearchTerms((prev) => ({ ...prev, [index]: searchTerms[index] }));
      }, 300);
    });
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
  }, [searchTerms]);

  const onSubmit = async (values: PrescriptionFormValues) => {
    try {
      let finalAppointmentId = values.appointment_id || null;
      let finalAdmissionId = values.admission_id || null;

      // For IPD prescriptions: ensure admission_id is set if patient has active admission
      // This must happen FIRST before any OPD validation checks
      if (hasActiveAdmission) {
        if (!finalAdmissionId && activeAdmission) {
          finalAdmissionId = activeAdmission.id;
          // Also set it in the form values to ensure it's tracked
          setValue("admission_id", activeAdmission.id, { shouldValidate: false });
        }
        // Clear appointment_id for IPD prescriptions (we're creating IPD, not OPD)
        if (finalAppointmentId) {
          finalAppointmentId = null;
        }
      }

      // Block OPD Rx if active admission and no admission_id chosen
      // Only check this if we're NOT creating an IPD prescription (no admission_id set)
      if (hasActiveAdmission && finalAppointmentId && !finalAdmissionId) {
        showError(
          t("appointments.activeAdmissionBlocked", {
            defaultValue:
              "Cannot create OPD prescription for patient with active admission. Please create IPD prescription instead.",
          })
        );
        return;
      }
      
      // Log for debugging
      console.log("Prescription submission:", {
        hasActiveAdmission,
        activeAdmissionId: activeAdmission?.id,
        finalAppointmentId,
        finalAdmissionId,
        valuesAdmissionId: values.admission_id,
      });

      if (finalAppointmentId === "WALK_IN") {
        // Only block WALK_IN if we're creating an OPD prescription (no admission_id)
        // If we're creating an IPD prescription (admission_id is set), allow it
        if (hasActiveAdmission && !finalAdmissionId) {
          showError(
            t("appointments.activeAdmissionBlocked", {
              defaultValue:
                "Cannot create OPD prescription for patient with active admission. Please discharge the patient first.",
            })
          );
          return;
        }

        try {
          let departmentId: string | null = null;
          let doctorUserId: string | null = null;

          // For non-doctor users, require doctor and department selection
          if (!isDoctor) {
            if (!walkInDoctorId) {
              showError(
                t("prescriptions.doctorRequired", {
                  defaultValue: "Please select a doctor for the walk-in appointment.",
                })
              );
              return;
            }
            if (!walkInDepartmentId) {
              showError(
                t("prescriptions.departmentRequired", {
                  defaultValue: "Please select a department for the walk-in appointment.",
                })
              );
              return;
            }
            departmentId = walkInDepartmentId;
            doctorUserId = walkInDoctorId;
          } else {
            // For doctor users, use their own info
            if (user?.department && departments && departments.length > 0) {
              const userDept = departments.find((d: any) => d.name === user.department);
              if (userDept) departmentId = userDept.id;
            }
            if (!departmentId && departments && departments.length > 0) {
              departmentId = departments[0].id;
            }

            if (!user?.id) {
              showError(t("prescriptions.userRequired", { defaultValue: "User information not available." }));
              return;
            }

            doctorUserId = user.id;
          }

          // For walk-in appointments, select the next available 15-minute slot
          const nextSlot = getNext15MinuteSlot(0); // Get next 15-minute slot from now
          const scheduledAtISO = toUTCISOString(nextSlot);

          const walkInAppointment = await createAppointment({
            patient_id: values.patient_id,
            department_id: departmentId || undefined,
            doctor_user_id: doctorUserId,
            scheduled_at: scheduledAtISO,
          });

          if (!walkInAppointment?.id) {
            showError(
              t("prescriptions.walkInAppointmentError", {
                defaultValue: "Failed to create walk-in appointment - no appointment ID returned",
              })
            );
            return;
          }

          finalAppointmentId = walkInAppointment.id;
        } catch (error: any) {
          const errorDetail = error?.response?.data?.detail || "";
          showError(
            errorDetail ||
              t("prescriptions.walkInAppointmentError", { defaultValue: "Failed to create walk-in appointment" })
          );
          return;
        }
      }

      if (!finalAppointmentId && !finalAdmissionId) {
        showError(
          t("prescriptions.appointmentOrAdmissionRequired", {
            defaultValue: "Please select an appointment (OPD) or admission (IPD).",
          })
        );
        return;
      }

      if (isEditMode && initialPrescriptionId) {
        // Update existing prescription
        const updatePayload = {
          chief_complaint: values.chief_complaint || null,
          diagnosis: values.diagnosis || null,
          items: values.no_medicines
            ? []
            : (values.medicines || []).map((med) => ({
                stock_item_id: med.stock_item_id || null,
                medicine_name: med.name,
                dosage: med.dosage,
                frequency: med.frequency,
                duration: med.duration,
                instructions: med.instructions || null,
                quantity: med.quantity || null, // Always send quantity (required for all medicines)
              })),
        };

        try {
          const updatedPrescription = await updatePrescription(initialPrescriptionId, updatePayload);
          reset();
          setSearchTerms({});
          setDebouncedSearchTerms({});
          
          // Extract prescription details for success message
          const patientName = updatedPrescription?.patient_name || "Patient";
          const prescriptionCode = updatedPrescription?.prescription_code || initialPrescriptionId?.substring(0, 8) || "";
          
          // Show success toast (single source of truth - child dialog shows toast)
          showSuccess(
            t("prescriptions.updateSuccessDetailed", {
              defaultValue: "Prescription {{code}} updated successfully for {{name}}.",
              code: prescriptionCode,
              name: patientName,
            })
          );
          
          // Let parent close dialog and refresh data (don't call onClose here)
          onCreated();
          return;
        } catch (updateError: any) {
          const errorDetail = updateError?.response?.data?.detail || "";
          // Check if update actually succeeded (status 200 with detail message)
          if (updateError?.response?.status === 200 && updateError?.response?.data?.detail) {
            // Update succeeded but response building had issues
            showSuccess(
              t("prescriptions.updateSuccess", { 
                defaultValue: "Prescription updated successfully. Some details may not be visible immediately." 
              })
            );
            onCreated();
            onClose();
            return;
          }
          showError(
            errorDetail ||
              t("prescriptions.updateError", { 
                defaultValue: "Failed to update prescription. Please check your input and try again." 
              })
          );
          return;
        }
      }

      // Create new prescription
      const payload = {
        patient_id: values.patient_id,
        appointment_id: finalAppointmentId || undefined, // Send undefined instead of null
        admission_id: finalAdmissionId || undefined, // Send undefined instead of null
        chief_complaint: values.chief_complaint || null,
        diagnosis: values.diagnosis || null,
        items: values.no_medicines
          ? []
          : (values.medicines || []).map((med) => ({
              stock_item_id: med.stock_item_id || null,
              medicine_name: med.name,
              dosage: med.dosage,
              frequency: med.frequency,
              duration: med.duration,
              instructions: med.instructions || null,
              quantity: med.stock_item_id ? med.quantity : null,
            })),
      };

      try {
        const createdPrescription = await createPrescription(payload);
        reset();
        setSearchTerms({});
        setDebouncedSearchTerms({});
        
        // Extract prescription details for success message
        const patientName = createdPrescription?.patient_name || "Patient";
        const prescriptionCode = createdPrescription?.prescription_code || "";
        
        // Show success toast (single source of truth - child dialog shows toast)
        showSuccess(
          t("prescriptions.createSuccessDetailed", {
            defaultValue: "Prescription {{code}} created successfully for {{name}}.",
            code: prescriptionCode,
            name: patientName,
          })
        );
        
        // Let parent close dialog and refresh data (don't call onClose here)
        onCreated();
      } catch (createError: any) {
        const statusCode = createError?.response?.status;
        const errorDetail = createError?.response?.data?.detail || "";
        const responseData = createError?.response?.data;

        if (statusCode === 409) {
          const appointmentId = payload.appointment_id;
          if (appointmentId && onExistingRxFound) {
            try {
              const existingPrescriptions = await fetchPrescriptions({ appointment_id: appointmentId });
              if (existingPrescriptions && existingPrescriptions.length > 0) {
                const existingRx = existingPrescriptions[0];
                onClose();
                onExistingRxFound(existingRx.id);
              }
            } catch {
              // ignore fetch failure; show main message below
            }
          }

          showError(
            errorDetail ||
              t("prescriptions.existingRxFound", { defaultValue: "A prescription already exists for this appointment." })
          );
          return;
        }

        // If backend returned an Rx object despite an error wrapper, treat as success
        if (responseData && (responseData.id || responseData.prescription_code)) {
          reset();
          setSearchTerms({});
          setDebouncedSearchTerms({});
          showSuccess(t("notifications.prescriptionCreated", { defaultValue: "Prescription created successfully" }));
          onCreated();
          onClose();
          return;
        }

        // Log detailed error for debugging
        console.error("Prescription creation error:", {
          statusCode,
          errorDetail,
          payload: {
            patient_id: payload.patient_id,
            appointment_id: payload.appointment_id,
            admission_id: payload.admission_id,
            hasItems: payload.items?.length > 0,
          },
        });
        showError(errorDetail || t("notifications.prescriptionCreateError", { defaultValue: "Failed to create prescription" }));
      }
    } catch (error: any) {
      showError(
        error?.response?.data?.detail || t("notifications.prescriptionCreateError", { defaultValue: "Failed to create prescription" })
      );
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      setSearchTerms({});
      setDebouncedSearchTerms({});
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle>{isEditMode ? t("prescriptions.edit", { defaultValue: "Edit Prescription" }) : t("prescriptions.create", { defaultValue: "Create Prescription" })}</DialogTitle>
      <DialogContent>
        {selectedPatientId && (
          <>
            <PatientMiniCard patientId={selectedPatientId} showWarning={true} />
            {hasActiveAdmission && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t("prescriptions.ipdPrescriptionInfo", {
                  defaultValue: "Patient has an active IPD admission. This prescription will be linked to the active admission.",
                })}
              </Alert>
            )}
            <Box sx={{ display: { xs: "block", md: "none" }, mb: 2 }}>
              <ClinicalSnapshotPanel patientId={selectedPatientId} variant="accordion" />
            </Box>
          </>
        )}

        <Grid container spacing={2}>
          {selectedPatientId && (
            <Grid
              size={{ xs: 12, md: 4 }}
              sx={{ display: { xs: "none", md: "block" }, maxHeight: "calc(100vh - 300px)", overflowY: "auto" }}
            >
              <ClinicalSnapshotPanel patientId={selectedPatientId} variant="panel" />
            </Grid>
          )}

          <Grid
            size={{ xs: 12, md: selectedPatientId ? 8 : 12 }}
            sx={{ maxHeight: "calc(100vh - 300px)", overflowY: "auto" }}
          >
            {selectedPatientId && (!patientAppointments || patientAppointments.length === 0) && !hasActiveAdmission && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t("prescriptions.noAppointments", {
                  defaultValue: "No appointments found for this patient. You can use 'Walk-in OPD' option below.",
                })}
              </Alert>
            )}

            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              {!(initialPatientId && hasActiveAdmission) && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    name="patient_id"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        select
                        label={t("prescriptions.patient", { defaultValue: "Patient" })}
                        fullWidth
                        required
                        disabled={!!initialPatientId || !!initialPrescriptionId}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        error={!!errors.patient_id}
                        helperText={
                          initialPatientId 
                            ? t("prescriptions.patientLocked", { defaultValue: "Patient is locked for this prescription" })
                            : errors.patient_id?.message
                        }
                      >
                        {(eligiblePatients || []).map((p: any) => (
                          <MenuItem key={p.id} value={p.id}>
                            {p.first_name} {p.last_name || ""}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>
              )}

              {!hasActiveAdmission && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller
                    name="appointment_id"
                    control={control}
                    render={({ field }) => {
                      const options = [
                        ...(eligibleOPDAppointments || []).map((apt: any) => ({
                          id: apt.id,
                          label: `${new Date(apt.scheduled_at).toLocaleString()} - ${apt.doctor_name || ""}`,
                          value: apt.id,
                        })),
                        {
                          id: "WALK_IN",
                          label: t("prescriptions.walkInOPD", { defaultValue: "Walk-in OPD (now)" }),
                          value: "WALK_IN",
                        },
                      ];

                      const selected = field.value ? options.find((opt) => opt.value === field.value) || null : null;

                      return (
                        <Autocomplete
                          disabled={!!initialAppointmentId}
                          options={options}
                          getOptionLabel={(option) => option.label}
                          value={selected}
                          onChange={(_, value) => field.onChange(value?.value || null)}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={t("prescriptions.appointment", { defaultValue: "Appointment *" })}
                              required
                              disabled={!!initialAppointmentId || !!initialPrescriptionId}
                              error={!!errors.appointment_id}
                              helperText={
                                errors.appointment_id?.message ||
                                (selectedPatientId && !hasActiveAdmission
                                  ? t("prescriptions.selectAppointmentOrWalkIn", { defaultValue: "Select an appointment or choose 'Walk-in OPD' option" })
                                  : "")
                              }
                            />
                          )}
                        />
                      );
                    }}
                  />
                </Grid>
              )}

              {/* Show doctor and department fields for walk-in prescriptions when user is not a doctor */}
              {showDoctorDeptFields && (
                <>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Autocomplete
                      options={departments || []}
                      getOptionLabel={(option: any) => option.name || ""}
                      value={departments?.find((d: any) => d.id === walkInDepartmentId) || null}
                      onChange={(_, value) => {
                        setWalkInDepartmentId(value?.id || "");
                        // Clear doctor selection when department changes
                        setWalkInDoctorId("");
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={t("prescriptions.department", { defaultValue: "Department *" })}
                          required
                          error={!walkInDepartmentId && isWalkIn}
                          helperText={
                            !walkInDepartmentId && isWalkIn
                              ? t("prescriptions.departmentRequired", { defaultValue: "Please select a department" })
                              : ""
                          }
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Autocomplete
                      options={doctors || []}
                      getOptionLabel={(option: any) => 
                        `${option.first_name || ""} ${option.last_name || ""}`.trim() || option.email || ""
                      }
                      value={doctors?.find((d: any) => d.id === walkInDoctorId) || null}
                      onChange={(_, value) => setWalkInDoctorId(value?.id || "")}
                      disabled={!walkInDepartmentId}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={t("prescriptions.doctor", { defaultValue: "Doctor *" })}
                          required
                          disabled={!walkInDepartmentId}
                          error={!walkInDoctorId && isWalkIn}
                          helperText={
                            !walkInDepartmentId && isWalkIn
                              ? t("prescriptions.doctorRequired", { defaultValue: "Please select a doctor" })
                              : !walkInDepartmentId
                              ? t("prescriptions.selectDepartmentFirst", { defaultValue: "Please select a department first" })
                              : ""
                          }
                        />
                      )}
                    />
                  </Grid>
                </>
              )}

              <Grid size={{ xs: 12 }}>
                <Controller
                  name="chief_complaint"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label={t("prescriptions.chiefComplaint", { defaultValue: "Chief Complaint / Patient Notes" })}
                      fullWidth
                      required
                      multiline
                      minRows={2}
                      {...field}
                      error={!!errors.chief_complaint}
                      helperText={
                        errors.chief_complaint?.message ||
                        t("prescriptions.chiefComplaintHelper", { defaultValue: "What patient told doctor (minimum 5 characters)" })
                      }
                      InputLabelProps={{ shrink: shrinkIfValue(field.value) }}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Controller
                  name="diagnosis"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label={t("prescriptions.diagnosis", { defaultValue: "Diagnosis" })}
                      fullWidth
                      required
                      multiline
                      minRows={2}
                      {...field}
                      error={!!errors.diagnosis}
                      helperText={
                        errors.diagnosis?.message || t("prescriptions.diagnosisHelper", { defaultValue: "Minimum 5 characters required" })
                      }
                      InputLabelProps={{ shrink: shrinkIfValue(field.value) }}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Grid>

          {/* Medicines Section */}
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Medicines
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() =>
                    append({
                      stock_item_id: null,
                      name: "",
                      dosage: "",
                      frequency: "",
                      duration: "",
                      instructions: "",
                      quantity: null,
                    })
                  }
                >
                  {t("prescriptions.addMedicine", { defaultValue: "Add Medicine" })}
                </Button>
              </Box>

              {errors.medicines?.message && (
                <Typography color="error" variant="body2" sx={{ mb: 1 }}>
                  {errors.medicines.message as string}
                </Typography>
              )}
            </Grid>

            {!watch("no_medicines") && (
              <Grid size={{ xs: 12 }}>
                {fields.map((f, index) => (
                  <MedicineRow
                    key={f.id}
                    index={index}
                    field={f}
                    control={control}
                    register={register}
                    errors={errors}
                    watch={watch}
                    setValue={setValue}
                    clearErrors={clearErrors}
                    remove={remove}
                    fieldsLength={fields.length}
                    searchTerms={searchTerms}
                    setSearchTerms={setSearchTerms}
                    debouncedSearchTerms={debouncedSearchTerms}
                    open={open}
                    t={t}
                  />
                ))}
              </Grid>
            )}
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ pr: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={isSubmitting}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button onClick={handleSubmit(onSubmit)} variant="contained" disabled={isSubmitting}>
          {isSubmitting ? t("common.saving", { defaultValue: "Saving..." }) : t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PrescriptionFormDialog;