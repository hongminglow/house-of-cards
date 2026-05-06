import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Environment, Float, OrbitControls, Text } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { RoomPublicState } from "../../shared/types";

type Props = {
  room: RoomPublicState | null;
  playerSeat: number | null;
};

export function PokerTableScene({ room, playerSeat }: Props) {
  return (
    <Canvas camera={{ position: [0, 5.45, 7.7], fov: 42 }} shadows dpr={[1, 2]}>
      <color attach="background" args={["#07110f"]} />
      <fog attach="fog" args={["#07110f", 11, 27]} />
      <ambientLight intensity={0.5} />
      <directionalLight castShadow position={[3.8, 7.2, 4.4]} intensity={2.35} />
      <spotLight castShadow position={[0, 5.6, 3.4]} angle={0.42} penumbra={0.72} intensity={2.8} color="#ffe1a3" />
      <pointLight position={[0, 2.7, -1.8]} intensity={2.2} color="#f7d08a" />
      <pointLight position={[-2.4, 2.4, -2.4]} intensity={0.8} color="#75d8b5" />
      <CameraTarget />
      <TableSurface />
      <CommunityCards room={room} />
      <DealerPortrait room={room} />
      <ChipStacks room={room} />
      <SeatMarkers room={room} playerSeat={playerSeat} />
      <Environment preset="night" />
      <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={1.18} minPolarAngle={0.72} />
    </Canvas>
  );
}

function CameraTarget() {
  const { camera, size } = useThree();
  useFrame(() => {
    const narrow = size.width < 700;
    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFov = narrow ? 72 : 42;
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.12);
        camera.updateProjectionMatrix();
      }
    }
    const targetPosition = narrow ? new THREE.Vector3(0, 9.2, 14.4) : new THREE.Vector3(0, 5.45, 7.7);
    camera.position.lerp(targetPosition, 0.08);
    camera.lookAt(0, narrow ? 0.35 : 0.78, narrow ? 0.1 : -0.25);
  });
  return null;
}

function TableSurface() {
  return (
    <group>
      <mesh receiveShadow position={[0, -0.1, 0]}>
        <cylinderGeometry args={[5.8, 5.8, 0.16, 96]} />
        <meshStandardMaterial color="#12382f" roughness={0.82} metalness={0.05} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <ringGeometry args={[4.55, 4.75, 96]} />
        <meshStandardMaterial color="#c7974d" roughness={0.45} metalness={0.35} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.045, 0]}>
        <ringGeometry args={[1.5, 1.55, 96]} />
        <meshStandardMaterial color="#2b7d69" roughness={0.8} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.055, -2.05]}>
        <ringGeometry args={[0.52, 0.62, 40]} />
        <meshStandardMaterial color="#d6aa54" roughness={0.5} metalness={0.3} />
      </mesh>
    </group>
  );
}

function DealerPortrait({ room }: { room: RoomPublicState | null }) {
  const dealing = room?.street !== "waiting" && room?.street !== "settled";
  return (
    <Float speed={1.05} rotationIntensity={0.025} floatIntensity={0.05}>
      <group position={[0, 0.22, -2.55]} scale={1.65}>
        <CroupierBackdrop />
        <CroupierHeroPortrait dealing={dealing} />
      </group>
    </Float>
  );
}

function CroupierBackdrop() {
  return (
    <group position={[0, 1.25, -0.52]}>
      <mesh position={[0, 0.12, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.62, 0.035, 32, 72]} />
        <meshStandardMaterial color="#c7974d" emissive="#3d2708" emissiveIntensity={0.24} roughness={0.34} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.18, 0.06]} scale={[0.7, 0.9, 0.08]}>
        <sphereGeometry args={[0.24, 28, 16]} />
        <meshStandardMaterial color="#c7974d" emissive="#3d2708" emissiveIntensity={0.16} roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, -0.08, 0.06]} rotation-x={Math.PI}>
        <coneGeometry args={[0.22, 0.42, 3]} />
        <meshStandardMaterial color="#c7974d" emissive="#3d2708" emissiveIntensity={0.16} roughness={0.4} metalness={0.5} />
      </mesh>
    </group>
  );
}

