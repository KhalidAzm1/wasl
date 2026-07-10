import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshReflectorMaterial, Float } from '@react-three/drei';
import * as THREE from 'three';

const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;

import wasLogoUrl from '@assets/wasl_brand/wasl_logo_2026.png';
import snbUrl from '@assets/wasl_brand/bank_cube/snb.png';
import alrajhiUrl from '@assets/wasl_brand/bank_cube/alrajhi.png';
import riyadUrl from '@assets/wasl_brand/bank_cube/riyad.png';
import bsfUrl from '@assets/wasl_brand/bank_cube/bsf.png';
import alinmaUrl from '@assets/wasl_brand/bank_cube/alinma.png';

/**
 * Loads an <img> element directly (no separate TextureLoader/Texture object
 * kept around -- we only need the decoded pixels to draw onto our own
 * canvas), so each face has exactly one GPU texture: the CanvasTexture.
 */
function useDecodedImage(imageUrl: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);
  return image;
}

/**
 * Draws a logo image centered on a dark, softly-lit tile so every cube face
 * reads as a lit panel (matching the reference render) instead of a raw
 * white-background PNG slapped on a box. Disposes its CanvasTexture whenever
 * the texture is recreated or the component unmounts, so no GPU resource
 * outlives the component.
 */
function useFaceTexture(imageUrl: string, accent: string) {
  const image = useDecodedImage(imageUrl);
  const texture = useMemo(() => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const bg = ctx.createLinearGradient(0, 0, size, size);
    bg.addColorStop(0, '#0a0f24');
    bg.addColorStop(1, '#050816');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, size - 6, size - 6);
    ctx.globalAlpha = 1;

    const img = image;
    const iw = img?.naturalWidth ?? size;
    const ih = img?.naturalHeight ?? size;
    const maxDim = size * 0.62;
    const scale = Math.min(maxDim / iw, maxDim / ih);
    const dw = iw * scale;
    const dh = ih * scale;

    // White backing card behind the logo so brand-colored marks stay legible
    // on the dark tile, same treatment the reference render uses.
    const padX = dw * 0.18;
    const padY = dh * 0.28;
    const cardW = dw + padX * 2;
    const cardH = dh + padY * 2;
    const cardX = (size - cardW) / 2;
    const cardY = (size - cardH) / 2;
    const radius = 24;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.beginPath();
    ctx.moveTo(cardX + radius, cardY);
    ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + cardH, radius);
    ctx.arcTo(cardX + cardW, cardY + cardH, cardX, cardY + cardH, radius);
    ctx.arcTo(cardX, cardY + cardH, cardX, cardY, radius);
    ctx.arcTo(cardX, cardY, cardX + cardW, cardY, radius);
    ctx.closePath();
    ctx.fill();

    if (img) {
      ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [image, accent]);

  // Dispose the previous/last CanvasTexture whenever a new one is created or
  // this face unmounts, so GPU memory doesn't accumulate across re-renders.
  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  return texture;
}

const EMISSIVE_COLOR = new THREE.Color('#4f6df5');

function CubeFaces() {
  const top = useFaceTexture(wasLogoUrl, '#7c3aed');
  const front = useFaceTexture(snbUrl, '#3b82f6');
  const back = useFaceTexture(alrajhiUrl, '#3b82f6');
  const left = useFaceTexture(riyadUrl, '#3b82f6');
  const right = useFaceTexture(bsfUrl, '#3b82f6');
  const bottom = useFaceTexture(alinmaUrl, '#3b82f6');

  // BoxGeometry material slot order: +x, -x, +y, -y, +z, -z
  return (
    <>
      {[right, left, top, bottom, front, back].map((tex, i) => (
        <meshStandardMaterial
          key={i}
          attach={`material-${i}`}
          map={tex}
          emissiveMap={tex}
          emissive={EMISSIVE_COLOR}
          emissiveIntensity={0.35}
          roughness={0.35}
          metalness={0.15}
        />
      ))}
    </>
  );
}

function RotatingCube() {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const speedRef = useRef(0.25);

  useFrame((_, delta) => {
    const targetSpeed = hovered ? 0.75 : 0.25;
    speedRef.current += (targetSpeed - speedRef.current) * Math.min(1, delta * 3);
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * speedRef.current;
    }
  });

  return (
    <Float speed={1.4} floatIntensity={0.6} rotationIntensity={0}>
      <group
        ref={groupRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <mesh castShadow>
          <boxGeometry args={[2.1, 2.1, 2.1]} />
          <CubeFaces />
        </mesh>
        <mesh scale={1.015}>
          <boxGeometry args={[2.1, 2.1, 2.1]} />
          <meshBasicMaterial
            color={hovered ? '#8b5cf6' : '#3b82f6'}
            wireframe
            transparent
            opacity={hovered ? 0.55 : 0.3}
          />
        </mesh>
        <pointLight
          color={hovered ? '#a855f7' : '#3b82f6'}
          intensity={hovered ? 3.2 : 1.8}
          distance={5}
        />
      </group>
    </Float>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, 0]}>
      <planeGeometry args={[20, 20]} />
      <MeshReflectorMaterial
        blur={isMobileViewport ? [150, 40] : [400, 100]}
        resolution={isMobileViewport ? 384 : 1024}
        mixBlur={1}
        mixStrength={35}
        roughness={0.9}
        depthScale={1.1}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#050816"
        metalness={0.6}
        mirror={0.3}
      />
    </mesh>
  );
}

/** Interactive Three.js hero cube: continuous Y rotation, gentle float, glow that intensifies on hover. */
export default function EntryCube() {
  return (
    <div className="absolute inset-0">
      <Canvas
        shadows={!isMobileViewport}
        dpr={isMobileViewport ? [1, 1] : [1, 1.5]}
        camera={{ position: [3.2, 1.1, 5.2], fov: 38 }}
        gl={{ antialias: !isMobileViewport, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#050816']} />
        <fog attach="fog" args={['#050816', 6, 16]} />
        <ambientLight intensity={0.35} color="#8ea2ff" />
        <directionalLight position={[4, 6, 4]} intensity={0.6} color="#a5b4fc" />
        <pointLight position={[-4, 2, -3]} intensity={1.2} color="#7c3aed" distance={12} />
        <pointLight position={[4, -1, 3]} intensity={1} color="#3b82f6" distance={12} />
        <Suspense fallback={null}>
          <RotatingCube />
          <Floor />
        </Suspense>
      </Canvas>
    </div>
  );
}
