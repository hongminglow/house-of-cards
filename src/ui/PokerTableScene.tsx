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

type CroupierModelConfig = {
  id: string;
  path: string;
  height: number;
  rotationY: number;
  y: number;
  z: number;
  look?: Partial<LookProfile>;
};

type LookProfile = {
  yawPower: number;
  yawLimit: number;
  pitchPower: number;
  pitchDownLimit: number;
  pitchUpLimit: number;
  targetLerp: number;
  rootLerp: number;
  rootYawWithTargets: number;
  rootPitchWithTargets: number;
};

type LookTarget = {
  node: THREE.Object3D;
  baseX: number;
  baseY: number;
  pitchScale: number;
  yawScale: number;
};

const CROUPIER_MODELS: CroupierModelConfig[] = [
  { id: "croupier-aurora", path: "/assets/croupiers/croupier-aurora.glb", height: 2.92, rotationY: 0, y: -1.98, z: -0.18 },
  { id: "croupier-mika", path: "/assets/croupiers/croupier-mika.glb", height: 2.82, rotationY: 0, y: -1.9, z: -0.2 },
  { id: "croupier-stella", path: "/assets/croupiers/croupier-stella.glb", height: 2.92, rotationY: 0, y: -1.98, z: -0.18 },
  { id: "croupier-yuna", path: "/assets/croupiers/croupier-yuna.glb", height: 2.92, rotationY: 0, y: -1.98, z: -0.18 },
  {
    id: "croupier-serena",
    path: "/assets/croupiers/croupier-serena.glb",
    height: 2.86,
    rotationY: 0,
    y: -1.94,
    z: -0.18,
    look: {
      yawPower: 0.68,
      yawLimit: 0.48,
      pitchPower: 0.2,
      pitchDownLimit: -0.15,
      pitchUpLimit: 0.18,
      targetLerp: 0.22,
      rootLerp: 0.18,
      rootYawWithTargets: 0.82,
      rootPitchWithTargets: 0.62
    }
  },
  { id: "croupier-celeste", path: "/assets/croupiers/croupier-celeste.glb", height: 2.92, rotationY: 0, y: -1.98, z: -0.18 }
];

const DEFAULT_LOOK_PROFILE: LookProfile = {
  yawPower: 0.18,
  yawLimit: 0.16,
  pitchPower: 0.055,
  pitchDownLimit: -0.035,
  pitchUpLimit: 0.05,
  targetLerp: 0.08,
  rootLerp: 0.08,
  rootYawWithTargets: 0.22,
  rootPitchWithTargets: 0.18
};

const DEALER_CUTOUT_CENTER = 2.28;
const DEALER_CUTOUT_RADIUS_X = 1.34;
const DEALER_CUTOUT_RADIUS_Z = 1.02;
const DEALER_RIM_RADIUS_X = 1.54;
const DEALER_RIM_RADIUS_Z = 1.18;

export function PokerTableScene({ room, playerSeat, onCroupierReady }: Props) {
  return (
    <Canvas camera={{ position: [0, 4.85, 6.35], fov: 38 }} shadows dpr={[1, 2]}>
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
      const targetFov = narrow ? 66 : 38;
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.12);
        camera.updateProjectionMatrix();
      }
    }
    const targetPosition = narrow ? new THREE.Vector3(0, 8.2, 12.6) : new THREE.Vector3(0, 4.85, 6.35);
    camera.position.lerp(targetPosition, 0.08);
    camera.lookAt(0, narrow ? 0.6 : 1.04, narrow ? -0.18 : -0.58);
  });
  return null;
}

function TableSurface() {
  const feltGeometry = useMemo(() => createDealerCutoutTableGeometry(5.8, 0.16), []);
  const dealerCutoutRim = useMemo(() => createDealerCutoutRimGeometry(), []);

  return (
    <group>
      <mesh receiveShadow position={[0, -0.12, 0]} rotation-x={-Math.PI / 2}>
        <primitive object={feltGeometry} attach="geometry" />
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
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, 0]}>
        <primitive object={dealerCutoutRim} attach="geometry" />
        <meshStandardMaterial color="#d6aa54" roughness={0.46} metalness={0.34} />
      </mesh>
    </group>
  );
}

