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
      <Dealer room={room} />
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

function Dealer({ room }: { room: RoomPublicState | null }) {
  const head = useRef<THREE.Group>(null);
  const eyeLeft = useRef<THREE.Mesh>(null);
  const eyeRight = useRef<THREE.Mesh>(null);
  const torso = useRef<THREE.Group>(null);
  const leftForearm = useRef<THREE.Group>(null);
  const rightForearm = useRef<THREE.Group>(null);
  const cardFan = useRef<THREE.Group>(null);
  const dealCard = useRef<THREE.Group>(null);

  useFrame(({ pointer, clock }) => {
    const frontY = pointer.y > -0.82 ? pointer.y : -0.25;
    const yaw = THREE.MathUtils.clamp(pointer.x * 0.36, -0.32, 0.32);
    const pitch = THREE.MathUtils.clamp(frontY * 0.2, -0.1, 0.14);
    const dealing = room?.street !== "waiting" && room?.street !== "settled";
    const dealPulse = dealing ? Math.sin(clock.elapsedTime * (room?.street === "preflop" ? 3.4 : 1.8)) * 0.5 + 0.5 : 0;

    if (head.current) {
      head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, yaw, 0.08);
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, -pitch, 0.08);
    }
    if (torso.current) {
      torso.current.rotation.y = THREE.MathUtils.lerp(torso.current.rotation.y, yaw * 0.16, 0.04);
    }
    [eyeLeft.current, eyeRight.current].forEach((eye) => {
      if (eye) {
        eye.position.x = THREE.MathUtils.lerp(eye.position.x, pointer.x * 0.022, 0.12);
        eye.position.y = THREE.MathUtils.lerp(eye.position.y, 0.02 + frontY * 0.016, 0.12);
      }
    });
    if (leftForearm.current) {
      leftForearm.current.rotation.z = THREE.MathUtils.lerp(leftForearm.current.rotation.z, 0.7 + dealPulse * 0.08, 0.06);
    }
    if (rightForearm.current) {
      rightForearm.current.rotation.z = THREE.MathUtils.lerp(rightForearm.current.rotation.z, -0.72 - dealPulse * 0.12, 0.08);
      rightForearm.current.rotation.x = THREE.MathUtils.lerp(rightForearm.current.rotation.x, 0.08 + dealPulse * 0.12, 0.08);
    }
    if (cardFan.current) {
      cardFan.current.rotation.y = THREE.MathUtils.lerp(cardFan.current.rotation.y, -0.32 + dealPulse * 0.06, 0.05);
    }
    if (dealCard.current) {
      dealCard.current.position.x = THREE.MathUtils.lerp(dealCard.current.position.x, 0.82 + dealPulse * 0.36, 0.08);
      dealCard.current.position.z = THREE.MathUtils.lerp(dealCard.current.position.z, 0.7 + dealPulse * 0.12, 0.08);
      dealCard.current.rotation.z = THREE.MathUtils.lerp(dealCard.current.rotation.z, -0.26 - dealPulse * 0.12, 0.08);
    }
  });

  return (
    <Float speed={1.1} rotationIntensity={0.035} floatIntensity={0.07}>
      <group position={[0, 0.5, -2.95]}>
        <mesh receiveShadow position={[0, -0.04, 0.18]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[1.28, 48]} />
          <meshStandardMaterial color="#07110f" transparent opacity={0.32} />
        </mesh>

        <group ref={torso}>
          <mesh castShadow position={[0, 0.58, 0]} scale={[0.88, 1.08, 0.55]}>
            <capsuleGeometry args={[0.48, 0.72, 12, 28]} />
            <meshStandardMaterial color="#11161b" roughness={0.48} metalness={0.08} />
          </mesh>
          <mesh castShadow position={[0, 0.66, 0.33]} scale={[0.5, 0.86, 0.08]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#f1e2cc" roughness={0.62} />
          </mesh>
          <mesh castShadow position={[-0.2, 0.72, 0.38]} rotation-z={-0.14} scale={[0.14, 0.8, 0.05]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#0b0f12" roughness={0.5} />
          </mesh>
          <mesh castShadow position={[0.2, 0.72, 0.38]} rotation-z={0.14} scale={[0.14, 0.8, 0.05]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#0b0f12" roughness={0.5} />
          </mesh>
          <group position={[0, 1.06, 0.42]}>
            <mesh castShadow position={[-0.09, 0, 0]} rotation-z={Math.PI / 2}>
              <coneGeometry args={[0.1, 0.18, 3]} />
              <meshStandardMaterial color="#07090a" roughness={0.42} />
            </mesh>
            <mesh castShadow position={[0.09, 0, 0]} rotation-z={-Math.PI / 2}>
              <coneGeometry args={[0.1, 0.18, 3]} />
              <meshStandardMaterial color="#07090a" roughness={0.42} />
            </mesh>
            <mesh castShadow>
              <sphereGeometry args={[0.055, 16, 16]} />
              <meshStandardMaterial color="#07090a" roughness={0.42} />
            </mesh>
          </group>
          <mesh position={[-0.24, 0.61, 0.43]} rotation-z={-0.22}>
            <cylinderGeometry args={[0.035, 0.035, 0.02, 18]} />
            <meshStandardMaterial color="#d8aa49" emissive="#4a310c" emissiveIntensity={0.18} roughness={0.36} metalness={0.6} />
          </mesh>
        </group>

        <mesh castShadow position={[0, 1.22, 0.08]}>
          <cylinderGeometry args={[0.13, 0.16, 0.24, 18]} />
          <meshStandardMaterial color="#d6a174" roughness={0.5} />
        </mesh>

        <group ref={head} position={[0, 1.45, 0.12]}>
          <mesh castShadow scale={[0.9, 1.05, 0.82]}>
            <sphereGeometry args={[0.42, 32, 32]} />
            <meshStandardMaterial color="#d9a579" roughness={0.48} />
          </mesh>
          <mesh castShadow position={[0, 0.22, -0.04]} scale={[1.08, 0.72, 0.94]}>
            <sphereGeometry args={[0.43, 32, 14, 0, Math.PI * 2, 0, Math.PI / 1.45]} />
            <meshStandardMaterial color="#5c2f1a" roughness={0.72} />
          </mesh>
          <mesh castShadow position={[-0.37, -0.02, -0.02]} rotation-z={0.1}>
            <capsuleGeometry args={[0.13, 0.44, 10, 14]} />
            <meshStandardMaterial color="#6e391f" roughness={0.76} />
          </mesh>
          <mesh castShadow position={[0.37, -0.02, -0.02]} rotation-z={-0.1}>
            <capsuleGeometry args={[0.13, 0.44, 10, 14]} />
            <meshStandardMaterial color="#6e391f" roughness={0.76} />
          </mesh>
          <mesh position={[-0.15, 0.04, 0.34]}>
            <sphereGeometry args={[0.055, 16, 16]} />
            <meshStandardMaterial color="#f7ead9" roughness={0.35} />
          </mesh>
          <mesh position={[0.15, 0.04, 0.34]}>
            <sphereGeometry args={[0.055, 16, 16]} />
            <meshStandardMaterial color="#f7ead9" roughness={0.35} />
          </mesh>
          <mesh ref={eyeLeft} position={[-0.15, 0.03, 0.385]}>
            <sphereGeometry args={[0.026, 16, 16]} />
            <meshStandardMaterial color="#101412" />
          </mesh>
          <mesh ref={eyeRight} position={[0.15, 0.03, 0.385]}>
            <sphereGeometry args={[0.026, 16, 16]} />
            <meshStandardMaterial color="#101412" />
          </mesh>
          <mesh position={[-0.15, 0.14, 0.37]} rotation-z={0.14}>
            <boxGeometry args={[0.16, 0.018, 0.018]} />
            <meshStandardMaterial color="#3a1b11" roughness={0.6} />
          </mesh>
          <mesh position={[0.15, 0.14, 0.37]} rotation-z={-0.14}>
            <boxGeometry args={[0.16, 0.018, 0.018]} />
            <meshStandardMaterial color="#3a1b11" roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.17, 0.38]} scale={[1, 0.42, 0.32]}>
            <sphereGeometry args={[0.08, 18, 10]} />
            <meshStandardMaterial color="#9c332e" roughness={0.5} />
          </mesh>
          <mesh position={[-0.44, -0.08, 0.08]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.035, 0.006, 8, 16]} />
            <meshStandardMaterial color="#d8aa49" roughness={0.3} metalness={0.78} />
          </mesh>
          <mesh position={[0.44, -0.08, 0.08]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.035, 0.006, 8, 16]} />
            <meshStandardMaterial color="#d8aa49" roughness={0.3} metalness={0.78} />
          </mesh>
        </group>

        <group ref={leftForearm} position={[-0.54, 0.78, 0.34]} rotation={[0.1, 0.1, 0.7]}>
          <mesh castShadow position={[0, -0.28, 0]}>
            <capsuleGeometry args={[0.075, 0.6, 8, 14]} />
            <meshStandardMaterial color="#d8a377" roughness={0.5} />
          </mesh>
          <mesh castShadow position={[0, -0.64, 0.04]} scale={[1.22, 0.66, 0.36]}>
            <sphereGeometry args={[0.11, 18, 12]} />
            <meshStandardMaterial color="#d8a377" roughness={0.5} />
          </mesh>
        </group>

        <group ref={rightForearm} position={[0.56, 0.76, 0.36]} rotation={[0.08, -0.04, -0.72]}>
          <mesh castShadow position={[0, -0.3, 0]}>
            <capsuleGeometry args={[0.075, 0.62, 8, 14]} />
            <meshStandardMaterial color="#d8a377" roughness={0.5} />
          </mesh>
          <mesh castShadow position={[0, -0.68, 0.04]} scale={[1.18, 0.6, 0.34]}>
            <sphereGeometry args={[0.11, 18, 12]} />
            <meshStandardMaterial color="#d8a377" roughness={0.5} />
          </mesh>
        </group>

        <group ref={cardFan} position={[-0.83, 0.73, 0.68]} rotation={[0.16, -0.32, 0.5]}>
          {[-1, 0, 1].map((offset) => (
            <group key={offset} position={[offset * 0.075, 0, Math.abs(offset) * 0.018]} rotation-z={offset * -0.22}>
              <mesh castShadow>
                <boxGeometry args={[0.28, 0.018, 0.4]} />
                <meshStandardMaterial color="#f8f0df" roughness={0.45} />
              </mesh>
              <mesh position={[-0.07, 0.012, -0.12]}>
                <boxGeometry args={[0.055, 0.006, 0.055]} />
                <meshStandardMaterial color={offset === 0 ? "#111816" : "#ba2732"} roughness={0.42} />
              </mesh>
            </group>
          ))}
        </group>

        <group ref={dealCard} position={[0.82, 0.4, 0.7]} rotation={[0.12, 0.06, -0.26]}>
          <mesh castShadow>
            <boxGeometry args={[0.34, 0.016, 0.48]} />
            <meshStandardMaterial color="#f8f0df" roughness={0.44} />
          </mesh>
          <mesh position={[-0.1, 0.011, -0.16]}>
            <boxGeometry args={[0.06, 0.006, 0.06]} />
            <meshStandardMaterial color="#ba2732" roughness={0.42} />
          </mesh>
        </group>
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
