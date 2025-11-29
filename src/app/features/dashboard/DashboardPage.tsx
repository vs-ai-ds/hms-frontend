import React from "react";
import { Box, Typography, Grid, Paper } from "@mui/material";

const StatCard: React.FC<{ label: string; value: string | number }> = ({
  label,
  value
}) => {
  return (
    <Paper
      elevation={2}
      sx={{
        p: 2.5,
        borderRadius: 3,
        display: "flex",
        flexDirection: "column",
        gap: 0.5
      }}
    >
      <Typography variant="subtitle2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={700}>
        {value}
      </Typography>
    </Paper>
  );
};

const DashboardPage: React.FC = () => {
  // Later: hook into real metrics (patients today, upcoming appointments, etc.)
  return (
    <Box>
      <Typography variant="h5" mb={3} fontWeight={600}>
        Overview
      </Typography>
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={4}>
          <StatCard label="Patients (Today)" value={12} />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard label="Upcoming Appointments" value={8} />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard label="Prescriptions (Today)" value={5} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;