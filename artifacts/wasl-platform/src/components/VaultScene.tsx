import React, { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, MeshReflectorMaterial, RoundedBox, Sparkles, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { useBankCubeFaces } from './useBankCubeFaces';
import { useTexture } from '@react-three/drei';

const PURPLE = '#7c3aed';
const BLUE = '#3b82f6';

function Floor() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-1.9} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <MeshReflectorMaterial
        blur={[350, 110]}
        resolution={1024}
        mixBlur={1}
        mixStrength={40}
        roughness={0.95}
        depthScale={1.1}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.2}
        color="#04040c"
        metalness={0.6}
        mirror={0.35}
      />
    </mesh>
  );
}

/** A giant transparent glass door panel with a metal frame and neon glow,
 * positioned behind the cube. Slides open outward when `open` is true. */
function VaultDoor({ side, open }: { side: 'left' | 'right'; open: boolean }) {
  const group = useRef<THREE.Group>(null);
  const sign = side === 'left' ? -1 : 1;
  const closedX = sign * 1.55;
  const openX = sign * 3.6;

  useFrame((_, delta) => {
    if (!group.current) return;
    const target = open ? openX : closedX;
    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, target, 1.8, delta);
  });

  return (
    <group ref={group} position={[closedX, 0.3, -3.2]}>
      {/* glass pane */}
      <mesh castShadow>
        <boxGeometry args={[3, 6.4, 0.12]} />
        <meshPhysicalMaterial
          color="#0b0b16"
          metalness={0.2}
          roughness={0.05}
          transmission={0.85}
          thickness={0.6}
          ior={1.4}
          clearcoat={1}
          reflectivity={0.6}
          transparent
          opacity={0.55}
        />
      </mesh>
      {/* metal frame */}
      <mesh>
        <boxGeometry args={[3.08, 6.48, 0.06]} />
        <meshStandardMaterial color="#1a1a24" metalness={0.9} roughness={0.3} wireframe />
      </mesh>
      {/* inner edge neon strip */}
      <mesh position={[sign * -1.45, 0, 0.1]}>
        <boxGeometry args={[0.035, 6.3, 0.05]} />
        <meshBasicMaterial color={side === 'left' ? PURPLE : BLUE} toneMapped={false} />
      </mesh>
      <pointLight position={[sign * -1.45, 0, 0.6]} color={side === 'left' ? PURPLE : BLUE} intensity={5} distance={4} />
    </group>
  );
}

/** Side glass walls that converge slightly, framing the space like an
 * executive glass tower interior. */
function SideWalls() {
  return (
    <>
      {[-1, 1].map((sign) => (
        <mesh key={sign} position={[sign * 5.5, 0.5, -1]} rotation={[0, sign * 0.28, 0]}>
          <planeGeometry args={[10, 8]} />
          <meshPhysicalMaterial
            color="#050510"
            metalness={0.4}
            roughness={0.2}
            transmission={0.3}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  );
}

function CubeFaceMaterial({ url, index }: { url: string; index: number }) {
  const texture = useTexture(url);
  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
  }, [texture]);
  // Keep the logo map itself bright/legible (color stays near-white so it
  // isn't tinted dark by the multiply), while the surrounding glass reads as
  // black/metallic because the scene itself is unlit and dark — the glossy
  // clearcoat + high metalness + reflections carry the "black glass" look.
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

  useFrame((state, delta) => {
    if (!group.current) return;
    const spinBoost = entering ? 9 : 1;
    group.current.rotation.y += delta * 0.2 * spinBoost;
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, target.current.y, 0.04);
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, target.current.x * 0.12, 0.04);
    // shrink slightly as the camera passes through it during the enter sequence
    const scale = entering ? THREE.MathUtils.damp(group.current.scale.x, 2.6, 0.7, delta) : 1;
    group.current.scale.setScalar(scale);
  });

  const handlePointerMove = (e: any) => {
    target.current = { x: (e.point.x || 0) * 0.15, y: (e.point.y || 0) * 0.15 };
  };

  return (
    <group ref={group} onPointerMove={handlePointerMove} position={[0, 0.3, 0]}>
      <RoundedBox args={[2.2, 2.2, 2.2]} radius={0.08} smoothness={6} castShadow receiveShadow>
        {faceUrls.map((url, i) => (
          <CubeFaceMaterial key={i} url={url} index={i} />
        ))}
        <Edges scale={1.003} threshold={1}>
          <lineBasicMaterial color={PURPLE} toneMapped={false} />
        </Edges>
      </RoundedBox>
    </group>
  );
}

function CameraRig({ entering }: { entering: boolean }) {
  const { camera } = useThree();
  const lookTarget = useRef(new THREE.Vector3(0, 0.3, 0));

  useFrame((_, delta) => {
    const targetZ = entering ? -4.5 : 6.4;
    const targetY = entering ? 0.4 : 0.35;
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, entering ? 0.5 : 1.4, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 1.2, delta);

    const targetLookZ = entering ? -10 : 0;
    lookTarget.current.z = THREE.MathUtils.damp(lookTarget.current.z, targetLookZ, 0.7, delta);
    camera.lookAt(lookTarget.current);
  });
  return null;
}

function Scene({ entering }: { entering: boolean }) {
  return (
    <>
      <color attach="background" args={['#050816']} />
      <fog attach="fog" args={['#050816', 5, 20]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[3, 6, 4]} intensity={0.9} color="#ffffff" castShadow />
      <pointLight position={[0, 2.2, 2.5]} color={PURPLE} intensity={5} distance={7} />
      <pointLight position={[0, -1, 1.5]} color={BLUE} intensity={2.5} distance={8} />

      <Suspense fallback={null}>
        <VaultCube entering={entering} />
        <Environment preset="city" />
      </Suspense>
      <VaultDoor side="left" open={entering} />
      <VaultDoor side="right" open={entering} />
      <SideWalls />
      <Floor />
      <Sparkles count={70} scale={[8, 5, 5]} size={2} speed={0.25} color={PURPLE} opacity={0.55} />
      <Sparkles count={35} scale={[6, 4, 4]} size={1.3} speed={0.35} color={BLUE} opacity={0.45} />
      <CameraRig entering={entering} />
    </>
  );
}

export function VaultScene({ entering = false }: { entering?: boolean }) {
  const [contextLost, setContextLost] = useState(false);
  if (contextLost) return null;

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.35, 6.4], fov: 42 }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
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
