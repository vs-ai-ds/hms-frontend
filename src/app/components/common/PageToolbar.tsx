// src/app/components/common/PageToolbar.tsx
import React from "react";
import { Box, Typography, TextField, Button, Stack } from "@mui/material";

interface PageToolbarProps {
  title: string;
  subtitle?: string;
  titleIcon?: React.ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryActions?: Array<{
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  }>;
}

const PageToolbar: React.FC<PageToolbarProps> = ({
  title,
  subtitle,
  titleIcon,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  primaryAction,
  secondaryActions,
}) => {
  const hasSearch = searchPlaceholder && onSearchChange !== undefined;
  const hasSecondaryActions = secondaryActions && secondaryActions.length > 0;
  const showBottomSection = hasSearch || hasSecondaryActions;

  return (
    <Box
      sx={{
        mb: 4,
        pb: showBottomSection ? 3 : 0,
        borderBottom: showBottomSection ? "1px solid rgba(0, 0, 0, 0.08)" : "none",
      }}
    >
      <Stack spacing={showBottomSection ? 2 : 0}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
          <Box sx={{ display: "flex", gap: 2, flex: 1 }}>
            {titleIcon && (
              <Box sx={{ 
                color: "primary.main", 
                display: "flex", 
                alignItems: "flex-start",
                pt: 0.5,
              }}>
                {titleIcon}
              </Box>
            )}
            <Box>
              <Typography
                variant="h4"
                fontWeight={700}
                sx={{
                  background: "linear-gradient(135deg, #1d7af3 0%, #0d5bc7 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  mb: subtitle ? 0.5 : 0,
                }}
              >
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="body1" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Box>
          {primaryAction && (
            <Button
              variant="contained"
              onClick={primaryAction.onClick}
              startIcon={primaryAction.icon}
              sx={{
                borderRadius: 2,
                boxShadow: "0 4px 12px rgba(29, 122, 243, 0.3)",
                "&:hover": {
                  boxShadow: "0 6px 16px rgba(29, 122, 243, 0.4)",
                },
              }}
            >
              {primaryAction.label}
            </Button>
          )}
        </Box>
        {showBottomSection && (
          <Box
            sx={{
              display: "flex",
              gap: 2,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {hasSearch && (
              <TextField
                size="small"
                placeholder={searchPlaceholder}
                value={searchValue || ""}
                onChange={(e) => onSearchChange(e.target.value)}
                sx={{
                  flexGrow: 1,
                  minWidth: 250,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                  },
                }}
              />
            )}
            {secondaryActions?.map((action, index) => (
              <Button
                key={index}
                variant="outlined"
                onClick={action.onClick}
                startIcon={action.icon}
                sx={{ borderRadius: 2 }}
              >
                {action.label}
              </Button>
            ))}
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default PageToolbar;