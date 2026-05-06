import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Float, OrbitControls, Text, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { RoomPublicState } from "../../shared/types";

type Props = {
  room: RoomPublicState | null;
  playerSeat: number | null;
  onCroupierReady?: () => void;
};

type Vec3 = [number, number, number];

type CroupierModelConfig = {
  id: string;
  path: string;
  height: number;
  rotationY: number;
  y: number;
  z: number;
};

type LookTarget = {
  node: THREE.Object3D;
  baseX: number;
  baseY: number;
  pitchScale: number;
  yawScale: number;
};

const CROUPIER_MODELS: CroupierModelConfig[] = [
  { id: "croupier-01", path: "/assets/croupiers/show_breast_girl.glb", height: 2.08, rotationY: 0, y: -1.12, z: -0.02 },
  { id: "croupier-02", path: "/assets/croupiers/school_girl_sit_on_the_chair.glb", height: 2.02, rotationY: 0, y: -1.08, z: -0.04 },
  { id: "croupier-03", path: "/assets/croupiers/stella_girl.glb", height: 2.08, rotationY: 0, y: -1.12, z: -0.02 },
  { id: "croupier-04", path: "/assets/croupiers/fashion_girl_asian_girl.glb", height: 2.08, rotationY: 0, y: -1.12, z: -0.02 },
  { id: "croupier-05", path: "/assets/croupiers/spot_light_girl.glb", height: 2.04, rotationY: 0, y: -1.1, z: -0.02 },
  { id: "croupier-06", path: "/assets/croupiers/new_ciity_mom.glb", height: 2.08, rotationY: 0, y: -1.12, z: -0.02 }
];

export function PokerTableScene({ room, playerSeat, onCroupierReady }: Props) {
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
      <DealerPortrait room={room} onCroupierReady={onCroupierReady} />
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

function DealerPortrait({ room, onCroupierReady }: { room: RoomPublicState | null; onCroupierReady?: () => void }) {
  const dealing = room ? room.street !== "waiting" && room.street !== "settled" : false;
  const model = useMemo(() => selectCroupierModel(room?.roomCode), [room?.roomCode]);

  return (
    <Float speed={1.05} rotationIntensity={0.025} floatIntensity={0.05}>
      <group position={[0, 0.22, -2.55]} scale={1.72}>
        <CroupierBackdrop />
        <Suspense fallback={<CroupierLoadingSilhouette />}>
          <CroupierModel model={model} dealing={dealing} onReady={onCroupierReady} />
        </Suspense>
        <DealerCardFan dealing={dealing} />
      </group>
    </Float>
  );
}

function CroupierBackdrop() {
  return (
    <group position={[0, 0.96, -0.52]}>
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

function CroupierModel({ model, dealing = false, onReady }: { model: CroupierModelConfig; dealing?: boolean; onReady?: () => void }) {
  const breatheRoot = useRef<THREE.Group>(null);
  const lookRoot = useRef<THREE.Group>(null);
  const lookTargets = useRef<LookTarget[]>([]);
  const { scene } = useGLTF(model.path);
  const normalizedScene = useMemo(() => {
    const source = cloneSkeleton(scene) as THREE.Group;
    prepareCroupierAsset(source);
    lookTargets.current = collectLookTargets(source);

    const box = new THREE.Box3().setFromObject(source);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    source.position.set(-center.x, -box.min.y, -center.z);

    const normalized = new THREE.Group();
    normalized.name = `${model.id}-normalized`;
    normalized.scale.setScalar(model.height / Math.max(size.y, 0.001));
    normalized.add(source);
    return normalized;
  }, [model.height, model.id, scene]);

  useEffect(() => {
    onReady?.();
  }, [normalizedScene, onReady]);

  useFrame(({ pointer, clock }) => {
    const isCursorInFront = pointer.y > -0.68;
    const targetYaw = isCursorInFront ? THREE.MathUtils.clamp(pointer.x * 0.18, -0.16, 0.16) : 0;
    const targetPitch = isCursorInFront ? THREE.MathUtils.clamp(pointer.y * 0.055, -0.035, 0.05) : 0;
    const dealPulse = dealing ? Math.sin(clock.elapsedTime * 3.15) * 0.5 + 0.5 : 0;
    const idleFloat = Math.sin(clock.elapsedTime * 1.15) * 0.018 + dealPulse * 0.012;

    if (breatheRoot.current) {
      breatheRoot.current.position.y = THREE.MathUtils.lerp(breatheRoot.current.position.y, model.y + idleFloat, 0.05);
    }

    if (lookTargets.current.length > 0) {
      for (const target of lookTargets.current) {
        target.node.rotation.y = THREE.MathUtils.lerp(target.node.rotation.y, target.baseY + targetYaw * target.yawScale, 0.08);
        target.node.rotation.x = THREE.MathUtils.lerp(target.node.rotation.x, target.baseX - targetPitch * target.pitchScale, 0.08);
      }

      if (lookRoot.current) {
        lookRoot.current.rotation.y = THREE.MathUtils.lerp(lookRoot.current.rotation.y, model.rotationY + targetYaw * 0.22, 0.05);
        lookRoot.current.rotation.x = THREE.MathUtils.lerp(lookRoot.current.rotation.x, -targetPitch * 0.18, 0.05);
      }
      return;
    }

    if (lookRoot.current) {
      lookRoot.current.rotation.y = THREE.MathUtils.lerp(lookRoot.current.rotation.y, model.rotationY + targetYaw, 0.08);
      lookRoot.current.rotation.x = THREE.MathUtils.lerp(lookRoot.current.rotation.x, -targetPitch, 0.08);
    }
  });

  return (
    <group ref={breatheRoot} position={[0, model.y, model.z]}>
      <group ref={lookRoot} rotation={[0, model.rotationY, 0]}>
        <primitive object={normalizedScene} dispose={null} />
      </group>
    </group>
  );
}

function DealerCardFan({ dealing = false }: { dealing?: boolean }) {
  const dealCard = useRef<THREE.Group>(null);
  const cardFan = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const dealPulse = dealing ? Math.sin(clock.elapsedTime * 3.15) * 0.5 + 0.5 : 0;

    if (dealCard.current) {
      dealCard.current.position.x = THREE.MathUtils.lerp(dealCard.current.position.x, 0.78 + dealPulse * 0.38, 0.08);
      dealCard.current.position.z = THREE.MathUtils.lerp(dealCard.current.position.z, 0.62 + dealPulse * 0.16, 0.08);
      dealCard.current.rotation.z = THREE.MathUtils.lerp(dealCard.current.rotation.z, -0.25 - dealPulse * 0.16, 0.08);
    }

    if (cardFan.current) {
      cardFan.current.rotation.y = THREE.MathUtils.lerp(cardFan.current.rotation.y, -0.24 + dealPulse * 0.06, 0.06);
      cardFan.current.position.y = THREE.MathUtils.lerp(cardFan.current.position.y, 0.6 + dealPulse * 0.025, 0.08);
    }
  });

  return (
    <group>
      <group ref={cardFan} position={[-0.78, 0.6, 0.72]} rotation={[0.18, -0.24, 0.48]}>
        {[-2, -1, 0, 1, 2].map((offset) => (
          <MiniDealerCard key={offset} position={[offset * 0.06, 0, Math.abs(offset) * 0.012]} rotation={[0, 0, offset * -0.14]} red={offset % 2 === 0} />
        ))}
      </group>
      <group ref={dealCard} position={[0.78, 0.32, 0.62]} rotation={[0.12, 0.06, -0.25]}>
        <MiniDealerCard position={[0, 0, 0]} rotation={[0, 0, 0]} red />
      </group>
    </group>
  );
}

function MiniDealerCard({ position, rotation, red = false }: { position: Vec3; rotation: Vec3; red?: boolean }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[0.28, 0.016, 0.4]} />
        <meshStandardMaterial color="#fff6e7" roughness={0.42} />
      </mesh>
      <mesh position={[-0.08, 0.011, -0.12]}>
        <boxGeometry args={[0.05, 0.006, 0.05]} />
        <meshStandardMaterial color={red ? "#ba2732" : "#111816"} roughness={0.42} />
      </mesh>
    </group>
  );
}

