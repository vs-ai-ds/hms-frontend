// src/app/components/common/VisitTypeSelectionDialog.tsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectOPD: () => void;
  onSelectIPD: () => void;
}

const VisitTypeSelectionDialog: React.FC<Props> = ({
  open,
  onClose,
  onSelectOPD,
  onSelectIPD,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t("patients.selectVisitType", { defaultValue: "Select Visit Type" })}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ mb: 3 }}>
          {t("patients.selectVisitTypeDescription", {
            defaultValue: "Choose the type of visit for this patient:",
          })}
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Button
              variant="outlined"
              size="large"
              fullWidth
              onClick={() => {
                onSelectOPD();
                onClose();
              }}
              sx={{ py: 3 }}
            >
              <Box>
                <Typography variant="h6">
                  {t("patients.opd", { defaultValue: "OPD" })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("patients.opdDescription", {
                    defaultValue: "Outpatient Department",
                  })}
                </Typography>
              </Box>
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Button
              variant="outlined"
              size="large"
              fullWidth
              onClick={() => {
                onSelectIPD();
                onClose();
              }}
              sx={{ py: 3 }}
            >
              <Box>
                <Typography variant="h6">
                  {t("patients.ipd", { defaultValue: "IPD" })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("patients.ipdDescription", {
                    defaultValue: "Inpatient Department",
                  })}
                </Typography>
              </Box>
            </Button>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VisitTypeSelectionDialog;
