import React, { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, RoundedBox, Sparkles, Edges, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useBankCubeFaces } from './useBankCubeFaces';

const PURPLE = '#7c3aed';
const BLUE = '#3b82f6';

// The architectural environment (glass hallway, converging door frames,
// outer wall signage, floor reflection glow) is composited in CSS via
// `VaultHallwayBackdrop` so it can match the reference image precisely.
// This canvas renders only the one element that must be real 3D per the
// brief: the rotating, bank-branded cube — on a fully transparent
// background so the CSS hallway behind it shows through.

function CubeFaceMaterial({ url, index }: { url: string; index: number }) {
  const texture = useTexture(url);
  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
  }, [texture]);
  return (
    <meshPhysicalMaterial
      attach={`material-${index}`}
      map={texture}
      transparent
      metalness={0.85}
      roughness={0.14}
      clearcoat={1}
      clearcoatRoughness={0.08}
      transmission={0.08}
      ior={1.5}
      reflectivity={1}
      color="#eceef2"
    />
  );
}

function VaultCube({ entering }: { entering: boolean }) {
  const faceUrls = useBankCubeFaces();
  const group = useRef<THREE.Group>(null);
  const target = useRef({ x: 0, y: 0 });

  useFrame((_state, delta) => {
    if (!group.current) return;
    const spinBoost = entering ? 9 : 1;
    group.current.rotation.y += delta * 0.2 * spinBoost;
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, target.current.y, 0.04);
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, target.current.x * 0.12, 0.04);
    // grows toward the camera as it "passes through" during the enter sequence
    const targetScale = entering ? 3.2 : 1;
    const scale = THREE.MathUtils.damp(group.current.scale.x, targetScale, entering ? 0.6 : 4, delta);
    group.current.scale.setScalar(scale);
  });

  const handlePointerMove = (e: any) => {
    target.current = { x: (e.point.x || 0) * 0.15, y: (e.point.y || 0) * 0.15 };
  };

  return (
    <group ref={group} onPointerMove={handlePointerMove} position={[0, 0, 0]}>
      <RoundedBox args={[2.3, 2.3, 2.3]} radius={0.08} smoothness={6} castShadow receiveShadow>
        {faceUrls.map((url, i) => (
          <CubeFaceMaterial key={i} url={url} index={i} />
        ))}
        <Edges scale={1.004} threshold={1}>
          <lineBasicMaterial color={PURPLE} toneMapped={false} />
        </Edges>
      </RoundedBox>
    </group>
  );
}

function CameraRig({ entering }: { entering: boolean }) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    const targetZ = entering ? 1.4 : 5.6;
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, entering ? 0.55 : 1.4, delta);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Scene({ entering }: { entering: boolean }) {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 6, 4]} intensity={0.9} color="#ffffff" />
      <pointLight position={[0, 1.6, 2]} color={PURPLE} intensity={5} distance={7} />
      <pointLight position={[0, -1.2, 1.5]} color={BLUE} intensity={2.5} distance={8} />

      <Suspense fallback={null}>
        <VaultCube entering={entering} />
        <Environment preset="city" />
      </Suspense>
      <Sparkles count={50} scale={[6, 4, 4]} size={1.8} speed={0.25} color={PURPLE} opacity={0.5} />
      <CameraRig entering={entering} />
    </>
  );
}

export function VaultScene({ entering = false }: { entering?: boolean }) {
  const [contextLost, setContextLost] = useState(false);
  if (contextLost) return null;

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 5.6], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          setContextLost(true);
        });
      }}
    >
      <Scene entering={entering} />
    </Canvas>
  );
}
