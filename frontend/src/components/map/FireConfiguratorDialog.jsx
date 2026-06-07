import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  FormControlLabel,
  Select,
  MenuItem,
  InputLabel,
  TextField,
  Grid,
  Typography,
  Box,
  IconButton,
  Divider,
  Paper,
  Tooltip,
  ButtonGroup,
  Stack,
  FormHelperText,
} from "@mui/material";
import {
  Close as CloseIcon,
  InfoOutlined,
  Whatshot,
  HelpOutline,
} from "@mui/icons-material";
import { useMap } from "../../context/MapContext";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import {
  LocalizationProvider,
  DatePicker,
  TimePicker,
  DateTimePicker,
} from "@mui/x-date-pickers";
import { format } from "date-fns";

const FireConfiguratorDialog = () => {
  const {
    isFireConfigDialogOpen,
    closeFireConfigDialog,
    applyFireConfig,
    initialRawFireConfig,
    fireConfig,
  } = useMap();

  // Form state
  const [formState, setFormState] = useState({
    ...initialRawFireConfig,
    preset: "recent", // Default preset
    useDateTime: false, // Flag to determine if we use full datetime or just date
  });

  const dialogInitialized = useRef(false);

  useEffect(() => {
    if (isFireConfigDialogOpen && !dialogInitialized.current) {
      if (fireConfig && fireConfig.rawConfig) {
        setFormState({
          ...fireConfig.rawConfig,
          preset: fireConfig.rawConfig.preset || "recent",
          useDateTime: false,
        });
      } else {
        setFormState({
          ...initialRawFireConfig,
          preset: "recent",
          useDateTime: false,
        });
      }
      dialogInitialized.current = true;
    } else if (!isFireConfigDialogOpen) {
      dialogInitialized.current = false;
    }
  }, [isFireConfigDialogOpen, initialRawFireConfig, fireConfig]);

  const handleCategoryChange = (event) => {
    setFormState({
      ...formState,
      category: event.target.value,
    });
  };

  const handleSensorChange = (event) => {
    setFormState({
      ...formState,
      sensor: event.target.value,
    });
  };

  const handleChange = (field) => (event) => {
    setFormState({
      ...formState,
      [field]: event.target.value,
    });
  };

  const handleDateChange = (field, date) => {
    if (date) {
      // Format the date based on whether we're using date only or datetime
      const dateStr = formState.useDateTime
        ? format(date, "yyyy-MM-dd'T'HH:mm:ss") // ISO format with time
        : format(date, "yyyy-MM-dd"); // Date only

      setFormState({
        ...formState,
        [field]: dateStr,
      });
    }
  };

  const toggleDateTimeFormat = () => {
    setFormState((prev) => {
      const useDateTime = !prev.useDateTime;

      // Convert existing dates to the new format if they exist
      let wmsStartDate = prev.wmsStartDate;
      let wmsEndDate = prev.wmsEndDate;

      if (wmsStartDate) {
        const date = new Date(wmsStartDate);
        wmsStartDate = useDateTime
          ? format(date, "yyyy-MM-dd'T'HH:mm:ss")
          : format(date, "yyyy-MM-dd");
      }

      if (wmsEndDate) {
        const date = new Date(wmsEndDate);
        wmsEndDate = useDateTime
          ? format(date, "yyyy-MM-dd'T'HH:mm:ss")
          : format(date, "yyyy-MM-dd");
      }

      return {
        ...prev,
        useDateTime,
        wmsStartDate,
        wmsEndDate,
      };
    });
  };

  const handleApply = () => {
    applyFireConfig(formState);
  };

  const applyPreset = (preset) => {
    const newConfig = {
      ...formState,
      preset,
      activeFireTimeWindow:
        preset === "recent" ? "24h" : preset === "mid" ? "48h" : "7d",
    };
    setFormState(newConfig);
  };

  return (
    <Dialog
      open={isFireConfigDialogOpen}
      onClose={closeFireConfigDialog}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>
        Configure Fire Data Layer
        <IconButton
          aria-label="close"
          onClick={closeFireConfigDialog}
          sx={{
            position: "absolute",
            right: 8,
            top: 8,
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* Quick Presets */}
        <Paper
          elevation={1}
          sx={{
            p: 2,
            mb: 3,
            backgroundColor: "rgba(244, 67, 54, 0.05)",
            border: "1px solid rgba(244, 67, 54, 0.2)",
          }}
        >
          <Typography variant="subtitle1" gutterBottom fontWeight="bold">
            Quick Fire Presets
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2">
              Choose a preset for commonly used fire views:
            </Typography>
          </Box>
          <ButtonGroup variant="contained" color="error" sx={{ mb: 2 }}>
            <Tooltip title="Latest fires (past 24 hours)">
              <Button
                onClick={() => applyPreset("recent")}
                variant={
                  formState.preset === "recent" ? "contained" : "outlined"
                }
                startIcon={<Whatshot />}
              >
                Recent Fires
              </Button>
            </Tooltip>
            <Tooltip title="Mid-term fires (past 48 hours)">
              <Button
                onClick={() => applyPreset("mid")}
                variant={formState.preset === "mid" ? "contained" : "outlined"}
              >
                Mid-term
              </Button>
            </Tooltip>
            <Tooltip title="Older fires (past 7 days)">
              <Button
                onClick={() => applyPreset("old")}
                variant={formState.preset === "old" ? "contained" : "outlined"}
              >
                Week View
              </Button>
            </Tooltip>
          </ButtonGroup>

          <Typography variant="body2" color="text.secondary">
            <strong>Recent Fires:</strong> Shows fires detected in the last 24
            hours - best for monitoring active situations
            <br />
            <strong>Mid-term:</strong> Shows fires from the past 48 hours -
            useful for tracking developing fire events
            <br />
            <strong>Week View:</strong> Shows a full 7-day history - best for
            understanding longer-term fire patterns
          </Typography>
        </Paper>

        <Grid container spacing={3}>
          {/* Data Source Selection with Info */}
          <Grid item xs={12}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                Data Source Selection
              </Typography>
              <Tooltip title="Choose which satellite sensor data to display. VIIRS offers higher resolution than MODIS. Landsat has less frequent coverage but higher detail.">
                <IconButton size="small">
                  <InfoOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>

          {/* Category Selection */}
          <Grid item xs={12} md={6}>
            <FormControl component="fieldset">
              <FormLabel component="legend">Time Frame Type</FormLabel>
              <RadioGroup
                row
                name="category"
                value={formState.category}
                onChange={handleCategoryChange}
              >
                <FormControlLabel
                  value="activeFires"
                  control={<Radio />}
                  label="Recent Fixed Period"
                />
                <FormControlLabel
                  value="wmsTime"
                  control={<Radio />}
                  label="Custom Date Range"
                />
              </RadioGroup>
            </FormControl>
          </Grid>

          {/* Sensor Selection */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Satellite Sensor</InputLabel>
              <Select
                value={formState.sensor}
                onChange={handleSensorChange}
                label="Satellite Sensor"
              >
                <MenuItem value="VIIRS">VIIRS (375m resolution)</MenuItem>
                <MenuItem value="MODIS">MODIS (1km resolution)</MenuItem>
                <MenuItem value="Landsat">Landsat (30m resolution)</MenuItem>
              </Select>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                VIIRS provides better resolution than MODIS. Landsat has high
                resolution but less frequent coverage.
              </Typography>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <Divider />
          </Grid>

          {/* Platform Selection - VIIRS */}
          {formState.sensor === "VIIRS" && (
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>VIIRS Platform</InputLabel>
                <Select
                  value={formState.viirsPlatform}
                  onChange={handleChange("viirsPlatform")}
                  label="VIIRS Platform"
                >
                  <MenuItem value="all">All Platforms (Combined)</MenuItem>
                  <MenuItem value="snpp">Suomi NPP</MenuItem>
                  <MenuItem value="noaa20">NOAA-20</MenuItem>
                  <MenuItem value="noaa21">NOAA-21</MenuItem>
                </Select>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  Different satellites provide coverage at different times
                  throughout the day. Combined view offers the most complete
                  coverage.
                </Typography>
              </FormControl>
            </Grid>
          )}

          {/* Platform Selection - MODIS */}
          {formState.sensor === "MODIS" && (
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>MODIS Platform</InputLabel>
                <Select
                  value={formState.modisPlatform}
                  onChange={handleChange("modisPlatform")}
                  label="MODIS Platform"
                >
                  <MenuItem value="combined">Combined (Terra + Aqua)</MenuItem>
                  <MenuItem value="aqua">Aqua (Afternoon passes)</MenuItem>
                  <MenuItem value="terra">Terra (Morning passes)</MenuItem>
                </Select>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  Terra passes in the morning, Aqua in the afternoon. Combined
                  view gives you data from both satellites.
                </Typography>
              </FormControl>
            </Grid>
          )}

          {/* Active Fire Time Window */}
          {formState.category === "activeFires" && (
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Time Range</InputLabel>
                <Select
                  value={formState.activeFireTimeWindow}
                  onChange={handleChange("activeFireTimeWindow")}
                  label="Time Range"
                >
                  <MenuItem value="24h">
                    Past 24 Hours (Most recent fires)
                  </MenuItem>
                  <MenuItem value="48h">Past 48 Hours (2 days)</MenuItem>
                  <MenuItem value="72h">Past 72 Hours (3 days)</MenuItem>
                  <MenuItem value="7d">
                    Past 7 Days (Full week history)
                  </MenuItem>
                </Select>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  Longer time periods show more historical fires but may appear
                  more cluttered.
                </Typography>
              </FormControl>
            </Grid>
          )}

          {/* Custom Date Range */}
          {formState.category === "wmsTime" && (
            <Grid item xs={12}>
              <Box sx={{ mb: 1 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ mb: 1 }}
                >
                  <Typography variant="subtitle2">Custom Date Range</Typography>
                  <FormControlLabel
                    control={
                      <Radio
                        checked={!formState.useDateTime}
                        onChange={() =>
                          setFormState({ ...formState, useDateTime: false })
                        }
                        size="small"
                      />
                    }
                    label="Date Only"
                  />
                  <FormControlLabel
                    control={
                      <Radio
                        checked={formState.useDateTime}
                        onChange={() =>
                          setFormState({ ...formState, useDateTime: true })
                        }
                        size="small"
                      />
                    }
                    label="Date & Time"
                  />
                  <Tooltip title="WMS TIME parameter requires specific format. Use Date Only (YYYY-MM-DD) for simpler queries or Date & Time for precise time ranges.">
                    <IconButton size="small">
                      <HelpOutline fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Select a specific time period for fire data. Note that custom
                  date ranges are available for VIIRS and MODIS data only.
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 2 }}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  {formState.useDateTime ? (
                    <>
                      <DateTimePicker
                        label="Start Date & Time"
                        value={
                          formState.wmsStartDate
                            ? new Date(formState.wmsStartDate)
                            : null
                        }
                        onChange={(date) =>
                          handleDateChange("wmsStartDate", date)
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            helperText="Beginning of time period (YYYY-MM-DDTHH:MM:SS)"
                          />
                        )}
                      />
                      <DateTimePicker
                        label="End Date & Time"
                        value={
                          formState.wmsEndDate
                            ? new Date(formState.wmsEndDate)
                            : null
                        }
                        onChange={(date) =>
                          handleDateChange("wmsEndDate", date)
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            helperText="End of time period (YYYY-MM-DDTHH:MM:SS)"
                          />
                        )}
                        minDate={
                          formState.wmsStartDate
                            ? new Date(formState.wmsStartDate)
                            : undefined
                        }
                      />
                    </>
                  ) : (
                    <>
                      <DatePicker
                        label="Start Date"
                        value={
                          formState.wmsStartDate
                            ? new Date(formState.wmsStartDate)
                            : null
                        }
                        onChange={(date) =>
                          handleDateChange("wmsStartDate", date)
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            helperText="Beginning of time period (YYYY-MM-DD)"
                          />
                        )}
                      />
                      <DatePicker
                        label="End Date"
                        value={
                          formState.wmsEndDate
                            ? new Date(formState.wmsEndDate)
                            : null
                        }
                        onChange={(date) =>
                          handleDateChange("wmsEndDate", date)
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            helperText="End of time period (YYYY-MM-DD)"
                          />
                        )}
                        minDate={
                          formState.wmsStartDate
                            ? new Date(formState.wmsStartDate)
                            : undefined
                        }
                      />
                    </>
                  )}
                </LocalizationProvider>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="info.main">
                  <strong>Valid Date Formats:</strong> YYYY-MM-DD or
                  YYYY-MM-DDTHH:MM:SS (ISO format with time)
                </Typography>
              </Box>
              <Typography
                variant="caption"
                color="error"
                sx={{ mt: 1, display: "block" }}
              >
                Note: Landsat does not support custom date ranges, so it will
                default to the most recent 24 hours of data.
              </Typography>
            </Grid>
          )}

          {/* Layer Information Box */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2, mt: 2, backgroundColor: "rgba(0, 0, 0, 0.02)" }}>
              <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                About FIRMS Fire Data
              </Typography>
              <Typography variant="body2">
                • <strong>VIIRS</strong> (Visible Infrared Imaging Radiometer
                Suite) provides fire detection at 375m resolution
                <br />• <strong>MODIS</strong> (Moderate Resolution Imaging
                Spectroradiometer) detects fires at 1km resolution
                <br />• <strong>Landsat</strong> offers high-resolution (30m)
                fire detection but with less frequent coverage
                <br />
                <br />
                <strong>Sensor Coverage Information:</strong>
                <br />
                • VIIRS combined (S-NPP & NOAA-20) gives the most complete
                coverage with data from multiple satellites
                <br />
                • MODIS Terra passes in the morning (~10:30am local time)
                <br />
                • MODIS Aqua passes in the afternoon (~2:30pm local time)
                <br />
                • Some fires may only be detected by certain sensors due to
                timing differences
                <br />
                <br />
                <strong>Time Period Selection:</strong>
                <br />
                • 24-hour data shows the most recent fires (best for current
                events)
                <br />
                • 48-hour data helps identify spreading or persistent fires
                <br />
                • 7-day data is useful for understanding fire patterns over time
                <br />
                <br />
                Fire data is processed by NASA's FIRMS (Fire Information for
                Resource Management System). It shows thermal
                anomalies/hotspots, which may include active fires, volcanic
                activity, or other heat sources.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={closeFireConfigDialog}>Cancel</Button>
        <Button onClick={handleApply} variant="contained" color="primary">
          Apply Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FireConfiguratorDialog;
