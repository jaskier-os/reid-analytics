import React, { useMemo } from "react";
import { CssBaseline, Box, ThemeProvider, createTheme } from "@mui/material";
import { DrawProvider } from "./context/DrawContext";
import Layout from "./components/layout/Layout";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";

// Context Providers
import { MapProvider } from "./context/MapContext";
import { LeafletProvider } from "./context/LeafletContext";
import { ReidProvider } from "./context/ReidContext";
import { MapReidProvider } from "./context/MapReidContext";
// Components
import LeftSidebar from "./components/layout/LeftSidebar";
import RightSidebar from "./components/layout/RightSidebar";
import MainContent from "./components/layout/MainContent";

// Components - ReID
import ReidView from "./components/reid/ReidView";
function App() {
  const [activeView, setActiveView] = React.useState("map");

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: 'dark',
          primary: {
            main: '#fabd2f',
            light: '#fe8019',
            dark: '#d79921',
          },
          secondary: {
            main: '#d3869b',
          },
          background: {
            default: '#282828',
            paper: 'rgba(60, 56, 54, 0.7)',
          },
          success: {
            main: '#b8bb26',
          },
          error: {
            main: '#fb4934',
          },
        },
        typography: {
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
          h6: {
            fontWeight: 600,
          },
        },
        shape: {
          borderRadius: 16,
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                backdropFilter: 'blur(20px)',
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                backdropFilter: 'blur(20px)',
              },
            },
          },
        },
      }),
    []
  );

  function mapRoute() {
    return (
      <MapProvider>
        <Box
          sx={{
            display: "flex",
            height: "100vh",
            overflow: "hidden",
            background: 'linear-gradient(135deg, #282828 0%, #3c3836 50%, #282828 100%)',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '400px',
              background: 'radial-gradient(ellipse at top, rgba(250, 189, 47, 0.15), transparent 70%)',
              pointerEvents: 'none',
            },
          }}
        >
          <LeftSidebar activeView={"map"} setActiveView={setActiveView} />

          <LeafletProvider>
            <MapReidProvider>
              <MainContent activeView={"map"} />
            </MapReidProvider>
          </LeafletProvider>

          <RightSidebar activeView={"map"} />
        </Box>
      </MapProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/map" element={mapRoute()} />

          <Route
            path="/"
            element={
              <ReidProvider>
                <Box
                  sx={{
                    display: "flex",
                    height: "100vh",
                    overflow: "hidden",
                    background: 'linear-gradient(135deg, #282828 0%, #3c3836 50%, #282828 100%)',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '400px',
                      background: 'radial-gradient(ellipse at top, rgba(250, 189, 47, 0.15), transparent 70%)',
                      pointerEvents: 'none',
                    },
                  }}
                >
                  <LeftSidebar
                    activeView={"reid"}
                    setActiveView={setActiveView}
                  />

                  <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
                    <ReidView />
                  </Box>
                </Box>
              </ReidProvider>
            }
          />

          <Route
            path="/reid"
            element={
              <ReidProvider>
                <Box
                  sx={{
                    display: "flex",
                    height: "100vh",
                    overflow: "hidden",
                    background: 'linear-gradient(135deg, #282828 0%, #3c3836 50%, #282828 100%)',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '400px',
                      background: 'radial-gradient(ellipse at top, rgba(250, 189, 47, 0.15), transparent 70%)',
                      pointerEvents: 'none',
                    },
                  }}
                >
                  <LeftSidebar
                    activeView={"reid"}
                    setActiveView={setActiveView}
                  />

                  <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
                    <ReidView />
                  </Box>
                </Box>
              </ReidProvider>
            }
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

// Wrap the app with all necessary providers
function AppWithProviders() {
  return <App />;
}

export default AppWithProviders;
