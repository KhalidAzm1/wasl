import React, { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, RoundedBox, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useListBanks } from '@workspace/api-client-react';
import waslLogoUrl from '@assets/wasl_brand/wasl_logo_2026.png';
import { CubeErrorBoundary, isWebglAvailable } from './CubeErrorBoundary';

// Known flagship banks whose logos should appear on the cube faces.
const FACE_BANK_NAMES = ['Al Rajhi', 'Saudi National', 'Alinma', 'Riyad Bank', 'Fransi'];

function makeFaceTexture(imageUrl: string | null | undefined): string {
  // Falls back to a blank transparent pixel if no logo is available yet.
  return imageUrl || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz4=';
}

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
      metalness={0.75}
      roughness={0.12}
      clearcoat={1}
      clearcoatRoughness={0.08}
      transmission={0.15}
      ior={1.4}
      reflectivity={0.9}
      color="#f5f5f8"
    />
  );
}

function Cube({ faceUrls }: { faceUrls: string[] }) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const target = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    // slow continuous rotation
    groupRef.current.rotation.y += delta * 0.18;
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, target.current.y, 0.04);
    groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, target.current.x * 0.15, 0.04);
  });

  const handlePointerMove = (e: any) => {
    target.current = {
      x: (e.point.x || 0) * 0.15,
      y: (e.point.y || 0) * 0.15,
    };
  };

  return (
    <group
      ref={groupRef}
      onPointerMove={handlePointerMove}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      scale={hovered ? 1.04 : 1}
    >
      <RoundedBox args={[2.2, 2.2, 2.2]} radius={0.08} smoothness={6} castShadow receiveShadow>
        {faceUrls.map((url, i) => (
          <CubeFaceMaterial key={i} url={url} index={i} />
        ))}
      </RoundedBox>
    </group>
  );
}

function StaticCubeFallback({ size }: { size: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="mx-auto flex items-center justify-center rounded-3xl bg-gradient-to-br from-white/10 via-primary/10 to-secondary/10 border border-white/10 shadow-[0_0_40px_rgba(124,58,237,0.15)]"
    >
      <img src={waslLogoUrl} alt="Wasl" className="w-2/3 h-auto opacity-80 drop-shadow-lg" />
    </div>
  );
}

export function RotatingCube({ size = 280 }: { size?: number }) {
  const { data: banks } = useListBanks();
  const webglOk = useMemo(() => isWebglAvailable(), []);
  const [contextLost, setContextLost] = useState(false);

  const faceUrls = useMemo(() => {
    const findLogo = (fragment: string) => {
      const bank = (banks || []).find(b => b.nameEn.toLowerCase().includes(fragment.toLowerCase()));
      return bank?.logoUrl || null;
    };
    return [
      makeFaceTexture(waslLogoUrl),
      makeFaceTexture(findLogo(FACE_BANK_NAMES[0])),
      makeFaceTexture(findLogo(FACE_BANK_NAMES[1])),
      makeFaceTexture(findLogo(FACE_BANK_NAMES[2])),
      makeFaceTexture(findLogo(FACE_BANK_NAMES[3])),
      makeFaceTexture(findLogo(FACE_BANK_NAMES[4])),
    ];
  }, [banks]);

  const fallback = <StaticCubeFallback size={size} />;

  if (!webglOk || contextLost) return fallback;

  return (
    <CubeErrorBoundary fallback={fallback}>
      <div style={{ width: size, height: size }} className="mx-auto select-none">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 0, 5.2], fov: 35 }}
          gl={{ alpha: true, antialias: true }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              setContextLost(true);
            });
          }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight position={[4, 5, 3]} intensity={1.4} castShadow />
          <pointLight position={[-4, -2, -3]} intensity={0.6} color="#7c3aed" />
          <pointLight position={[3, -3, 3]} intensity={0.5} color="#22d3ee" />
          <Suspense fallback={null}>
            <Cube faceUrls={faceUrls} />
            <Environment preset="city" />
          </Suspense>
        </Canvas>
      </div>
    </CubeErrorBoundary>
  );
}
