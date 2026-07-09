import React, { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, RoundedBox, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { CubeErrorBoundary, isWebglAvailable } from './CubeErrorBoundary';
import { useBankCubeFaces } from './useBankCubeFaces';
import { MinimalCubeGlyph, minimalCubeGlyphDataUrl } from './MinimalCubeGlyph';

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

function Cube({
  faceUrls,
  spinBoost = 1,
  paused = false,
  onToggle,
}: {
  faceUrls: string[];
  spinBoost?: number;
  paused?: boolean;
  onToggle?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const target = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    // slow continuous rotation, sped up by spinBoost during the enter animation.
    // Clicking the cube toggles `paused`, which freezes the auto-spin.
    if (!paused) {
      groupRef.current.rotation.y += delta * 0.18 * spinBoost;
    }
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
      onClick={(e) => {
        e.stopPropagation();
        onToggle?.();
      }}
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

/**
 * Pure-CSS rotating cube used whenever WebGL is unavailable (locked-down
 * browsers, some headless preview/test tools). Unlike a static logo card,
 * this still rotates continuously and can be paused by clicking, so the
 * sidebar never falls back to what looks like a second plain logo card.
 */
function CssRotatingCubeFallback({ size, faceUrls }: { size: number; faceUrls: string[] }) {
  const [paused, setPaused] = useState(false);
  // Only 4 side faces are ever visible on a Y-axis-spinning cube; skip
  // top/bottom and use the first 4 branded textures. IMPORTANT: the Wasl
  // wordmark logo must never be used here, even as a last-resort fallback —
  // use the neutral, non-logo glyph instead so this path can never
  // reintroduce the duplicate-logo bug.
  const neutral = minimalCubeGlyphDataUrl();
  const sideFaces = (faceUrls.length ? faceUrls : [neutral]).slice(0, 4);
  while (sideFaces.length < 4) sideFaces.push(sideFaces[0] ?? neutral);
  const half = size / 2;

  return (
    <div
      style={{ width: size, height: size, perspective: size * 3 }}
      className="mx-auto select-none cursor-pointer"
      role="button"
      aria-label="Toggle cube rotation"
      onClick={() => setPaused((p) => !p)}
    >
      <div
        className="relative w-full h-full"
        style={{
          transformStyle: 'preserve-3d',
          animation: 'wasl-cube-spin 16s linear infinite',
          animationPlayState: paused ? 'paused' : 'running',
        }}
      >
        {sideFaces.map((url, i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-2xl border border-white/15 bg-[#0c0c16] flex items-center justify-center overflow-hidden"
            style={{
              transform: `rotateY(${i * 90}deg) translateZ(${half}px)`,
              boxShadow: 'inset 0 0 30px rgba(124,58,237,0.15)',
            }}
          >
            <img src={url} alt="" className="w-2/3 h-auto opacity-90" draggable={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RotatingCube({
  size = 240,
  spinBoost = 1,
  glass = false,
}: {
  size?: number;
  spinBoost?: number;
  /** Wrap the cube in a glassmorphism container with purple/blue glow (sidebar widget mode). */
  glass?: boolean;
}) {
  const webglOk = useMemo(() => isWebglAvailable(), []);
  const [contextLost, setContextLost] = useState(false);
  const [paused, setPaused] = useState(false);
  const faceUrls = useBankCubeFaces();

  const fallback = <CssRotatingCubeFallback size={size} faceUrls={faceUrls} />;

  const canvas = !webglOk || contextLost ? fallback : (
    <CubeErrorBoundary fallback={fallback}>
      <div
        style={{ width: size, height: size }}
        className="mx-auto select-none cursor-pointer"
        role="button"
        aria-label="Toggle cube rotation"
        onClick={() => setPaused((p) => !p)}
      >
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
            <Cube faceUrls={faceUrls} spinBoost={spinBoost} paused={paused} onToggle={() => setPaused((p) => !p)} />
            <Environment preset="city" />
          </Suspense>
        </Canvas>
      </div>
    </CubeErrorBoundary>
  );

  if (!glass) return canvas;

  return (
    <div
      className="relative mx-auto flex items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl overflow-hidden"
      style={{
        width: size + 40,
        height: size + 40,
        maxWidth: '100%',
        boxShadow:
          '0 0 40px 6px rgba(124,58,237,0.22), 0 0 60px 14px rgba(59,130,246,0.14), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 40%, rgba(124,58,237,0.18), transparent 70%)' }}
      />
      {canvas}
    </div>
  );
}
