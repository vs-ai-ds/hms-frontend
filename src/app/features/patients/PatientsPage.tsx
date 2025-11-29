import React from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  CircularProgress
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import PatientFormDialog from "./PatientFormDialog";

interface Patient {
  id: string;
  first_name: string;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  department?: string | null;
  patient_type: "OPD" | "IPD";
  created_at: string;
}

const fetchPatients = async (): Promise<Patient[]> => {
  const res = await apiClient.get<Patient[]>("/patients");
  return res.data;
};

const PatientsPage: React.FC = () => {
  const [openDialog, setOpenDialog] = React.useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["patients"],
    queryFn: fetchPatients
  });

  const patients = data ?? [];

  return (
    <Box>
      <Box
        sx={{
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <Typography variant="h5" fontWeight={600}>
          Patients
        </Typography>
        <Button
          variant="contained"
          onClick={() => setOpenDialog(true)}
        >
          Register Patient
        </Button>
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
        {isLoading ? (
          <Box
            sx={{
              py: 6,
              display: "flex",
              justifyContent: "center",
              alignItems: "center"
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Patient Type</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {patients.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      {p.first_name} {p.last_name ?? ""}
                    </TableCell>
                    <TableCell>{p.phone ?? "-"}</TableCell>
                    <TableCell>{p.email ?? "-"}</TableCell>
                    <TableCell>{p.department ?? "-"}</TableCell>
                    <TableCell>{p.patient_type}</TableCell>
                    <TableCell>
                      {new Date(p.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {patients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No patients yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <PatientFormDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onCreated={() => refetch()}
      />
    </Box>
  );
};

export default PatientsPage;