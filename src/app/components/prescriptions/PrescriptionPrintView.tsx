// src/app/components/prescriptions/PrescriptionPrintView.tsx
import React from "react";
import { Box, Typography, Button, Paper } from "@mui/material";
import { Print as PrintIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@app/store/authStore";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import { formatDate } from "@app/lib/dateFormat";
import { getUser } from "@app/lib/api/users";

interface Prescription {
  id: string;
  prescription_code?: string | null;
  patient_id: string;
  patient_name?: string;
  doctor_user_id: string;
  doctor_name?: string;
  appointment_id?: string | null;
  admission_id?: string | null;
  status: string;
  visit_type?: string;
  chief_complaint?: string;
  diagnosis?: string;
  items?: Array<{
    medicine_name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
    quantity?: number;
  }>;
  created_at: string;
}

interface Patient {
  id: string;
  first_name: string;
  middle_name?: string | null;
  last_name?: string | null;
  dob?: string | null;
  age_only?: number | null;
  gender?: string | null;
  patient_code?: string | null;
}

interface Vital {
  id: string;
  recorded_at: string;
  systolic_bp?: number;
  diastolic_bp?: number;
  heart_rate?: number;
  temperature_c?: number;
  respiratory_rate?: number;
  spo2?: number;
  weight_kg?: number;
}

interface Props {
  prescription: Prescription;
  tenantName?: string;
  tenantAddress?: string;
  tenantPhone?: string;
  tenantEmail?: string;
}

const PrescriptionPrintView: React.FC<Props> = ({
  prescription,
  tenantName,
  tenantAddress,
  tenantPhone,
  tenantEmail,
}) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  // Use provided props or fallback to user tenant name
  const finalTenantName = tenantName || user?.tenant_name || "HOSPITAL NAME";
  const finalTenantAddress = tenantAddress || undefined;
  const finalTenantPhone = tenantPhone || undefined;
  const finalTenantEmail = tenantEmail || undefined;

  // Fetch patient data for age, gender, weight
  const { data: patient } = useQuery<Patient>({
    queryKey: ["patient", prescription.patient_id],
    queryFn: async () => {
      const res = await apiClient.get<Patient>(`/patients/${prescription.patient_id}`);
      return res.data;
    },
    enabled: !!prescription.patient_id,
  });

  // Fetch doctor/user info if doctor_name is not available
  const { data: doctorUser } = useQuery({
    queryKey: ["user", prescription.doctor_user_id],
    queryFn: async () => {
      if (!prescription.doctor_user_id || prescription.doctor_name) return null;
      return await getUser(prescription.doctor_user_id);
    },
    enabled: !!prescription.doctor_user_id && !prescription.doctor_name,
  });

  // Fetch vitals for the same day as prescription
  const prescriptionDate = new Date(prescription.created_at).toISOString().split("T")[0];
  const { data: vitals } = useQuery<Vital[]>({
    queryKey: ["vitals", prescription.patient_id, prescriptionDate],
    queryFn: async () => {
      const res = await apiClient.get("/vitals", {
        params: {
          patient_id: prescription.patient_id,
        },
      });
      // Filter vitals for the same day as prescription
      return res.data.filter((v: Vital) => {
        const vitalDate = new Date(v.recorded_at).toISOString().split("T")[0];
        return vitalDate === prescriptionDate;
      });
    },
    enabled: !!prescription.patient_id,
  });

  const calculateAge = (dob: string | null, ageOnly: number | null | undefined): string => {
    if (ageOnly !== null && ageOnly !== undefined) {
      return `${ageOnly}`;
    }
    if (dob) {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return `${age}`;
    }
    return "-";
  };

  const getLatestWeight = (): string => {
    if (vitals && vitals.length > 0) {
      const latestVital = vitals[vitals.length - 1];
      return latestVital.weight_kg ? `${latestVital.weight_kg} kg` : "-";
    }
    return "-";
  };

  const celsiusToFahrenheit = (c: number | null | undefined): number | null => {
    if (c === null || c === undefined) return null;
    return (c * 9) / 5 + 32;
  };

  const handlePrint = () => {
    window.print();
  };


  const patientAge = patient ? calculateAge(patient.dob || null, patient.age_only) : "-";
  const patientGender = patient?.gender || "-";
  const patientWeight = getLatestWeight();

  return (
    <Box>
      <Box sx={{ mb: 2, display: "flex", gap: 2, justifyContent: "flex-end" }} className="no-print" style={{ display: "none" }}>
        <Button
          variant="outlined"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
        >
          {t("prescriptions.print", { defaultValue: "Print" })}
        </Button>
      </Box>

      <Paper
        id="prescription-print-content"
        elevation={0}
        sx={{
          p: 0,
          maxWidth: "210mm",
          margin: "0 auto",
          height: "297mm",
          position: "relative",
          border: "1px solid #000",
          "@media print": {
            boxShadow: "none",
            padding: 0,
            margin: 0,
            maxWidth: "100%",
            border: "1px solid #000",
          },
        }}
      >
        {/* Header Section */}
        <Box
          sx={{
            px: "20mm",
            pt: "15mm",
            pb: "10mm",
            borderBottom: "1px solid #000",
            position: "relative",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            {/* Doctor Name */}
            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: "#000",
                  fontSize: "22px",
                  lineHeight: 1.2,
                  mb: 0.5,
                }}
              >
                {(() => {
                  const doctorName = prescription.doctor_name || 
                    (doctorUser ? `${doctorUser.first_name || ""} ${doctorUser.last_name || ""}`.trim() : null);
                  return doctorName ? `Dr. ${doctorName}` : "Doctor Name";
                })()}
              </Typography>
              {/* Tenant Address, Phone, Email in Header */}
              {(finalTenantAddress || finalTenantPhone || finalTenantEmail) && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mt: 1 }}>
                  {finalTenantAddress && (
                    <>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "#000",
                          fontSize: "10px",
                        }}
                      >
                        {finalTenantAddress}
                      </Typography>
                      {(finalTenantPhone || finalTenantEmail) && (
                        <span style={{ color: "#000", fontSize: "8px" }}>●</span>
                      )}
                    </>
                  )}
                  {finalTenantPhone && (
                    <>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "#000",
                          fontSize: "10px",
                        }}
                      >
                        {finalTenantPhone}
                      </Typography>
                      {finalTenantEmail && (
                        <span style={{ color: "#000", fontSize: "8px" }}>●</span>
                      )}
                    </>
                  )}
                  {finalTenantEmail && (
                    <Typography
                      variant="body2"
                      sx={{
                        color: "#000",
                        fontSize: "10px",
                      }}
                    >
                      {finalTenantEmail}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>

            {/* Medical Logo Image - placeholder for uploaded image */}
            <Box
              component="img"
              src="/medical-logo.png"
              alt="Medical Logo"
              sx={{
                width: "75px",
                height: "75px",
                objectFit: "contain",
                display: "block",
              }}
              onError={(e: any) => {
                // Hide image if not found
                e.target.style.display = "none";
              }}
            />
          </Box>
        </Box>

        {/* Patient Information Section */}
        <Box
          sx={{
            px: "20mm",
            pt: "10mm",
            pb: "8mm",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2, flexWrap: "wrap" }}>
            <Box sx={{ flex: "1 1 200px", mb: 1 }}>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Patient:</strong> {prescription.patient_name || (patient ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim() : "-")}
                {patient?.patient_code && ` (${patient.patient_code})`}
              </Typography>
            </Box>
            <Box sx={{ flex: "1 1 150px", mb: 1, textAlign: "right" }}>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Date:</strong> {formatDate(prescription.created_at)}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 2 }}>
            <Box sx={{ flex: "1 1 100px" }}>
              <Typography variant="body2">
                <strong>Age:</strong> {patientAge}
              </Typography>
            </Box>
            <Box sx={{ flex: "1 1 100px" }}>
              <Typography variant="body2">
                <strong>Gender:</strong> {patientGender}
              </Typography>
            </Box>
            <Box sx={{ flex: "1 1 100px" }}>
              <Typography variant="body2">
                <strong>Weight:</strong> {patientWeight}
              </Typography>
            </Box>
          </Box>
        </Box>
               {/* Vitals Table - Always show with borders, even if values not available */}
        <Box
          sx={{
            px: "20mm",
            pb: "8mm",
          }}
        >
          <Typography variant="body2" sx={{ mb: 1, fontWeight: "bold" }}>
            Vital Signs:
          </Typography>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: "1px solid #000",
              fontSize: "11px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", fontWeight: "bold" }}>
                  Time
                </th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", fontWeight: "bold" }}>
                  BP
                </th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", fontWeight: "bold" }}>
                  HR
                </th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", fontWeight: "bold" }}>
                  Temp
                </th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", fontWeight: "bold" }}>
                  RR
                </th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", fontWeight: "bold" }}>
                  SpO2
                </th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", fontWeight: "bold" }}>
                  Weight
                </th>
              </tr>
            </thead>
            <tbody>
              {vitals && vitals.length > 0 ? (
                vitals.map((vital) => (
                  <tr key={vital.id}>
                    <td style={{ border: "1px solid #000", padding: "6px" }}>
                      {new Date(vital.recorded_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "6px" }}>
                      {vital.systolic_bp && vital.diastolic_bp
                        ? `${vital.systolic_bp}/${vital.diastolic_bp}`
                        : "-"}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "6px" }}>
                      {vital.heart_rate ? `${vital.heart_rate}` : "-"}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "6px" }}>
                      {vital.temperature_c !== null && vital.temperature_c !== undefined
                        ? `${celsiusToFahrenheit(vital.temperature_c)?.toFixed(1)}°F`
                        : "-"}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "6px" }}>
                      {vital.respiratory_rate ? `${vital.respiratory_rate}` : "-"}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "6px" }}>
                      {vital.spo2 ? `${vital.spo2}%` : "-"}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "6px" }}>
                      {vital.weight_kg ? `${vital.weight_kg} kg` : "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={{ border: "1px solid #000", padding: "6px" }}>-</td>
                  <td style={{ border: "1px solid #000", padding: "6px" }}>-</td>
                  <td style={{ border: "1px solid #000", padding: "6px" }}>-</td>
                  <td style={{ border: "1px solid #000", padding: "6px" }}>-</td>
                  <td style={{ border: "1px solid #000", padding: "6px" }}>-</td>
                  <td style={{ border: "1px solid #000", padding: "6px" }}>-</td>
                  <td style={{ border: "1px solid #000", padding: "6px" }}>-</td>
                </tr>
              )}
            </tbody>
          </table>
        </Box>
        {/* Chief Complaint */}
        {prescription.chief_complaint && (
          <Box
            sx={{
              px: "20mm",
              pb: "8mm",
            }}
          >
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Chief Complaint / Patient Notes:</strong>
            </Typography>
            <Typography variant="body2">{prescription.chief_complaint}</Typography>
          </Box>
        )}

        {/* Diagnosis */}
        {prescription.diagnosis && (
          <Box
            sx={{
              px: "20mm",
              pb: "8mm",
            }}
          >
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Diagnosis:</strong>
            </Typography>
            <Typography variant="body2">{prescription.diagnosis}</Typography>
          </Box>
        )}

        {/* Medicines Table */}
        {prescription.items && prescription.items.length > 0 && (
          <Box
            sx={{
              px: "20mm",
              pb: "8mm",
            }}
          >
            <Typography variant="body2" sx={{ mb: 1, fontWeight: "bold" }}>
              Medicines:
            </Typography>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: "1px solid #000",
                fontSize: "11px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f0f0f0" }}>
                  <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", fontWeight: "bold" }}>
                    Sr. No.
                  </th>
                  <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", fontWeight: "bold" }}>
                    Medicine Name
                  </th>
                  <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", fontWeight: "bold" }}>
                    Dosage
                  </th>
                  <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", fontWeight: "bold" }}>
                    Frequency
                  </th>
                  <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", fontWeight: "bold" }}>
                    Duration
                  </th>
                  <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", fontWeight: "bold" }}>
                    Instructions
                  </th>
                </tr>
              </thead>
              <tbody>
                {prescription.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ border: "1px solid #000", padding: "6px" }}>{idx + 1}</td>
                    <td style={{ border: "1px solid #000", padding: "6px" }}>{item.medicine_name}</td>
                    <td style={{ border: "1px solid #000", padding: "6px" }}>{item.dosage || "-"}</td>
                    <td style={{ border: "1px solid #000", padding: "6px" }}>{item.frequency || "-"}</td>
                    <td style={{ border: "1px solid #000", padding: "6px" }}>{item.duration || "-"}</td>
                    <td style={{ border: "1px solid #000", padding: "6px" }}>{item.instructions || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        )}

        {/* Signature Section - Just above footer, right aligned */}
        <Box
          sx={{
            px: "20mm",
            pb: "8mm",
            textAlign: "right",
            position: "absolute",
            bottom: "45mm", // Space for footer
            right: "20mm",
            left: "20mm",
          }}
        >
          <Box
            sx={{
              display: "inline-block",
              borderTop: "1px solid #000",
              width: "150px",
              pt: 1,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              Signature
            </Typography>
          </Box>
        </Box>

        {/* Footer - At very bottom */}
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            px: "20mm",
            pb: "10mm",
            borderTop: "1px solid #000",
            pt: "8mm",
            minHeight: "35mm",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            <Typography
              variant="h4"
              sx={{
                color: "#000",
                fontSize: "24px",
                fontWeight: 700,
                mb: 1.5,
              }}
            >
              {finalTenantName}
            </Typography>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
                alignItems: "center",
              }}
            >
              {finalTenantAddress && (
                <>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "#000",
                      fontSize: "11px",
                    }}
                  >
                    {finalTenantAddress}
                  </Typography>
                  <span style={{ color: "#000", fontSize: "8px" }}>●</span>
                </>
              )}
              {finalTenantPhone && (
                <>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "#000",
                      fontSize: "11px",
                    }}
                  >
                    {finalTenantPhone}
                  </Typography>
                  {finalTenantEmail && <span style={{ color: "#000", fontSize: "8px" }}>●</span>}
                </>
              )}
              {finalTenantEmail && (
                <Typography
                  variant="body2"
                  sx={{
                    color: "#000",
                    fontSize: "11px",
                  }}
                >
                  {finalTenantEmail}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default PrescriptionPrintView;
