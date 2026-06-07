import React from "react";
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  Tooltip,
  Box,
} from "@mui/material";
import {
  Home,
  MapOutlined,
} from "@mui/icons-material";
import CameraIcon from '@mui/icons-material/Camera';
import { useNavigate } from "react-router-dom";

const drawerWidth = 72;

const LeftSidebar = ({ activeView, setActiveView }) => {
  const navigate = useNavigate();
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          borderRight: '1px solid rgba(250, 189, 47, 0.1)',
          background: 'rgba(60, 56, 54, 0.7)',
          backdropFilter: 'blur(20px)',
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pt: 2,
            pb: 1,
          }}
        >
          <CameraIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        </Box>

        <List sx={{ flex: 1 }}>
          <Tooltip title="Home" placement="right">
            <ListItem disablePadding>
              <ListItemButton
                selected={activeView === "reid"}
                onClick={() => {
                  setActiveView("reid");
                  navigate("/");
                }}
                sx={{
                  justifyContent: "center",
                  py: 2,
                }}
              >
                <ListItemIcon sx={{ minWidth: 0 }}>
                  <Home />
                </ListItemIcon>
              </ListItemButton>
            </ListItem>
          </Tooltip>

          <Tooltip title="Map View" placement="right">
            <ListItem disablePadding>
              <ListItemButton
                selected={activeView === "map"}
                onClick={() => {
                  setActiveView("map");
                  navigate("/map");
                }}
                sx={{
                  justifyContent: "center",
                  py: 2,
                }}
              >
                <ListItemIcon sx={{ minWidth: 0 }}>
                  <MapOutlined />
                </ListItemIcon>
              </ListItemButton>
            </ListItem>
          </Tooltip>
        </List>
      </Box>
    </Drawer>
  );
};

export default LeftSidebar;
