/**
 * Combined date and time picker that only allows 15-minute intervals (00, 15, 30, 45)
 * This replaces the cluttered datetime-local input with separate date and time pickers
 */
import React from "react";
import { TextField, MenuItem, Box } from "@mui/material";
import Grid from "@mui/material/Grid";

interface DateTimePicker15MinProps {
  value: string; // Format: "YYYY-MM-DDTHH:mm" (datetime-local format)
  onChange: (value: string) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  min?: string; // Minimum datetime in "YYYY-MM-DDTHH:mm" format
}

const DateTimePicker15Min: React.FC<DateTimePicker15MinProps> = ({
  value,
  onChange,
  label = "Date & Time",
  error = false,
  helperText,
  disabled = false,
  required = false,
  fullWidth = false,
  min,
}) => {
  // Parse current value
  const [datePart, timePart] = value ? value.split("T") : ["", ""];
  const [currentHour, currentMinute] = timePart ? timePart.split(":") : ["00", "00"];

  // Generate hours (00-23)
  const hours = Array.from({ length: 24 }, (_, i) => 
    String(i).padStart(2, '0')
  );

  // Only 15-minute intervals
  const minutes = ["00", "15", "30", "45"];

  // Get minimum date and time if provided
  const minDate = min ? min.split("T")[0] : undefined;
  const minTime = min ? min.split("T")[1] : undefined;
  const [minHour, minMinute] = minTime ? minTime.split(":") : ["00", "00"];

  const handleDateChange = (date: string) => {
    const time = timePart || "00:00";
    onChange(`${date}T${time}`);
  };

  const handleHourChange = (hour: string) => {
    const date = datePart || new Date().toISOString().split("T")[0];
    onChange(`${date}T${hour}:${currentMinute || "00"}`);
  };

  const handleMinuteChange = (minute: string) => {
    const date = datePart || new Date().toISOString().split("T")[0];
    onChange(`${date}T${currentHour || "00"}:${minute}`);
  };

  // Check if a time option should be disabled (if it's before min time on min date)
  const isTimeDisabled = (hour: string, minute: string): boolean => {
    if (!minDate || !datePart) return false;
    if (datePart < minDate) return false; // Can't be before min date
    if (datePart > minDate) return false; // Can be after min date
    // Same date - check time
    const hourNum = parseInt(hour, 10);
    const minuteNum = parseInt(minute, 10);
    const minHourNum = parseInt(minHour, 10);
    const minMinuteNum = parseInt(minMinute, 10);
    if (hourNum < minHourNum) return true;
    if (hourNum === minHourNum && minuteNum < minMinuteNum) return true;
    return false;
  };

  return (
    <Box>
      <Grid container spacing={1}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            type="date"
            label={label}
            value={datePart || ""}
            onChange={(e) => handleDateChange(e.target.value)}
            error={error}
            helperText={helperText}
            disabled={disabled}
            required={required}
            fullWidth={fullWidth}
            InputLabelProps={{ shrink: true }}
            inputProps={{
              min: minDate,
            }}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField
            select
            label="Hour"
            value={currentHour || "00"}
            onChange={(e) => handleHourChange(e.target.value)}
            error={error}
            disabled={disabled}
            required={required}
            fullWidth
            SelectProps={{
              MenuProps: {
                PaperProps: {
                  sx: { maxHeight: 300 },
                },
              },
            }}
          >
            {hours.map((hour) => (
              <MenuItem 
                key={hour} 
                value={hour}
                disabled={isTimeDisabled(hour, currentMinute || "00")}
              >
                {hour}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField
            select
            label="Minute"
            value={currentMinute || "00"}
            onChange={(e) => handleMinuteChange(e.target.value)}
            error={error}
            disabled={disabled}
            required={required}
            fullWidth
            SelectProps={{
              MenuProps: {
                PaperProps: {
                  sx: { maxHeight: 300 },
                },
              },
            }}
          >
            {minutes.map((minute) => (
              <MenuItem 
                key={minute} 
                value={minute}
                disabled={isTimeDisabled(currentHour || "00", minute)}
              >
                {minute}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DateTimePicker15Min;