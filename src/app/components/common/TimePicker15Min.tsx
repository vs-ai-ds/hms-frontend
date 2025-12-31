/**
 * Custom time picker component that only allows 15-minute intervals (00, 15, 30, 45)
 * This replaces the cluttered datetime-local input with a cleaner interface
 */
import React from "react";
import { TextField, MenuItem, Box } from "@mui/material";

interface TimePicker15MinProps {
  value: string; // Format: "HH:mm" (e.g., "14:30")
  onChange: (value: string) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
}

const TimePicker15Min: React.FC<TimePicker15MinProps> = ({
  value,
  onChange,
  label = "Time",
  error = false,
  helperText,
  disabled = false,
  required = false,
  fullWidth = false,
}) => {
  // Generate hours (00-23)
  const hours = Array.from({ length: 24 }, (_, i) => 
    String(i).padStart(2, '0')
  );

  // Only 15-minute intervals
  const minutes = ["00", "15", "30", "45"];

  // Parse current value
  const [currentHour, currentMinute] = value ? value.split(":") : ["00", "00"];

  const handleHourChange = (hour: string) => {
    onChange(`${hour}:${currentMinute}`);
  };

  const handleMinuteChange = (minute: string) => {
    onChange(`${currentHour}:${minute}`);
  };

  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
      <TextField
        select
        label={label}
        value={currentHour || "00"}
        onChange={(e) => handleHourChange(e.target.value)}
        error={error}
        helperText={helperText}
        disabled={disabled}
        required={required}
        fullWidth={fullWidth}
        sx={{ minWidth: 100 }}
        SelectProps={{
          MenuProps: {
            PaperProps: {
              sx: { maxHeight: 300 },
            },
          },
        }}
      >
        {hours.map((hour) => (
          <MenuItem key={hour} value={hour}>
            {hour}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Minute"
        value={currentMinute || "00"}
        onChange={(e) => handleMinuteChange(e.target.value)}
        error={error}
        disabled={disabled}
        required={required}
        sx={{ minWidth: 100 }}
        SelectProps={{
          MenuProps: {
            PaperProps: {
              sx: { maxHeight: 300 },
            },
          },
        }}
      >
        {minutes.map((minute) => (
          <MenuItem key={minute} value={minute}>
            {minute}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
};

export default TimePicker15Min;

