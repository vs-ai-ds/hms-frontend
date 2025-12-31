// src/app/features/patients/DuplicateDetectionModal.tsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  Stack,
  Chip,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AppRoutes } from "@app/routes";

interface DuplicateCandidate {
  id: string;
  patient_code: string | null;
  first_name: string;
  last_name: string | null;
  dob: string | null;
  phone_primary: string | null;
  age: number | null;
  last_visited_at: string | null;
  match_score: number;
  match_reason: string;
}

interface Props {
  open: boolean;
  candidates: DuplicateCandidate[];
  onClose: (action: "open" | "create" | "cancel") => void;
  createdPatientId: string | null;
}

const DuplicateDetectionModal: React.FC<Props> = ({
  open,
  candidates,
  onClose,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const calculateAge = (dob: string | null): number | null => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  const formatPhone = (phone: string | null): string => {
    if (!phone) return "-";
    // Mask phone for privacy (show last 4 digits)
    if (phone.length > 4) {
      return `****${phone.slice(-4)}`;
    }
    return phone;
  };

  return (
    <Dialog open={open} onClose={() => onClose("cancel")} maxWidth="md" fullWidth>
      <DialogTitle>
        {t("patients.duplicateFound", {
          defaultValue: "Possible Matches Found",
        })}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t("patients.duplicateMessage", {
            defaultValue: `We found ${candidates.length} possible match(es). Select an existing patient or create a new record anyway.`,
            count: candidates.length,
          })}
        </Typography>

        <Stack spacing={2}>
          {candidates.map((candidate) => {
            const age = candidate.age || calculateAge(candidate.dob);
            return (
              <Card
                key={candidate.id}
                variant="outlined"
                sx={{
                  cursor: "pointer",
                  "&:hover": {
                    backgroundColor: "action.hover",
                  },
                }}
                onClick={() => {
                  navigate(`${AppRoutes.PATIENTS}/${candidate.id}`);
                  onClose("open");
                }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        {candidate.first_name} {candidate.last_name || ""}
                      </Typography>
                      <Box sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        {candidate.patient_code && (
                          <Chip
                            label={candidate.patient_code}
                            size="small"
                          />
                        )}
                        {age !== null && (
                          <Typography variant="body2" color="text.secondary" component="span">
                            {age} yrs
                          </Typography>
                        )}
                        {candidate.dob && (
                          <Typography variant="body2" color="text.secondary" component="span">
                            (DOB: {new Date(candidate.dob).toLocaleDateString()})
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t("patients.phone", { defaultValue: "Phone" })}:{" "}
                        {formatPhone(candidate.phone_primary)}
                      </Typography>
                      {candidate.last_visited_at && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {t("patients.lastVisit", { defaultValue: "Last visit" })}:{" "}
                          {new Date(candidate.last_visited_at).toLocaleDateString()}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Chip
                        label={`${Math.round(candidate.match_score * 100)}% match`}
                        color="warning"
                        size="small"
                      />
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 0.5 }}
                      >
                        {candidate.match_reason}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ pr: 3, pb: 2 }}>
        <Button onClick={() => onClose("cancel")}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        {candidates.length > 0 && (
          <Button
            variant="outlined"
            onClick={() => {
              navigate(`${AppRoutes.PATIENTS}/${candidates[0].id}`);
              onClose("open");
            }}
          >
            {t("patients.openExisting", { defaultValue: "Open Existing" })}
          </Button>
        )}
        <Button variant="contained" onClick={() => onClose("create")}>
          {t("patients.createNewAnyway", {
            defaultValue: "Create New Anyway",
          })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DuplicateDetectionModal;