function createDealerCutoutTableGeometry(radius: number, depth: number) {
  const tableShape = new THREE.Shape();
  tableShape.absellipse(0, 0, radius, radius, 0, Math.PI * 2, false, 0);

  const dealerCutout = new THREE.Path();
  dealerCutout.absellipse(0, DEALER_CUTOUT_CENTER, DEALER_CUTOUT_RADIUS_X, DEALER_CUTOUT_RADIUS_Z, 0, Math.PI * 2, true, 0);
  tableShape.holes.push(dealerCutout);

  return new THREE.ExtrudeGeometry(tableShape, {
    bevelEnabled: false,
    curveSegments: 96,
    depth
  });
}

function createDealerCutoutRimGeometry() {
  const rimShape = new THREE.Shape();
  rimShape.absellipse(0, DEALER_CUTOUT_CENTER, DEALER_RIM_RADIUS_X, DEALER_RIM_RADIUS_Z, 0, Math.PI * 2, false, 0);

  const rimHole = new THREE.Path();
  rimHole.absellipse(0, DEALER_CUTOUT_CENTER, DEALER_CUTOUT_RADIUS_X, DEALER_CUTOUT_RADIUS_Z, 0, Math.PI * 2, true, 0);
  rimShape.holes.push(rimHole);

  return new THREE.ShapeGeometry(rimShape, 72);
}

function DealerPortrait({ room, onCroupierReady }: { room: RoomPublicState | null; onCroupierReady?: () => void }) {
  const dealing = room ? room.street !== "waiting" && room.street !== "settled" : false;
  const model = useMemo(() => selectCroupierModel(room?.roomCode), [room?.roomCode]);

  return (
    <Float speed={1.05} rotationIntensity={0.025} floatIntensity={0.05}>
      <group position={[0, 0.24, -2.66]} scale={1.86}>
        <Suspense fallback={<CroupierLoadingSilhouette />}>
          <CroupierModel model={model} dealing={dealing} onReady={onCroupierReady} />
        </Suspense>
      </group>
    </Float>
  );
}

function CroupierModel({ model, dealing = false, onReady }: { model: CroupierModelConfig; dealing?: boolean; onReady?: () => void }) {
  const breatheRoot = useRef<THREE.Group>(null);
  const lookRoot = useRef<THREE.Group>(null);
  const lookTargets = useRef<LookTarget[]>([]);
  const { scene } = useGLTF(model.path);
  const look = useMemo(() => ({ ...DEFAULT_LOOK_PROFILE, ...model.look }), [model.look]);
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
    const targetYaw = isCursorInFront ? THREE.MathUtils.clamp(pointer.x * look.yawPower, -look.yawLimit, look.yawLimit) : 0;
    const targetPitch = isCursorInFront
      ? THREE.MathUtils.clamp(pointer.y * look.pitchPower, look.pitchDownLimit, look.pitchUpLimit)
      : 0;
    const dealPulse = dealing ? Math.sin(clock.elapsedTime * 3.15) * 0.5 + 0.5 : 0;
    const idleFloat = Math.sin(clock.elapsedTime * 1.15) * 0.018 + dealPulse * 0.012;

    if (breatheRoot.current) {
      breatheRoot.current.position.y = THREE.MathUtils.lerp(breatheRoot.current.position.y, model.y + idleFloat, 0.05);
    }

    if (lookTargets.current.length > 0) {
      for (const target of lookTargets.current) {
        target.node.rotation.y = THREE.MathUtils.lerp(target.node.rotation.y, target.baseY + targetYaw * target.yawScale, look.targetLerp);
        target.node.rotation.x = THREE.MathUtils.lerp(target.node.rotation.x, target.baseX - targetPitch * target.pitchScale, look.targetLerp);
      }

      if (lookRoot.current) {
        lookRoot.current.rotation.y = THREE.MathUtils.lerp(
          lookRoot.current.rotation.y,
          model.rotationY + targetYaw * look.rootYawWithTargets,
          look.rootLerp
        );
        lookRoot.current.rotation.x = THREE.MathUtils.lerp(lookRoot.current.rotation.x, -targetPitch * look.rootPitchWithTargets, look.rootLerp);
      }
      return;
    }

    if (lookRoot.current) {
      lookRoot.current.rotation.y = THREE.MathUtils.lerp(lookRoot.current.rotation.y, model.rotationY + targetYaw, look.rootLerp);
      lookRoot.current.rotation.x = THREE.MathUtils.lerp(lookRoot.current.rotation.x, -targetPitch, look.rootLerp);
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
