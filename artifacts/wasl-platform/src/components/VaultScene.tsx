import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MeshReflectorMaterial, Sparkles, RoundedBox, Edges, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import logoUrl from '@assets/wasl_brand/wasl_logo_2026.png';

const NEON = '#3b82f6';
const VIOLET = '#7c3aed';

function Floor() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-1.8} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <MeshReflectorMaterial
        blur={[400, 120]}
        resolution={1024}
        mixBlur={1}
        mixStrength={45}
        roughness={0.9}
        depthScale={1.1}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.2}
        color="#030308"
        metalness={0.7}
        mirror={0.4}
      />
    </mesh>
  );
}

function LightRays() {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (group.current) group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.05) * 0.05;
  });
  return (
    <group ref={group} position={[0, 4, -2]}>
      {[-1.4, -0.5, 0.4, 1.3].map((x, i) => (
        <mesh key={i} position={[x, -1, 0]} rotation={[0.15, 0, x * 0.12]}>
          <coneGeometry args={[1.1, 7, 24, 1, true]} />
          <meshBasicMaterial
            color={i % 2 === 0 ? NEON : VIOLET}
            transparent
            opacity={0.05}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function DoorPanel({ side, open }: { side: 'left' | 'right'; open: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const sign = side === 'left' ? -1 : 1;
  const closedX = sign * 1.02;
  const openX = sign * 2.9;

  useFrame((_, delta) => {
    if (!ref.current) return;
    const targetX = open ? openX : closedX;
    ref.current.position.x = THREE.MathUtils.damp(ref.current.position.x, targetX, 2.2, delta);
  });

  return (
    <group ref={ref} position={[closedX, 0.4, 0]}>
      <RoundedBox args={[2.05, 4.4, 0.18]} radius={0.04} smoothness={4} castShadow>
        <meshPhysicalMaterial
          color="#050507"
          metalness={0.85}
          roughness={0.15}
          clearcoat={1}
          clearcoatRoughness={0.1}
          transmission={0.12}
          reflectivity={0.9}
          ior={1.5}
        />
        <Edges scale={1.001} threshold={1}>
          <lineBasicMaterial color={NEON} toneMapped={false} />
        </Edges>
      </RoundedBox>
      {/* Neon trim strip along the inner edge */}
      <mesh position={[sign * -1.0, 0, 0.1]}>
        <boxGeometry args={[0.03, 4.35, 0.05]} />
        <meshBasicMaterial color={NEON} toneMapped={false} />
      </mesh>
      <pointLight position={[sign * -1.0, 0, 0.5]} color={NEON} intensity={4} distance={3} />
    </group>
  );
}

function Logo({ open }: { open: boolean }) {
  const texture = useTexture(logoUrl);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.position.y = 3.1 + Math.sin(state.clock.elapsedTime * 0.6) * 0.06;
    const targetOpacity = open ? 0 : 1;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = THREE.MathUtils.damp(mat.opacity, targetOpacity, 3, delta);
  });
  // Source logo is 1939x900 (~2.154:1) — keep the plane at that aspect ratio
  // so the wordmark doesn't look stretched.
  const width = 2.6;
  const height = width / (1939 / 900);
  return (
    <mesh ref={ref} position={[0, 3.1, 0.3]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

function CameraRig({ entering }: { entering: boolean }) {
  const { camera } = useThree();
  // Smooth the look-at target itself (not just the camera position) so the
  // orientation eases into the push-through instead of snapping the instant
  // `entering` flips.
  const lookTarget = useRef(new THREE.Vector3(0, 0.6, 0));

  useFrame((_, delta) => {
    const targetZ = entering ? -3.5 : 7.2;
    const targetY = entering ? 1 : 0.6;
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, entering ? 0.55 : 1.4, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 1.2, delta);

    const targetLookZ = entering ? -8 : 0;
    lookTarget.current.y = THREE.MathUtils.damp(lookTarget.current.y, 0.6, 1.2, delta);
    lookTarget.current.z = THREE.MathUtils.damp(lookTarget.current.z, targetLookZ, 0.7, delta);
    camera.lookAt(lookTarget.current);
  });
  return null;
}

function Scene({ entering }: { entering: boolean }) {
  return (
    <>
      <color attach="background" args={['#050510']} />
      <fog attach="fog" args={['#050510', 6, 22]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 6, 4]} intensity={0.8} color="#ffffff" />
      <pointLight position={[0, 3.4, 1]} color={VIOLET} intensity={6} distance={6} />
      <pointLight position={[0, -1, 3]} color={NEON} intensity={3} distance={8} />

      <Suspense fallback={null}>
        <Logo open={entering} />
      </Suspense>
      <DoorPanel side="left" open={entering} />
      <DoorPanel side="right" open={entering} />
      <Floor />
      <LightRays />
      <Sparkles count={90} scale={[9, 6, 5]} size={2.2} speed={0.25} color={VIOLET} opacity={0.6} />
      <Sparkles count={40} scale={[6, 4, 4]} size={1.4} speed={0.4} color={NEON} opacity={0.5} />
      <CameraRig entering={entering} />
    </>
  );
}

export function VaultScene({ entering = false }: { entering?: boolean }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.6, 7.2], fov: 42 }}
      gl={{ antialias: true, alpha: false }}
    >
      <Scene entering={entering} />
    </Canvas>
  );
}
