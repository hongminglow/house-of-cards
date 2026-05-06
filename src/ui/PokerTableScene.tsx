import { Canvas, useFrame, useThree } from "@react-three/fiber";
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
    <Canvas camera={{ position: [0, 6.2, 8.8], fov: 42 }} shadows>
      <color attach="background" args={["#07110f"]} />
      <fog attach="fog" args={["#07110f", 10, 26]} />
      <ambientLight intensity={0.55} />
      <directionalLight castShadow position={[3, 6, 4]} intensity={2.2} />
      <pointLight position={[0, 2.4, 0]} intensity={1.4} color="#f7d08a" />
      <CameraTarget />
      <TableSurface />
      <CommunityCards room={room} />
      <Dealer />
      <ChipStacks room={room} />
      <SeatMarkers room={room} playerSeat={playerSeat} />
      <Environment preset="night" />
      <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={1.25} minPolarAngle={0.75} />
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
    const targetPosition = narrow ? new THREE.Vector3(0, 9.6, 15.2) : new THREE.Vector3(0, 6.2, 8.8);
    camera.position.lerp(targetPosition, 0.08);
    camera.lookAt(0, narrow ? 0 : 0.35, 0);
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
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
        <ringGeometry args={[1.5, 1.55, 96]} />
        <meshStandardMaterial color="#2b7d69" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Dealer() {
  const head = useRef<THREE.Group>(null);
  const eyeLeft = useRef<THREE.Mesh>(null);
  const eyeRight = useRef<THREE.Mesh>(null);

  useFrame(({ pointer }) => {
    const yaw = THREE.MathUtils.clamp(pointer.x * 0.35, -0.28, 0.28);
    const pitch = THREE.MathUtils.clamp(pointer.y * 0.18, -0.08, 0.12);
    if (head.current) {
      head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, yaw, 0.08);
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, -pitch, 0.08);
    }
    [eyeLeft.current, eyeRight.current].forEach((eye) => {
      if (eye) {
        eye.position.x = THREE.MathUtils.lerp(eye.position.x, pointer.x * 0.025, 0.12);
        eye.position.y = THREE.MathUtils.lerp(eye.position.y, 0.02 + pointer.y * 0.018, 0.12);
      }
    });
  });

  return (
    <Float speed={1.2} rotationIntensity={0.04} floatIntensity={0.09}>
      <group position={[0, 0.58, -2.7]}>
        <mesh castShadow position={[0, 0.48, 0]}>
          <capsuleGeometry args={[0.48, 0.72, 12, 24]} />
          <meshStandardMaterial color="#1a1f27" roughness={0.5} />
        </mesh>
        <group ref={head} position={[0, 1.24, 0.05]}>
          <mesh castShadow>
            <sphereGeometry args={[0.42, 32, 32]} />
            <meshStandardMaterial color="#d9a579" roughness={0.48} />
          </mesh>
          <mesh position={[0, 0.28, -0.02]}>
            <sphereGeometry args={[0.45, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#16100d" roughness={0.7} />
          </mesh>
          <mesh ref={eyeLeft} position={[-0.14, 0.03, 0.38]}>
            <sphereGeometry args={[0.035, 16, 16]} />
            <meshStandardMaterial color="#101412" />
          </mesh>
          <mesh ref={eyeRight} position={[0.14, 0.03, 0.38]}>
            <sphereGeometry args={[0.035, 16, 16]} />
            <meshStandardMaterial color="#101412" />
          </mesh>
        </group>
        <mesh castShadow position={[-0.52, 0.48, 0.28]} rotation-z={0.7}>
          <capsuleGeometry args={[0.08, 0.7, 8, 12]} />
          <meshStandardMaterial color="#d9a579" roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0.52, 0.48, 0.28]} rotation-z={-0.7}>
          <capsuleGeometry args={[0.08, 0.7, 8, 12]} />
          <meshStandardMaterial color="#d9a579" roughness={0.5} />
        </mesh>
      </group>
    </Float>
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
