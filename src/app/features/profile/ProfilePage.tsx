// src/app/features/profile/ProfilePage.tsx
import React from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Avatar,
  Chip,
  Button,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { Lock as LockIcon } from "@mui/icons-material";
import PageToolbar from "@app/components/common/PageToolbar";
import { useAuthStore } from "@app/store/authStore";
import { useTranslation } from "react-i18next";
import ChangePasswordDialog from "@app/components/profile/ChangePasswordDialog";

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false);

  if (!user) {
    return null;
  }

  const initials =
    (user.first_name?.[0] ?? "") + (user.last_name?.[0] ?? "");

  return (
    <Box>
      <PageToolbar
        title={t("profile.title", { defaultValue: "My Profile" })}
        subtitle={t("profile.subtitle", {
          defaultValue: "View and manage your profile information.",
        })}
      />

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper
            elevation={2}
            sx={{
              p: 3,
              borderRadius: 3,
              textAlign: "center",
            }}
          >
            <Avatar
              sx={{
                width: 120,
                height: 120,
                mx: "auto",
                mb: 2,
                bgcolor: "primary.main",
                fontSize: "3rem",
              }}
            >
              {initials || "DR"}
            </Avatar>
            <Typography variant="h5" fontWeight={600} mb={1}>
              {user.first_name} {user.last_name}
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              {user.email}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, justifyContent: "center" }}>
              {user.roles?.map((role) => (
                <Chip
                  key={role.name}
                  label={role.name}
                  size="small"
                  color="primary"
                  sx={{ borderRadius: 2 }}
                />
              ))}
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" mb={3}>
              {t("profile.personalInfo", { defaultValue: "Personal Information" })}
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={t("profile.firstName", { defaultValue: "First Name" })}
                  value={user.first_name}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={t("profile.lastName", { defaultValue: "Last Name" })}
                  value={user.last_name}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={t("profile.email", { defaultValue: "Email" })}
                  value={user.email}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={t("profile.department", { defaultValue: "Department" })}
                  value={user.department || "-"}
                  fullWidth
                  disabled
                />
              </Grid>
              {user.specialization && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={t("profile.specialization", { defaultValue: "Specialization" })}
                    value={user.specialization}
                    fullWidth
                    disabled
                  />
                </Grid>
              )}
              {user.tenant_name && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={t("profile.hospital", { defaultValue: "Hospital" })}
                    value={user.tenant_name}
                    fullWidth
                    disabled
                  />
                </Grid>
              )}
            </Grid>
            
            <Box sx={{ mt: 4, pt: 3, borderTop: "1px solid rgba(0, 0, 0, 0.12)" }}>
              <Typography variant="h6" mb={2}>
                {t("profile.security", { defaultValue: "Security" })}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<LockIcon />}
                onClick={() => setChangePasswordOpen(true)}
              >
                {t("profile.changePassword", { defaultValue: "Change Password" })}
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </Box>
  );
};

export default ProfilePage;


