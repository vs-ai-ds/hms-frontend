import React from "react";
import {
  Box,
  Button,
  TextField,
  Stack,
  Alert,
  Link as MuiLink
} from "@mui/material";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiClient } from "@app/lib/apiClient";
import { setAccessToken } from "@app/lib/auth";
import { useNavigate } from "react-router-dom";
import { AppRoutes } from "@app/routes";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required")
});

type FormValues = z.infer<typeof schema>;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("username", values.email);
      params.append("password", values.password);
      params.append("grant_type", "password");

      const res = await apiClient.post<{ access_token: string }>(
        "/auth/login",
        params,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          }
        }
      );

      setAccessToken(res.data.access_token);
      navigate(AppRoutes.DASHBOARD, { replace: true });
    } catch (err) {
      setError("Invalid credentials or login failed.");
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Email"
          type="email"
          fullWidth
          {...register("email")}
          error={!!errors.email}
          helperText={errors.email?.message}
        />
        <TextField
          label="Password"
          type="password"
          fullWidth
          {...register("password")}
          error={!!errors.password}
          helperText={errors.password?.message}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={isSubmitting}
        >
          Login
        </Button>
        <MuiLink
          component="button"
          type="button"
          onClick={() => navigate(AppRoutes.TENANT_REGISTER)}
          sx={{ alignSelf: "center" }}
        >
          Register a new hospital
        </MuiLink>
      </Stack>
    </Box>
  );
};

export default LoginPage;