function CroupierHeroPortrait({ dealing = false }: { dealing?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const sourceTexture = useLoader(THREE.TextureLoader, "/assets/house-of-cards-croupier.png");
  const texture = useMemo(() => {
    const cropped = sourceTexture.clone();
    cropped.colorSpace = THREE.SRGBColorSpace;
    cropped.wrapS = THREE.ClampToEdgeWrapping;
    cropped.wrapT = THREE.ClampToEdgeWrapping;
    cropped.repeat.set(0.43, 0.9);
    cropped.offset.set(0.43, 0.02);
    cropped.needsUpdate = true;
    return cropped;
  }, [sourceTexture]);
  const alphaMap = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(128, 112, 72, 128, 112, 182);
      gradient.addColorStop(0, "rgb(255,255,255)");
      gradient.addColorStop(0.58, "rgb(255,255,255)");
      gradient.addColorStop(1, "rgb(0,0,0)");
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 256);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.needsUpdate = true;
    return map;
  }, []);

  useFrame(({ pointer, clock }) => {
    if (!group.current) return;
    const pulse = dealing ? Math.sin(clock.elapsedTime * 2.2) * 0.006 : 0;
    const yaw = THREE.MathUtils.clamp(pointer.x * 0.075, -0.07, 0.07);
    const pitch = THREE.MathUtils.clamp(pointer.y * 0.04, -0.025, 0.035);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, yaw, 0.06);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -pitch + pulse, 0.06);
  });

  return (
    <group ref={group} position={[0, 1.08, 0.42]} rotation={[0.03, 0, 0]}>
      <mesh castShadow>
        <planeGeometry args={[2.5, 2.78]} />
        <meshBasicMaterial map={texture} alphaMap={alphaMap} transparent opacity={0.98} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.06, -0.012]}>
        <planeGeometry args={[2.62, 2.9]} />
        <meshBasicMaterial color="#07110f" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

function CommunityCards({ room }: { room: RoomPublicState | null }) {
  const cards = room?.communityCards ?? [];
  return (
    <group position={[-1.72, 0.13, 0.15]}>
      {Array.from({ length: 5 }, (_, index) => {
        const card = cards[index];
        return (
          <group key={index} position={[index * 0.86, 0, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.62, 0.035, 0.88]} />
              <meshStandardMaterial color={card ? "#f8f2df" : "#1f5f50"} roughness={0.52} />
            </mesh>
            {card ? (
              <Text
                position={[0, 0.03, 0]}
                rotation-x={-Math.PI / 2}
                fontSize={0.2}
                color={card.suit === "hearts" || card.suit === "diamonds" ? "#ba2732" : "#111816"}
                anchorX="center"
                anchorY="middle"
              >
                {card.rank}
              </Text>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

function ChipStacks({ room }: { room: RoomPublicState | null }) {
  return (
    <group>
      {(room?.seats ?? []).map((seat) => {
        const angle = (seat.seatIndex / 6) * Math.PI * 2 + Math.PI / 6;
        const radius = 3.7;
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;
        const chips = Math.min(8, Math.max(1, Math.ceil(seat.currentBet / 1000)));
        return (
          <group key={seat.userId} position={[x * 0.72, 0.15, z * 0.72]}>
            {Array.from({ length: chips }, (_, index) => (
              <mesh key={index} position={[0, index * 0.045, 0]} castShadow>
                <cylinderGeometry args={[0.16, 0.16, 0.04, 24]} />
                <meshStandardMaterial color={index % 2 ? "#f2ca63" : "#bf3342"} roughness={0.4} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function SeatMarkers({ room, playerSeat }: Props) {
  const points = useMemo(
    () =>
      Array.from({ length: 6 }, (_, seatIndex) => {
        const angle = (seatIndex / 6) * Math.PI * 2 + Math.PI / 6;
        return {
          seatIndex,
          x: Math.sin(angle) * 4.35,
          z: Math.cos(angle) * 4.35
        };
      }),
    []
  );

  return (
    <group>
      {points.map((point) => {
        const occupied = room?.seats.find((seat) => seat.seatIndex === point.seatIndex);
        const isLocal = playerSeat === point.seatIndex;
        return (
          <mesh key={point.seatIndex} position={[point.x, 0.08, point.z]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.34, 0.39, 32]} />
            <meshStandardMaterial color={isLocal ? "#e8ca80" : occupied ? "#82d8b9" : "#35534b"} roughness={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}