function CroupierLoadingSilhouette() {
  return (
    <group position={[0, -0.5, 0.08]}>
      <mesh castShadow position={[0, 0.74, 0.05]} scale={[0.52, 0.84, 0.34]}>
        <capsuleGeometry args={[0.42, 0.68, 12, 24]} />
        <meshStandardMaterial color="#0b1413" emissive="#12382f" emissiveIntensity={0.18} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 1.44, 0.08]}>
        <sphereGeometry args={[0.34, 32, 24]} />
        <meshStandardMaterial color="#14211e" emissive="#2b7d69" emissiveIntensity={0.12} roughness={0.64} />
      </mesh>
    </group>
  );
}

function selectCroupierModel(roomCode?: string) {
  if (!roomCode) return CROUPIER_MODELS[0];
  return CROUPIER_MODELS[hashRoomCode(roomCode) % CROUPIER_MODELS.length];
}

function hashRoomCode(roomCode: string) {
  let hash = 2166136261;
  for (let index = 0; index < roomCode.length; index += 1) {
    hash ^= roomCode.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function prepareCroupierAsset(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    child.castShadow = true;
    child.receiveShadow = true;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
    }
  });
}

function collectLookTargets(root: THREE.Object3D): LookTarget[] {
  const targets: LookTarget[] = [];

  root.traverse((node) => {
    const name = node.name.toLowerCase();
    if (!name) return;
    if (!/(head|neck|face|eye|gaze|look)/.test(name)) return;

    const isEye = /eye|gaze|look/.test(name);
    const isHead = /head|face/.test(name);
    targets.push({
      node,
      baseX: node.rotation.x,
      baseY: node.rotation.y,
      pitchScale: isEye ? 0.65 : isHead ? 1 : 0.35,
      yawScale: isEye ? 0.55 : isHead ? 1 : 0.35
    });
  });

  return targets.slice(0, 6);
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
