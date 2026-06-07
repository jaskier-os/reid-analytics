import React, { useState, useEffect, Suspense } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { ViewInAr } from '@mui/icons-material';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import reidService from '../../services/reidService';

const Face3DViewer = ({ personId, modelVersion = 0 }) => {
  const [state, setState] = useState('loading');
  const [scene, setScene] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const modelUrl = `${reidService.getPersonFace3DUrl(personId)}?v=${modelVersion}`;

  useEffect(() => {
    setState('loading');
    setScene(null);
    setErrorMsg(null);

    const controller = new AbortController();

    fetch(modelUrl, { signal: controller.signal })
      .then(res => {
        if (!res.ok) {
          setState('empty');
          return null;
        }
        return res.arrayBuffer();
      })
      .then(data => {
        if (!data) return;

        if (data.byteLength < 12) {
          console.error('Face3D: response too small to be a valid GLB', data.byteLength);
          setState('empty');
          return;
        }

        const loader = new GLTFLoader();
        loader.parse(data, '', (gltf) => {
          const loaded = gltf.scene;

          const box = new THREE.Box3().setFromObject(loaded);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);

          if (maxDim > 0) {
            const scale = 2 / maxDim;
            loaded.scale.setScalar(scale);
            loaded.position.copy(center).multiplyScalar(-scale);
          }

          loaded.traverse((child) => {
            if (child.isMesh) {
              if (!child.material) {
                child.material = new THREE.MeshStandardMaterial({
                  color: 0xcccccc,
                  roughness: 0.5,
                  metalness: 0.1
                });
              }
              child.material.side = THREE.DoubleSide;
            }
          });

          setScene(loaded);
          setState('ready');
        }, (err) => {
          console.error('Face3D: GLB parse failed:', err);
          setErrorMsg(String(err.message || err));
          setState('error');
        });
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.error('Face3D: fetch failed:', err);
        setErrorMsg(err.message);
        setState('error');
      });

    return () => controller.abort();
  }, [modelUrl]);

  if (state === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6, flexDirection: 'column', gap: 1 }}>
        <CircularProgress size={32} />
        <Typography variant="caption" color="text.secondary">Loading 3D model...</Typography>
      </Box>
    );
  }

  if (state === 'empty') {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <ViewInAr sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No 3D model available
        </Typography>
        <Typography variant="caption" color="text.secondary">
          3D face reconstruction will be generated when the person is next detected
        </Typography>
      </Box>
    );
  }

  if (state === 'error') {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <ViewInAr sx={{ fontSize: 48, color: '#fb4934', mb: 1 }} />
        <Typography variant="body2" sx={{ color: '#fb4934' }}>
          Failed to load 3D model
        </Typography>
        {errorMsg && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {errorMsg}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: "100%",
        borderRadius: 2,
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #282828 0%, #3c3836 100%)'
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 3], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-5, -5, -5]} intensity={0.3} />
        <primitive object={scene} />
        <Suspense fallback={null}>
          <Environment preset="studio" />
        </Suspense>
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          autoRotate={true}
          autoRotateSpeed={2}
        />
      </Canvas>
    </Box>
  );
};

export default Face3DViewer;
