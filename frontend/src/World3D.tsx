import { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  Html,
  Environment,
  ContactShadows,
  MeshReflectorMaterial,
  RoundedBox,
  Sky,
  Stars,
  useGLTF,
  useAnimations,
  SoftShadows,
} from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const PET_MODEL_URL = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Fox/glTF-Binary/Fox.glb';
useGLTF.preload(PET_MODEL_URL);

export type OutfitStyleType =
  | 'casual'
  | 'formal'
  | 'sport'
  | 'pajamas'
  | 'underwear'
  | 'towel'
  | 'naked';

export interface DishInfo {
  name: string;
  color: string;
  accent: string;
}

export interface ThoughtRecord {
  id: number;
  day: number;
  time: string;
  action: string;
  thought: string;
  speech: string;
  is_implanted: boolean;
}

export interface Agent3D {
  id: string;
  name: string;
  gender: string;
  role: 'full_bot' | 'guest' | 'child' | 'pet';
  age_days: number;
  location: string;
  current_action: string;
  current_thought: string;
  x: number;
  y: number;
  z: number;
  hunger: number;
  mood: string;
  outfit_style: OutfitStyleType;
  outfit_color: string;
  is_at_work: boolean;
  worked_today?: boolean;
  phone_caller?: string | null;
  in_dialogue_with?: string | null;
  dialogue_turns_left?: number;
  dialogue_topic?: string | null;
}

function useArchitecturalTextures() {
  return useMemo(() => {
    const woodCanvas = document.createElement('canvas');
    woodCanvas.width = 512;
    woodCanvas.height = 512;
    const wCtx = woodCanvas.getContext('2d')!;
    wCtx.fillStyle = '#5c3a21';
    wCtx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 32) {
      for (let x = 0; x < 512; x += 128) {
        const offset = (y / 32) % 2 === 0 ? 0 : 64;
        wCtx.fillStyle = (x + y) % 64 === 0 ? '#4a2e19' : '#6e472b';
        wCtx.fillRect((x + offset) % 512, y, 126, 30);
        wCtx.strokeStyle = '#2b180a';
        wCtx.lineWidth = 1.5;
        wCtx.strokeRect((x + offset) % 512, y, 126, 30);
      }
    }
    const woodTex = new THREE.CanvasTexture(woodCanvas);
    woodTex.wrapS = THREE.RepeatWrapping;
    woodTex.wrapT = THREE.RepeatWrapping;
    woodTex.repeat.set(5, 7);

    const marbleCanvas = document.createElement('canvas');
    marbleCanvas.width = 512;
    marbleCanvas.height = 512;
    const mCtx = marbleCanvas.getContext('2d')!;
    mCtx.fillStyle = '#f8fafc';
    mCtx.fillRect(0, 0, 512, 512);
    mCtx.strokeStyle = '#cbd5e1';
    mCtx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 128) {
      mCtx.beginPath();
      mCtx.moveTo(i, 0);
      mCtx.lineTo(i, 512);
      mCtx.stroke();
      mCtx.beginPath();
      mCtx.moveTo(0, i);
      mCtx.lineTo(512, i);
      mCtx.stroke();
    }
    const marbleTex = new THREE.CanvasTexture(marbleCanvas);
    marbleTex.wrapS = THREE.RepeatWrapping;
    marbleTex.wrapT = THREE.RepeatWrapping;
    marbleTex.repeat.set(3, 5);

    return { woodTex, marbleTex };
  }, []);
}

function LiveCinemaTVScreen({ isOn }: { isOn: boolean }) {
  const { canvas, texture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 180;
    const tex = new THREE.CanvasTexture(c);
    return { canvas: c, texture: tex };
  }, []);

  useFrame(({ clock }) => {
    if (!isOn) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const t = clock.getElapsedTime();

    const grad = ctx.createLinearGradient(0, 0, 320, 180);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e1b4b');
    grad.addColorStop(1, '#311042');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 320, 180);

    for (let i = 0; i < 16; i++) {
      const sx = (i * 23 + t * 40) % 320;
      const sy = (Math.sin(t * 2 + i) * 0.5 + 0.5) * 140;
      ctx.fillStyle = i % 2 === 0 ? '#38bdf8' : '#f472b6';
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const heroX = 100 + Math.sin(t * 2.5) * 50;
    const heroY = 100 + Math.cos(t * 5) * 10;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(heroX, heroY, 16, 0, Math.PI * 2);
    ctx.fill();

    const villainX = 220 + Math.cos(t * 2.2) * 40;
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.arc(villainX, 100, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(heroX + 14, heroY);
    ctx.lineTo(villainX - 14, 100 + Math.sin(t * 20) * 8);
    ctx.stroke();

    texture.needsUpdate = true;
  });

  if (!isOn) return null;

  return (
    <group position={[0, 1.05, -1.86]}>
      <mesh>
        <planeGeometry args={[2.1, 1.1]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      <pointLight position={[0, 0, 0.8]} intensity={1.4} distance={5} color="#38bdf8" />
    </group>
  );
}

function SteamParticles({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const cycle = (t * 0.8 + i * 0.35) % 1.4;
      mesh.position.y = cycle * 0.8;
      mesh.position.x = Math.sin(t * 2 + i) * 0.1;
      const s = 0.05 + cycle * 0.07;
      mesh.scale.set(s, s, s);
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function ShowerWaterParticles({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const fall = (t * 3.2 + i * 0.18) % 1.8;
      mesh.position.y = 1.95 - fall;
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <mesh key={i} position={[((i % 3) - 1) * 0.1, 1.5, ((Math.floor(i / 3) % 3) - 1) * 0.1]}>
          <cylinderGeometry args={[0.008, 0.008, 0.16]} />
          <meshBasicMaterial color="#7dd3fc" transparent opacity={0.75} />
        </mesh>
      ))}
    </group>
  );
}

function SoapFoamBubbles() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((c, idx) => {
      const s = 0.8 + Math.sin(t * 5 + idx) * 0.2;
      c.scale.set(s, s, s);
    });
  });

  const bubbleCoords: [number, number, number][] = [
    [0, 1.25, 0.14],
    [-0.12, 1.18, 0.12],
    [0.12, 1.18, 0.12],
    [0, 1.62, 0.08],
    [-0.18, 1.05, 0],
    [0.18, 1.05, 0],
  ];

  return (
    <group ref={groupRef}>
      {bubbleCoords.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshPhysicalMaterial color="#ffffff" roughness={0.1} transmission={0.3} clearcoat={1} />
        </mesh>
      ))}
    </group>
  );
}

function FloatingHearts({ position, color = '#f43f5e' }: { position: [number, number, number]; color?: string }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const rise = (t * 0.7 + i * 0.4) % 1.3;
      mesh.position.y = rise * 0.7;
      mesh.position.x = Math.sin(t * 3 + i * 2) * 0.18;
      const sc = 0.06 + Math.sin(rise * Math.PI) * 0.05;
      mesh.scale.set(sc, sc, sc);
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {[0, 1, 2].map((i) => (
        <mesh key={i}>
          <octahedronGeometry args={[1, 2]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} />
        </mesh>
      ))}
    </group>
  );
}

interface CharacterProps {
  agent: Agent3D;
  partner?: Agent3D;
  isSelected: boolean;
  isSpeakingAudio: boolean;
  onSelect: (id: string) => void;
}

function RiggedPetGLB({ agent, isSelected, onSelect }: CharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(PET_MODEL_URL);
  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    clone.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  const { actions } = useAnimations(animations, groupRef);
  const [hovered, setHovered] = useState(false);
  const currentAnimRef = useRef<string>('');

  const playAnim = (name: string) => {
    if (currentAnimRef.current === name || !actions[name]) return;
    const prev = actions[currentAnimRef.current];
    const next = actions[name];
    if (prev) prev.fadeOut(0.25);
    next.reset().fadeIn(0.25).play();
    currentAnimRef.current = name;
  };

  useFrame(() => {
    if (!groupRef.current) return;
    const currentPos = groupRef.current.position;
    const target = new THREE.Vector3(agent.x, agent.y, agent.z);
    const dist = currentPos.distanceTo(target);

    if (dist > 0.08) {
      currentPos.lerp(target, 0.045);
      const targetAngle = Math.atan2(target.x - currentPos.x, target.z - currentPos.z);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetAngle, 0.15);
      playAnim('Walk');
    } else {
      playAnim('Survey');
    }
  });

  return (
    <group
      ref={groupRef}
      position={[agent.x, agent.y, agent.z]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(agent.id);
      }}
    >
      {isSelected && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.46, 32]} />
          <meshBasicMaterial color="#10b981" />
        </mesh>
      )}
      <primitive object={clonedScene} scale={0.0085} />
      {hovered && (
        <Html position={[0, 0.9, 0]} center distanceFactor={14}>
          <div dir="rtl" className="bg-slate-950/95 border border-amber-500/60 text-white px-3 py-2 rounded-2xl shadow-2xl w-48 pointer-events-none select-none">
            <div className="font-bold text-amber-400 text-xs mb-0.5">🐾 {agent.name} ({agent.mood})</div>
            <div className="text-[10px] text-amber-100 italic">💭 {agent.current_thought}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function ProportionalHuman({ agent, partner, isSelected, isSpeakingAudio, onSelect }: CharacterProps) {
  const rootRef = useRef<THREE.Group>(null);
  const bodyPivotRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Group>(null);
  const rightEyeRef = useRef<THREE.Group>(null);
  const leftThighRef = useRef<THREE.Group>(null);
  const rightThighRef = useRef<THREE.Group>(null);
  const leftShinRef = useRef<THREE.Group>(null);
  const rightShinRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftForearmRef = useRef<THREE.Group>(null);
  const rightForearmRef = useRef<THREE.Group>(null);

  const [hovered, setHovered] = useState(false);
  const [hiddenAtWork, setHiddenAtWork] = useState(false);

  const isNewborn = agent.role === 'child' && agent.age_days < 90;
  const isCrawling = agent.role === 'child' && agent.age_days >= 90 && agent.age_days < 365;
  const scale =
    agent.role === 'child'
      ? isNewborn
        ? 0.34
        : isCrawling
        ? 0.46
        : Math.min(0.85, 0.56 + (agent.age_days / 4500) * 0.3)
      : agent.gender === 'female'
      ? 0.93
      : 1.0;

  const skinColor = '#f1c29b';
  const style: OutfitStyleType = agent.outfit_style || 'casual';
  const primaryColor = agent.outfit_color || '#2563eb';
  const pantsColor =
    style === 'formal'
      ? '#0f172a'
      : style === 'pajamas'
      ? primaryColor
      : style === 'sport'
      ? '#1e293b'
      : '#1e3a8a';

  useFrame(({ clock }) => {
    if (!rootRef.current || !bodyPivotRef.current) return;
    const t = clock.getElapsedTime();
    const pos = rootRef.current.position;

    if (!agent.is_at_work && hiddenAtWork) {
      pos.set(0, 0, 4.2);
      setHiddenAtWork(false);
    }

    const finalTarget = new THREE.Vector3(agent.x, agent.y, agent.z);
    let stepTarget = finalTarget.clone();

    if (Math.abs(pos.y - agent.y) > 0.5) {
      const stairEntry = new THREE.Vector3(0, pos.y, -2.5);
      const stairTop = new THREE.Vector3(0, agent.y, 1.5);
      if (pos.distanceTo(stairEntry) > 0.65 && Math.abs(pos.x) > 0.8) {
        stepTarget = stairEntry;
      } else {
        stepTarget = stairTop;
      }
    }

    const dist = pos.distanceTo(stepTarget);
    const isMoving = dist > 0.07;
    const isSitting =
      !isMoving &&
      ['WATCH_TV', 'EAT', 'USE_COMPUTER', 'TALK', 'ARGUE'].includes(agent.current_action);
    const isInBed = !isMoving && ['SLEEP', 'HAVE_BABY', 'SUNBATHE'].includes(agent.current_action);
    const isSwimming = !isMoving && agent.current_action === 'SWIM';
    const isHugging = !isMoving && agent.current_action === 'ROMANCE';
    const isShowering = !isMoving && agent.current_action === 'SHOWER';
    const isWorkingOut = !isMoving && agent.current_action === 'WORKOUT';
    const isPhoneCall = !isMoving && agent.current_action === 'PHONE_CALL';
    const isPlayingMusic = !isMoving && agent.current_action === 'PLAY_MUSIC';
    const isReading = !isMoving && agent.current_action === 'READ_BOOK';

    const blink = Math.sin(t * 2.1 + (agent.id === 'adam' ? 0 : 1.5)) > 0.985 ? 0.08 : 1;
    if (leftEyeRef.current && rightEyeRef.current) {
      leftEyeRef.current.scale.y = isInBed && agent.current_action === 'SLEEP' ? 0.05 : blink;
      rightEyeRef.current.scale.y = isInBed && agent.current_action === 'SLEEP' ? 0.05 : blink;
    }

    if (mouthRef.current) {
      if (isSpeakingAudio || isPhoneCall || ['TALK', 'ARGUE'].includes(agent.current_action)) {
        mouthRef.current.scale.y = 0.5 + Math.abs(Math.sin(t * 18)) * 1.6;
      } else {
        mouthRef.current.scale.y = 0.35;
      }
    }

    if (isMoving) {
      pos.lerp(stepTarget, 0.055);
      const moveAngle = Math.atan2(stepTarget.x - pos.x, stepTarget.z - pos.z);
      rootRef.current.rotation.y = THREE.MathUtils.lerp(rootRef.current.rotation.y, moveAngle, 0.18);

      const walkPhase = t * 9.5;
      if (headRef.current) headRef.current.rotation.set(0, 0, 0);

      if (isCrawling) {
        bodyPivotRef.current.position.set(0, 0.26, 0);
        bodyPivotRef.current.rotation.set(Math.PI / 2.15, 0, 0);
        if (leftThighRef.current && rightThighRef.current && leftArmRef.current && rightArmRef.current) {
          leftThighRef.current.rotation.x = -0.6 + Math.sin(walkPhase) * 0.45;
          rightThighRef.current.rotation.x = -0.6 - Math.sin(walkPhase) * 0.45;
          leftArmRef.current.rotation.x = -1.2 - Math.sin(walkPhase) * 0.45;
          rightArmRef.current.rotation.x = -1.2 + Math.sin(walkPhase) * 0.45;
        }
      } else {
        bodyPivotRef.current.position.set(0, Math.abs(Math.sin(walkPhase)) * 0.035, 0);
        bodyPivotRef.current.rotation.set(0, 0, 0);

        if (leftThighRef.current && rightThighRef.current && leftShinRef.current && rightShinRef.current) {
          leftThighRef.current.rotation.x = Math.sin(walkPhase) * 0.55;
          rightThighRef.current.rotation.x = -Math.sin(walkPhase) * 0.55;
          leftShinRef.current.rotation.x = Math.max(0, -Math.cos(walkPhase) * 0.6);
          rightShinRef.current.rotation.x = Math.max(0, Math.cos(walkPhase) * 0.6);
        }
        if (leftArmRef.current && rightArmRef.current && leftForearmRef.current && rightForearmRef.current) {
          leftArmRef.current.rotation.set(-Math.sin(walkPhase) * 0.4, 0, 0.05);
          rightArmRef.current.rotation.set(Math.sin(walkPhase) * 0.4, 0, -0.05);
          leftForearmRef.current.rotation.x = -0.22;
          rightForearmRef.current.rotation.x = -0.22;
        }
      }
    } else {
      if (agent.is_at_work && !hiddenAtWork) {
        setHiddenAtWork(true);
      }

      if (isSwimming) {
        rootRef.current.rotation.y = Math.sin(t * 0.6) * 0.6;
        bodyPivotRef.current.position.set(0, -0.52 + Math.sin(t * 3) * 0.04, 0);
        bodyPivotRef.current.rotation.set(Math.PI / 2.3, 0, 0);
        if (leftArmRef.current && rightArmRef.current && leftThighRef.current && rightThighRef.current) {
          leftArmRef.current.rotation.set(Math.sin(t * 6) * 1.1, 0, 0.22);
          rightArmRef.current.rotation.set(-Math.sin(t * 6) * 1.1, 0, -0.22);
          leftThighRef.current.rotation.x = Math.sin(t * 8) * 0.35;
          rightThighRef.current.rotation.x = -Math.sin(t * 8) * 0.35;
        }
      } else if (isInBed) {
        rootRef.current.rotation.y = 0;
        const bedY = agent.current_action === 'SUNBATHE' ? 0.36 : 0.54;
        bodyPivotRef.current.position.set(0, bedY, -0.55);
        const rollZ =
          agent.current_action === 'HAVE_BABY'
            ? agent.id === 'adam'
              ? -0.28
              : 0.28
            : 0;
        bodyPivotRef.current.rotation.set(-Math.PI / 2, 0, rollZ);

        if (leftThighRef.current && rightThighRef.current && leftShinRef.current && rightShinRef.current) {
          leftThighRef.current.rotation.x = 0;
          rightThighRef.current.rotation.x = 0;
          leftShinRef.current.rotation.x = 0;
          rightShinRef.current.rotation.x = 0;
        }
        if (leftArmRef.current && rightArmRef.current && leftForearmRef.current && rightForearmRef.current) {
          if (agent.current_action === 'HAVE_BABY') {
            leftArmRef.current.rotation.set(-1.0, 0, 0.3);
            rightArmRef.current.rotation.set(-1.0, 0, -0.3);
            leftForearmRef.current.rotation.x = -0.45;
            rightForearmRef.current.rotation.x = -0.45;
          } else {
            leftArmRef.current.rotation.set(0, 0, 0.1);
            rightArmRef.current.rotation.set(0, 0, -0.1);
            leftForearmRef.current.rotation.x = -0.15;
            rightForearmRef.current.rotation.x = -0.15;
          }
        }
      } else if (isNewborn) {
        rootRef.current.rotation.y = 0;
        bodyPivotRef.current.position.set(0, 0.52, -0.2);
        bodyPivotRef.current.rotation.set(-Math.PI / 2, 0, 0);
      } else if (isCrawling) {
        bodyPivotRef.current.position.set(0, 0.26, 0);
        bodyPivotRef.current.rotation.set(Math.PI / 2.2, 0, 0);
      } else if (isSitting) {
        const isSofaDialogue = ['TALK', 'ARGUE'].includes(agent.current_action);
        if (isSofaDialogue) {
          rootRef.current.rotation.y = Math.PI + (agent.id === 'adam' ? -0.52 : 0.52);
          if (headRef.current) {
            headRef.current.rotation.y =
              (agent.id === 'adam' ? -0.38 : 0.38) +
              (agent.current_action === 'ARGUE' ? Math.sin(t * 8) * 0.12 : Math.sin(t * 2) * 0.05);
          }
        } else {
          if (headRef.current) headRef.current.rotation.set(0, 0, 0);
          rootRef.current.rotation.y =
            agent.current_action === 'WATCH_TV' || agent.current_action === 'USE_COMPUTER'
              ? Math.PI
              : agent.id === 'adam'
              ? Math.PI / 2
              : -Math.PI / 2;
        }

        bodyPivotRef.current.position.set(0, -0.32, 0);
        bodyPivotRef.current.rotation.set(0, 0, 0);

        if (leftThighRef.current && rightThighRef.current && leftShinRef.current && rightShinRef.current) {
          leftThighRef.current.rotation.x = -Math.PI / 2.05;
          rightThighRef.current.rotation.x = -Math.PI / 2.05;
          leftShinRef.current.rotation.x = Math.PI / 2.05;
          rightShinRef.current.rotation.x = Math.PI / 2.05;
        }
        if (leftArmRef.current && rightArmRef.current && leftForearmRef.current && rightForearmRef.current) {
          if (agent.current_action === 'ARGUE') {
            rightArmRef.current.rotation.set(-0.75 + Math.sin(t * 8) * 0.35, 0, -0.15);
            rightForearmRef.current.rotation.x = -0.65 + Math.cos(t * 8) * 0.3;
            leftArmRef.current.rotation.set(-0.6 + Math.cos(t * 7) * 0.3, 0, 0.15);
            leftForearmRef.current.rotation.x = -0.55;
          } else if (agent.current_action === 'TALK') {
            rightArmRef.current.rotation.set(-0.5 + Math.sin(t * 4) * 0.2, 0, -0.1);
            rightForearmRef.current.rotation.x = -0.5 + Math.cos(t * 4) * 0.15;
            leftArmRef.current.rotation.set(-0.35 + Math.cos(t * 3.5) * 0.15, 0, 0.1);
            leftForearmRef.current.rotation.x = -0.4;
          } else if (agent.current_action === 'EAT') {
            rightArmRef.current.rotation.set(-0.9 + Math.sin(t * 5) * 0.25, 0, 0);
            rightForearmRef.current.rotation.x = -0.7 + Math.cos(t * 5) * 0.2;
            leftArmRef.current.rotation.set(-0.55, 0, 0);
            leftForearmRef.current.rotation.x = -0.45;
          } else if (agent.current_action === 'USE_COMPUTER') {
            leftArmRef.current.rotation.set(-0.7, 0.12, 0);
            rightArmRef.current.rotation.set(-0.7, -0.12, 0);
            leftForearmRef.current.rotation.x = -0.6 + Math.sin(t * 14) * 0.1;
            rightForearmRef.current.rotation.x = -0.6 + Math.cos(t * 14) * 0.1;
          } else {
            leftArmRef.current.rotation.set(-0.18, 0, 0.08);
            rightArmRef.current.rotation.set(-0.18, 0, -0.08);
            leftForearmRef.current.rotation.x = -0.35;
            rightForearmRef.current.rotation.x = -0.35;
          }
        }
      } else {
        if (headRef.current) headRef.current.rotation.set(0, 0, 0);
        bodyPivotRef.current.position.set(0, Math.sin(t * 2.2) * 0.008, 0);
        bodyPivotRef.current.rotation.set(0, 0, 0);

        if (partner && agent.current_action === 'ROMANCE') {
          rootRef.current.rotation.y = Math.atan2(partner.x - pos.x, partner.z - pos.z);
        } else if (['COOK', 'DRINK_COFFEE', 'DO_LAUNDRY', 'DRESS_UP'].includes(agent.current_action)) {
          rootRef.current.rotation.y = Math.PI;
        }

        if (leftThighRef.current && rightThighRef.current && leftShinRef.current && rightShinRef.current) {
          leftThighRef.current.rotation.x = 0;
          rightThighRef.current.rotation.x = 0;
          leftShinRef.current.rotation.x = 0;
          rightShinRef.current.rotation.x = 0;
        }

        if (leftArmRef.current && rightArmRef.current && leftForearmRef.current && rightForearmRef.current) {
          if (isHugging) {
            bodyPivotRef.current.rotation.x = 0.06;
            leftArmRef.current.rotation.set(-1.25, 0.22, 0.32);
            rightArmRef.current.rotation.set(-1.25, -0.22, -0.32);
            leftForearmRef.current.rotation.x = -0.6;
            rightForearmRef.current.rotation.x = -0.6;
          } else if (isPlayingMusic) {
            leftArmRef.current.rotation.set(-0.8, 0.3, 0.18);
            leftForearmRef.current.rotation.x = -0.85;
            rightArmRef.current.rotation.set(-0.6, -0.2, -0.1);
            rightForearmRef.current.rotation.x = -0.75 + Math.sin(t * 16) * 0.3;
          } else if (isReading) {
            leftArmRef.current.rotation.set(-0.8, 0.18, 0);
            rightArmRef.current.rotation.set(-0.8, -0.18, 0);
            leftForearmRef.current.rotation.x = -0.8;
            rightForearmRef.current.rotation.x = -0.8;
          } else if (isWorkingOut) {
            const lift = Math.sin(t * 6);
            leftArmRef.current.rotation.set(-0.55 - lift * 0.45, 0, 0.12);
            rightArmRef.current.rotation.set(-0.55 + lift * 0.45, 0, -0.12);
            leftForearmRef.current.rotation.x = -1.0 - Math.max(0, lift) * 0.7;
            rightForearmRef.current.rotation.x = -1.0 - Math.max(0, -lift) * 0.7;
          } else if (isPhoneCall) {
            rightArmRef.current.rotation.set(-1.2, -0.25, -0.18);
            rightForearmRef.current.rotation.x = -1.3;
            leftArmRef.current.rotation.set(-0.25 + Math.sin(t * 4) * 0.15, 0, 0.08);
            leftForearmRef.current.rotation.x = -0.35;
          } else if (agent.current_action === 'DRINK_COFFEE') {
            const sip = Math.max(0, Math.sin(t * 2.5));
            rightArmRef.current.rotation.set(-0.8 - sip * 0.4, 0, 0);
            rightForearmRef.current.rotation.x = -0.85 - sip * 0.35;
            leftArmRef.current.rotation.set(0, 0, 0.06);
            leftForearmRef.current.rotation.x = -0.18;
          } else if (isShowering) {
            leftArmRef.current.rotation.set(-1.0 + Math.sin(t * 7) * 0.3, 0.18, 0.18);
            rightArmRef.current.rotation.set(-1.1 + Math.cos(t * 7) * 0.3, -0.18, -0.18);
            leftForearmRef.current.rotation.x = -0.9 + Math.sin(t * 8) * 0.25;
            rightForearmRef.current.rotation.x = -0.9 + Math.cos(t * 8) * 0.25;
          } else if (['COOK', 'CLEAN', 'DO_LAUNDRY', 'DRESS_UP', 'CARE_FOR_BABY', 'FEED_PET'].includes(agent.current_action)) {
            rightArmRef.current.rotation.set(-1.0 + Math.sin(t * 7) * 0.3, 0, 0);
            rightForearmRef.current.rotation.x = -0.6 + Math.cos(t * 7) * 0.25;
            leftArmRef.current.rotation.set(-0.65 + Math.cos(t * 6) * 0.18, 0, 0);
            leftForearmRef.current.rotation.x = -0.45;
          } else if (isSpeakingAudio) {
            rightArmRef.current.rotation.set(-0.6 + Math.sin(t * 5) * 0.2, 0, -0.08);
            rightForearmRef.current.rotation.x = -0.55 + Math.cos(t * 5) * 0.18;
            leftArmRef.current.rotation.set(-0.35 + Math.cos(t * 4) * 0.15, 0, 0.08);
            leftForearmRef.current.rotation.x = -0.4;
          } else {
            leftArmRef.current.rotation.set(0, 0, 0.05);
            rightArmRef.current.rotation.set(0, 0, -0.05);
            leftForearmRef.current.rotation.x = -0.12;
            rightForearmRef.current.rotation.x = -0.12;
          }
        }
      }
    }
  });

  if (hiddenAtWork && agent.is_at_work) return null;

  const isShoweringNow = agent.current_action === 'SHOWER';
  const irisColor = agent.gender === 'female' ? '#10b981' : '#2563eb';
  const hairColor = agent.gender === 'female' ? '#4a2511' : '#1c1917';
  const isBarefoot =
    style === 'naked' ||
    style === 'underwear' ||
    style === 'towel' ||
    isInBedState(agent.current_action);

  const torsoWidthScale = agent.gender === 'female' ? 0.92 : 1.05;

  return (
    <group
      ref={rootRef}
      position={[agent.x, agent.y, agent.z]}
      scale={[scale, scale, scale]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(agent.id);
      }}
    >
      {isSelected && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.4, 0.52, 32]} />
          <meshBasicMaterial color="#10b981" />
        </mesh>
      )}

      {isSpeakingAudio && (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.54, 0.68, 32]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      )}

      {['ROMANCE', 'HAVE_BABY'].includes(agent.current_action) && (
        <FloatingHearts position={[0, 1.9, 0]} />
      )}

      {agent.current_action === 'ARGUE' && (
        <FloatingHearts position={[0, 1.9, 0]} color="#ef4444" />
      )}

      {agent.current_action === 'PLAY_MUSIC' && (
        <FloatingHearts position={[0, 1.9, 0]} color="#38bdf8" />
      )}

      <group ref={bodyPivotRef}>
        {isShoweringNow && <SoapFoamBubbles />}

        <group position={[0, 0.88, 0]}>
          <mesh castShadow scale={[1.05, 0.9, 0.88]}>
            <capsuleGeometry args={[0.145, 0.1, 16, 24]} />
            <meshPhysicalMaterial
              color={
                style === 'naked'
                  ? skinColor
                  : style === 'towel'
                  ? '#ffffff'
                  : style === 'underwear'
                  ? primaryColor
                  : pantsColor
              }
              roughness={0.35}
            />
          </mesh>

          {style === 'underwear' && (
            <group>
              <mesh position={[0, 0.07, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.05, 0.88, 1]}>
                <torusGeometry args={[0.148, 0.014, 12, 24]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.3} />
              </mesh>
              {agent.gender === 'male' && (
                <>
                  <mesh position={[-0.095, -0.08, 0]}>
                    <cylinderGeometry args={[0.072, 0.068, 0.14, 16]} />
                    <meshPhysicalMaterial color={primaryColor} roughness={0.4} />
                  </mesh>
                  <mesh position={[0.095, -0.08, 0]}>
                    <cylinderGeometry args={[0.072, 0.068, 0.14, 16]} />
                    <meshPhysicalMaterial color={primaryColor} roughness={0.4} />
                  </mesh>
                </>
              )}
            </group>
          )}

          <group ref={leftThighRef} position={[-0.095, -0.04, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <capsuleGeometry args={[0.068, 0.34, 16, 20]} />
              <meshPhysicalMaterial
                color={
                  style === 'naked' || style === 'underwear' || style === 'towel' || style === 'sport'
                    ? skinColor
                    : pantsColor
                }
                roughness={0.38}
              />
            </mesh>
            {style === 'sport' && (
              <mesh position={[0, -0.1, 0]} castShadow>
                <cylinderGeometry args={[0.076, 0.072, 0.2, 16]} />
                <meshStandardMaterial color={pantsColor} />
              </mesh>
            )}
            <group ref={leftShinRef} position={[0, -0.41, 0]}>
              <mesh position={[0, -0.19, 0]} castShadow>
                <capsuleGeometry args={[0.054, 0.34, 16, 20]} />
                <meshPhysicalMaterial
                  color={
                    style === 'naked' || style === 'underwear' || style === 'towel' || style === 'sport'
                      ? skinColor
                      : pantsColor
                  }
                  roughness={0.38}
                />
              </mesh>
              <RoundedBox args={[0.11, 0.07, 0.21]} radius={0.03} position={[0, -0.4, 0.035]} castShadow>
                <meshPhysicalMaterial
                  color={isBarefoot ? skinColor : style === 'formal' ? '#090d16' : '#f8fafc'}
                  roughness={0.3}
                />
              </RoundedBox>
            </group>
          </group>

          <group ref={rightThighRef} position={[0.095, -0.04, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <capsuleGeometry args={[0.068, 0.34, 16, 20]} />
              <meshPhysicalMaterial
                color={
                  style === 'naked' || style === 'underwear' || style === 'towel' || style === 'sport'
                    ? skinColor
                    : pantsColor
                }
                roughness={0.38}
              />
            </mesh>
            {style === 'sport' && (
              <mesh position={[0, -0.1, 0]} castShadow>
                <cylinderGeometry args={[0.076, 0.072, 0.2, 16]} />
                <meshStandardMaterial color={pantsColor} />
              </mesh>
            )}
            <group ref={rightShinRef} position={[0, -0.41, 0]}>
              <mesh position={[0, -0.19, 0]} castShadow>
                <capsuleGeometry args={[0.054, 0.34, 16, 20]} />
                <meshPhysicalMaterial
                  color={
                    style === 'naked' || style === 'underwear' || style === 'towel' || style === 'sport'
                      ? skinColor
                      : pantsColor
                  }
                  roughness={0.38}
                />
              </mesh>
              <RoundedBox args={[0.11, 0.07, 0.21]} radius={0.03} position={[0, -0.4, 0.035]} castShadow>
                <meshPhysicalMaterial
                  color={isBarefoot ? skinColor : style === 'formal' ? '#090d16' : '#f8fafc'}
                  roughness={0.3}
                />
              </RoundedBox>
            </group>
          </group>

          <mesh position={[0, 0.32, 0]} scale={[torsoWidthScale, 1, 0.78]} castShadow>
            <capsuleGeometry args={[0.16, 0.38, 20, 28]} />
            <meshPhysicalMaterial color={skinColor} roughness={0.32} clearcoat={0.1} />
          </mesh>

          {style === 'underwear' && agent.gender === 'female' && (
            <group position={[0, 0.36, 0]}>
              <mesh position={[-0.068, 0.02, 0.115]} castShadow>
                <sphereGeometry args={[0.068, 20, 20]} />
                <meshPhysicalMaterial color={primaryColor} roughness={0.3} sheen={0.6} />
              </mesh>
              <mesh position={[0.068, 0.02, 0.115]} castShadow>
                <sphereGeometry args={[0.068, 20, 20]} />
                <meshPhysicalMaterial color={primaryColor} roughness={0.3} sheen={0.6} />
              </mesh>
              <mesh position={[0, 0.0, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.95, 0.78, 1]}>
                <torusGeometry args={[0.158, 0.015, 12, 24]} />
                <meshPhysicalMaterial color={primaryColor} roughness={0.35} />
              </mesh>
              <mesh position={[-0.08, 0.12, 0.04]} rotation={[0.2, 0, 0]}>
                <boxGeometry args={[0.018, 0.2, 0.12]} />
                <meshStandardMaterial color={primaryColor} />
              </mesh>
              <mesh position={[0.08, 0.12, 0.04]} rotation={[0.2, 0, 0]}>
                <boxGeometry args={[0.018, 0.2, 0.12]} />
                <meshStandardMaterial color={primaryColor} />
              </mesh>
            </group>
          )}

          {style !== 'naked' && style !== 'underwear' && style !== 'towel' && (
            <group position={[0, 0.32, 0]}>
              <mesh scale={[torsoWidthScale, 1, 0.8]} castShadow>
                <capsuleGeometry args={[0.168, 0.39, 20, 28]} />
                <meshPhysicalMaterial color={primaryColor} roughness={0.45} sheen={0.3} />
              </mesh>
              {style === 'formal' && agent.gender === 'male' && (
                <mesh position={[0, 0.04, 0.145]}>
                  <boxGeometry args={[0.04, 0.32, 0.015]} />
                  <meshStandardMaterial color="#dc2626" />
                </mesh>
              )}
              {style === 'formal' && agent.gender === 'female' && (
                <mesh position={[0, -0.32, 0]} castShadow>
                  <coneGeometry args={[0.28, 0.58, 24]} />
                  <meshPhysicalMaterial color={primaryColor} roughness={0.35} clearcoat={0.2} />
                </mesh>
              )}
            </group>
          )}

          {style === 'towel' && (
            <group position={[0, agent.gender === 'female' ? 0.18 : 0.0, 0]}>
              <mesh castShadow>
                <cylinderGeometry
                  args={[0.175, 0.19, agent.gender === 'female' ? 0.58 : 0.4, 24]}
                />
                <meshStandardMaterial color="#f8fafc" roughness={0.85} />
              </mesh>
              <mesh position={[0, agent.gender === 'female' ? 0.26 : 0.18, 0]}>
                <torusGeometry args={[0.175, 0.016, 12, 24]} />
                <meshStandardMaterial color="#38bdf8" />
              </mesh>
            </group>
          )}

          {agent.current_action === 'PLAY_MUSIC' && (
            <group position={[0.04, 0.28, 0.19]} rotation={[0, 0, -0.45]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.14, 0.17, 0.07, 20]} rotation={[Math.PI / 2, 0, 0]} />
                <meshPhysicalMaterial color="#b45309" clearcoat={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[0, 0.28, 0]}>
                <boxGeometry args={[0.04, 0.4, 0.025]} />
                <meshStandardMaterial color="#451a03" />
              </mesh>
            </group>
          )}

          <mesh position={[0, 0.62, 0]} castShadow>
            <cylinderGeometry args={[0.052, 0.06, 0.14, 16]} />
            <meshPhysicalMaterial color={skinColor} roughness={0.32} />
          </mesh>

          <group ref={leftArmRef} position={[-0.22 * torsoWidthScale, 0.5, 0]}>
            <mesh position={[0, -0.13, 0]} castShadow>
              <capsuleGeometry args={[0.048, 0.22, 16, 20]} />
              <meshPhysicalMaterial
                color={
                  style === 'naked' || style === 'underwear' || style === 'towel' || style === 'sport'
                    ? skinColor
                    : primaryColor
                }
                roughness={0.38}
              />
            </mesh>
            <group ref={leftForearmRef} position={[0, -0.28, 0]}>
              <mesh position={[0, -0.12, 0]} castShadow>
                <capsuleGeometry args={[0.04, 0.2, 16, 20]} />
                <meshPhysicalMaterial
                  color={style === 'formal' || style === 'pajamas' ? primaryColor : skinColor}
                  roughness={0.35}
                />
              </mesh>
              <mesh position={[0, -0.25, 0]} castShadow>
                <sphereGeometry args={[0.045, 16, 16]} />
                <meshPhysicalMaterial color={skinColor} roughness={0.35} />
              </mesh>
              {agent.current_action === 'WORKOUT' && (
                <group position={[0, -0.27, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <mesh>
                    <cylinderGeometry args={[0.015, 0.015, 0.22]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.9} />
                  </mesh>
                  <mesh position={[0, 0.09, 0]}>
                    <cylinderGeometry args={[0.055, 0.055, 0.035, 16]} />
                    <meshStandardMaterial color="#0f172a" />
                  </mesh>
                  <mesh position={[0, -0.09, 0]}>
                    <cylinderGeometry args={[0.055, 0.055, 0.035, 16]} />
                    <meshStandardMaterial color="#0f172a" />
                  </mesh>
                </group>
              )}
            </group>
          </group>

          <group ref={rightArmRef} position={[0.22 * torsoWidthScale, 0.5, 0]}>
            <mesh position={[0, -0.13, 0]} castShadow>
              <capsuleGeometry args={[0.048, 0.22, 16, 20]} />
              <meshPhysicalMaterial
                color={
                  style === 'naked' || style === 'underwear' || style === 'towel' || style === 'sport'
                    ? skinColor
                    : primaryColor
                }
                roughness={0.38}
              />
            </mesh>
            <group ref={rightForearmRef} position={[0, -0.28, 0]}>
              <mesh position={[0, -0.12, 0]} castShadow>
                <capsuleGeometry args={[0.04, 0.2, 16, 20]} />
                <meshPhysicalMaterial
                  color={style === 'formal' || style === 'pajamas' ? primaryColor : skinColor}
                  roughness={0.35}
                />
              </mesh>
              <mesh position={[0, -0.25, 0]} castShadow>
                <sphereGeometry args={[0.045, 16, 16]} />
                <meshPhysicalMaterial color={skinColor} roughness={0.35} />
              </mesh>

              {agent.current_action === 'PHONE_CALL' && (
                <RoundedBox args={[0.06, 0.11, 0.012]} radius={0.01} position={[0, -0.27, 0.035]}>
                  <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={0.9} />
                </RoundedBox>
              )}

              {agent.current_action === 'READ_BOOK' && (
                <RoundedBox args={[0.18, 0.14, 0.03]} radius={0.01} position={[-0.1, -0.27, 0.1]}>
                  <meshStandardMaterial color="#fef3c7" />
                </RoundedBox>
              )}

              {agent.current_action === 'DRINK_COFFEE' && (
                <mesh position={[0, -0.27, 0.05]}>
                  <cylinderGeometry args={[0.038, 0.032, 0.085, 16]} />
                  <meshPhysicalMaterial color="#ffffff" clearcoat={0.9} />
                </mesh>
              )}

              {agent.current_action === 'WORKOUT' && (
                <group position={[0, -0.27, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <mesh>
                    <cylinderGeometry args={[0.015, 0.015, 0.22]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.9} />
                  </mesh>
                  <mesh position={[0, 0.09, 0]}>
                    <cylinderGeometry args={[0.055, 0.055, 0.035, 16]} />
                    <meshStandardMaterial color="#0f172a" />
                  </mesh>
                  <mesh position={[0, -0.09, 0]}>
                    <cylinderGeometry args={[0.055, 0.055, 0.035, 16]} />
                    <meshStandardMaterial color="#0f172a" />
                  </mesh>
                </group>
              )}

              {isShoweringNow && (
                <RoundedBox args={[0.075, 0.04, 0.1]} radius={0.02} position={[0, -0.28, 0.04]}>
                  <meshPhysicalMaterial color="#fbcfe8" clearcoat={0.8} />
                </RoundedBox>
              )}
              {agent.current_action === 'CARE_FOR_BABY' && (
                <mesh position={[0, -0.29, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.038, 0.038, 0.17, 16]} />
                  <meshPhysicalMaterial color="#ffffff" transmission={0.5} roughness={0.1} />
                </mesh>
              )}
              {agent.current_action === 'CLEAN' && (
                <group position={[0, -0.29, 0.08]} rotation={[Math.PI / 3, 0, 0]}>
                  <mesh>
                    <cylinderGeometry args={[0.015, 0.015, 1.1]} />
                    <meshStandardMaterial color="#b45309" />
                  </mesh>
                  <mesh position={[0, -0.55, 0]}>
                    <boxGeometry args={[0.28, 0.09, 0.09]} />
                    <meshStandardMaterial color="#eab308" />
                  </mesh>
                </group>
              )}
            </group>
          </group>

          <group ref={headRef} position={[0, 0.77, 0]}>
            <mesh scale={[0.92, 1.08, 0.96]} castShadow>
              <sphereGeometry args={[0.125, 32, 32]} />
              <meshPhysicalMaterial color={skinColor} roughness={0.28} clearcoat={0.12} />
            </mesh>

            <group ref={leftEyeRef} position={[-0.042, 0.02, 0.108]}>
              <mesh>
                <sphereGeometry args={[0.018, 16, 16]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh position={[0, 0, 0.012]}>
                <sphereGeometry args={[0.01, 12, 12]} />
                <meshBasicMaterial color={irisColor} />
              </mesh>
              <mesh position={[0, 0, 0.016]}>
                <sphereGeometry args={[0.005, 10, 10]} />
                <meshBasicMaterial color="#090d16" />
              </mesh>
            </group>

            <group ref={rightEyeRef} position={[0.042, 0.02, 0.108]}>
              <mesh>
                <sphereGeometry args={[0.018, 16, 16]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh position={[0, 0, 0.012]}>
                <sphereGeometry args={[0.01, 12, 12]} />
                <meshBasicMaterial color={irisColor} />
              </mesh>
              <mesh position={[0, 0, 0.016]}>
                <sphereGeometry args={[0.005, 10, 10]} />
                <meshBasicMaterial color="#090d16" />
              </mesh>
            </group>

            <mesh position={[0, -0.005, 0.122]}>
              <sphereGeometry args={[0.014, 16, 16]} />
              <meshPhysicalMaterial color={skinColor} roughness={0.3} />
            </mesh>

            <mesh ref={mouthRef} position={[0, -0.048, 0.112]}>
              <capsuleGeometry args={[0.011, 0.016, 8, 12]} />
              <meshBasicMaterial color="#be123c" />
            </mesh>

            <mesh position={[0, 0.035, -0.008]} scale={[0.94, 1.08, 0.98]} castShadow>
              <sphereGeometry args={[0.132, 32, 24, 0, Math.PI * 2, 0, Math.PI / 1.65]} />
              <meshPhysicalMaterial color={hairColor} roughness={0.55} />
            </mesh>
            {agent.gender === 'female' && (
              <mesh position={[0, -0.06, -0.095]} castShadow>
                <capsuleGeometry args={[0.075, 0.22, 12, 16]} />
                <meshPhysicalMaterial color={hairColor} roughness={0.55} />
              </mesh>
            )}
          </group>
        </group>
      </group>

      {hovered && (
        <Html position={[0, 1.95, 0]} center distanceFactor={13}>
          <div dir="rtl" className="bg-slate-950/95 border border-emerald-500/70 text-white px-3.5 py-2.5 rounded-2xl shadow-2xl w-56 pointer-events-none select-none backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1">
              <span className="font-bold text-emerald-400 text-xs">{agent.name}</span>
              <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                {agent.mood}
              </span>
            </div>
            <div className="text-[10px] text-amber-200 italic mb-1">💭 {agent.current_thought}</div>
            <div className="text-[10px] text-slate-400">פעולה: {agent.current_action}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function isInBedState(action: string) {
  return ['SLEEP', 'HAVE_BABY', 'SUNBATHE'].includes(action);
}

function InteractiveWardrobe({ isOpen }: { isOpen: boolean }) {
  const leftDoorRef = useRef<THREE.Group>(null);
  const rightDoorRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!leftDoorRef.current || !rightDoorRef.current) return;
    const targetLeft = isOpen ? -1.9 : 0;
    const targetRight = isOpen ? 1.9 : 0;
    leftDoorRef.current.rotation.y = THREE.MathUtils.lerp(leftDoorRef.current.rotation.y, targetLeft, 0.08);
    rightDoorRef.current.rotation.y = THREE.MathUtils.lerp(rightDoorRef.current.rotation.y, targetRight, 0.08);
  });

  return (
    <group position={[-0.8, 0, -3.5]}>
      <RoundedBox args={[1.5, 2.2, 0.65]} radius={0.04} position={[0, 1.1, 0]} castShadow>
        <meshPhysicalMaterial color="#3e2723" roughness={0.35} clearcoat={0.4} />
      </RoundedBox>
      <mesh position={[0, 1.8, 0.05]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 1.35]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
      </mesh>
      {[
        [-0.45, '#ef4444'],
        [-0.2, '#3b82f6'],
        [0.05, '#10b981'],
        [0.3, '#a855f7'],
        [0.5, '#f59e0b'],
      ].map(([xPos, col], idx) => (
        <mesh key={idx} position={[xPos as number, 1.35, 0.08]}>
          <boxGeometry args={[0.16, 0.7, 0.32]} />
          <meshStandardMaterial color={col as string} />
        </mesh>
      ))}
      <group ref={leftDoorRef} position={[-0.72, 1.1, 0.34]}>
        <mesh position={[0.35, 0, 0]} castShadow>
          <boxGeometry args={[0.7, 2.1, 0.05]} />
          <meshPhysicalMaterial color="#4e342e" roughness={0.3} clearcoat={0.5} />
        </mesh>
      </group>
      <group ref={rightDoorRef} position={[0.72, 1.1, 0.34]}>
        <mesh position={[-0.35, 0, 0]} castShadow>
          <boxGeometry args={[0.7, 2.1, 0.05]} />
          <meshPhysicalMaterial color="#4e342e" roughness={0.3} clearcoat={0.5} />
        </mesh>
      </group>
    </group>
  );
}

function AnimatedFrontDoor({ isOpen }: { isOpen: boolean }) {
  const doorPivotRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!doorPivotRef.current) return;
    const targetRot = isOpen ? -1.45 : 0;
    doorPivotRef.current.rotation.y = THREE.MathUtils.lerp(doorPivotRef.current.rotation.y, targetRot, 0.08);
  });

  return (
    <group position={[0, 0, 4.5]}>
      <mesh position={[-0.75, 1.1, 0]}>
        <boxGeometry args={[0.15, 2.2, 0.25]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0.75, 1.1, 0]}>
        <boxGeometry args={[0.15, 2.2, 0.25]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 2.25, 0]}>
        <boxGeometry args={[1.65, 0.15, 0.25]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
      </mesh>
      <group ref={doorPivotRef} position={[-0.68, 1.1, 0]}>
        <mesh position={[0.68, 0, 0]} castShadow>
          <boxGeometry args={[1.35, 2.15, 0.08]} />
          <meshPhysicalMaterial color="#78350f" roughness={0.3} clearcoat={0.6} />
        </mesh>
      </group>
    </group>
  );
}

function LuxuryVilla({
  houseLevel,
  cribsCount,
  currentDish,
  agents,
}: {
  houseLevel: number;
  cribsCount: number;
  currentDish: DishInfo;
  agents: Agent3D[];
}) {
  const { woodTex, marbleTex } = useArchitecturalTextures();
  const isTvOn = agents.some((a) => a.current_action === 'WATCH_TV');
  const isCooking = agents.some((a) => a.current_action === 'COOK');
  const isEating = agents.some((a) => a.current_action === 'EAT');
  const isShowering = agents.some((a) => a.current_action === 'SHOWER');
  const isDressing = agents.some((a) => a.current_action === 'DRESS_UP');
  const someoneInBed = agents.some((a) => ['SLEEP', 'HAVE_BABY'].includes(a.current_action));
  const isNearDoor = agents.some(
    (a) => a.current_action === 'GO_TO_WORK' || (Math.abs(a.x) < 1.5 && a.z > 3.0 && a.y < 1)
  );

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[46, 40]} />
        <meshStandardMaterial color="#0b1f17" roughness={0.95} />
      </mesh>

      <group position={[9.2, 0.01, 1.0]}>
        <RoundedBox args={[5.8, 0.14, 8.2]} radius={0.05} position={[0, 0, 0]} receiveShadow>
          <meshStandardMaterial map={woodTex} roughness={0.4} />
        </RoundedBox>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <planeGeometry args={[4.2, 6.4]} />
          <meshPhysicalMaterial
            color="#0284c7"
            emissive="#0369a1"
            emissiveIntensity={0.45}
            roughness={0.05}
            clearcoat={1}
            transmission={0.65}
          />
        </mesh>
        <pointLight position={[0, 0.8, 0]} intensity={1.8} distance={8} color="#38bdf8" />

        {[-1.2, 1.2].map((zOff, idx) => (
          <group key={idx} position={[-2.35, 0.18, zOff]}>
            <RoundedBox args={[0.8, 0.16, 1.8]} radius={0.05} castShadow>
              <meshPhysicalMaterial color="#f8fafc" roughness={0.4} />
            </RoundedBox>
            <RoundedBox args={[0.76, 0.22, 0.42]} radius={0.05} position={[0, 0.12, -0.65]} rotation={[0.4, 0, 0]}>
              <meshPhysicalMaterial color="#38bdf8" roughness={0.4} />
            </RoundedBox>
          </group>
        ))}

        <group position={[-2.35, 0, 0]}>
          <mesh position={[0, 1.05, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 2.1]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
          <mesh position={[0, 2.1, 0]} castShadow>
            <coneGeometry args={[1.55, 0.5, 16]} />
            <meshStandardMaterial color="#f43f5e" roughness={0.6} />
          </mesh>
        </group>
      </group>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-3.0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[6.0, 9.0]} />
        <MeshReflectorMaterial
          map={woodTex}
          blur={[300, 100]}
          resolution={512}
          mixBlur={0.8}
          mixStrength={0.35}
          roughness={0.35}
          depthScale={1}
          metalness={0.1}
          mirror={0.25}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[6.0, 9.0]} />
        <MeshReflectorMaterial
          map={marbleTex}
          blur={[300, 100]}
          resolution={512}
          mixBlur={0.6}
          mixStrength={0.45}
          roughness={0.18}
          depthScale={1}
          metalness={0.15}
          mirror={0.35}
        />
      </mesh>

      <mesh position={[0, 1.6, -4.5]} castShadow receiveShadow>
        <boxGeometry args={[12, 3.2, 0.24]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.5} />
      </mesh>
      <mesh position={[-6, 1.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.24, 3.2, 9]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.5} />
      </mesh>

      <group position={[-5.65, 0, -0.8]}>
        <RoundedBox args={[0.42, 2.2, 1.7]} radius={0.03} position={[0, 1.1, 0]} castShadow>
          <meshPhysicalMaterial color="#451a03" roughness={0.45} />
        </RoundedBox>
        {[0.45, 0.95, 1.45, 1.9].map((shelfY, sIdx) => (
          <group key={sIdx} position={[0.08, shelfY, 0]}>
            {[-0.55, -0.3, -0.05, 0.2, 0.45].map((bookZ, bIdx) => (
              <mesh key={bIdx} position={[0, 0.12, bookZ]}>
                <boxGeometry args={[0.24, 0.24, 0.1]} />
                <meshStandardMaterial
                  color={['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7'][(sIdx + bIdx) % 5]}
                />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      <group position={[-0.8, 0, 1.2]}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.025, 0.16, 0.6]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        <group position={[0, 0.48, 0.04]} rotation={[-0.2, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.16, 0.2, 0.08, 20]} rotation={[Math.PI / 2, 0, 0]} />
            <meshPhysicalMaterial color="#b45309" clearcoat={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <boxGeometry args={[0.05, 0.48, 0.03]} />
            <meshStandardMaterial color="#451a03" />
          </mesh>
        </group>
      </group>

      <group position={[6, 1.6, 0]}>
        <mesh>
          <boxGeometry args={[0.08, 3.2, 9]} />
          <meshPhysicalMaterial color="#e0f2fe" transmission={0.85} transparent opacity={0.4} roughness={0.05} />
        </mesh>
        {[-4.4, -1.5, 1.5, 4.4].map((zPos, i) => (
          <mesh key={i} position={[0, 0, zPos]}>
            <boxGeometry args={[0.14, 3.2, 0.12]} />
            <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.2} />
          </mesh>
        ))}
      </group>

      <AnimatedFrontDoor isOpen={isNearDoor} />

      <group position={[0.6, 0, 2.8]}>
        <RoundedBox args={[0.85, 0.1, 0.7]} radius={0.05} position={[0, 0.05, 0]} castShadow>
          <meshStandardMaterial color="#b45309" roughness={0.7} />
        </RoundedBox>
        <mesh position={[0.6, 0.07, -0.12]}>
          <cylinderGeometry args={[0.13, 0.1, 0.1, 20]} />
          <meshPhysicalMaterial color="#ef4444" clearcoat={0.8} />
        </mesh>
        <mesh position={[0.6, 0.07, 0.18]}>
          <cylinderGeometry args={[0.13, 0.1, 0.1, 20]} />
          <meshPhysicalMaterial color="#38bdf8" clearcoat={0.8} />
        </mesh>
      </group>

      <group position={[-4.6, 0, -3.7]}>
        <RoundedBox args={[0.88, 0.95, 0.85]} radius={0.05} position={[0, 0.48, 0]} castShadow>
          <meshPhysicalMaterial color="#f8fafc" clearcoat={0.8} roughness={0.15} />
        </RoundedBox>
        <mesh position={[0, 0.5, 0.43]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.05, 24]} />
          <meshPhysicalMaterial color="#0ea5e9" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>

      <group position={[-3.2, 0, 1.8]}>
        <RoundedBox args={[3.6, 0.03, 2.6]} radius={0.01} position={[0, 0.015, -0.3]} receiveShadow>
          <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </RoundedBox>

        <RoundedBox args={[2.8, 0.42, 0.9]} radius={0.1} position={[0, 0.26, 0.8]} castShadow>
          <meshPhysicalMaterial color="#334155" roughness={0.6} />
        </RoundedBox>
        <RoundedBox args={[2.8, 0.5, 0.22]} radius={0.08} position={[0, 0.65, 1.18]} castShadow>
          <meshPhysicalMaterial color="#1e293b" roughness={0.6} />
        </RoundedBox>

        <RoundedBox args={[1.4, 0.05, 0.75]} radius={0.02} position={[0.1, 0.36, -0.4]} castShadow>
          <meshPhysicalMaterial color="#e0f2fe" transmission={0.85} roughness={0.05} />
        </RoundedBox>

        <RoundedBox args={[2.5, 0.42, 0.5]} radius={0.04} position={[0, 0.22, -1.9]} castShadow>
          <meshPhysicalMaterial color="#27272a" clearcoat={0.5} roughness={0.3} />
        </RoundedBox>
        <mesh position={[0, 1.05, -1.9]} castShadow>
          <boxGeometry args={[2.2, 1.2, 0.06]} />
          <meshPhysicalMaterial color="#090d16" metalness={0.9} roughness={0.1} clearcoat={1} />
        </mesh>
        <LiveCinemaTVScreen isOn={isTvOn} />
      </group>

      <group position={[3.2, 0, -2.5]}>
        <RoundedBox args={[4.0, 0.92, 0.85]} radius={0.04} position={[-0.3, 0.46, -1.2]} castShadow>
          <meshPhysicalMaterial color="#1e293b" clearcoat={0.6} roughness={0.25} />
        </RoundedBox>
        <RoundedBox args={[4.08, 0.05, 0.9]} radius={0.02} position={[-0.3, 0.95, -1.2]}>
          <meshPhysicalMaterial map={marbleTex} clearcoat={0.9} roughness={0.1} />
        </RoundedBox>

        <group position={[-1.55, 1.12, -1.2]}>
          <RoundedBox args={[0.38, 0.34, 0.32]} radius={0.04} castShadow>
            <meshPhysicalMaterial color="#b91c1c" metalness={0.6} roughness={0.2} clearcoat={0.9} />
          </RoundedBox>
        </group>

        <mesh position={[-0.5, 0.98, -1.2]}>
          <boxGeometry args={[0.75, 0.04, 0.5]} />
          <meshStandardMaterial color="#38bdf8" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0.7, 0.98, -1.2]}>
          <boxGeometry args={[0.75, 0.04, 0.5]} />
          <meshStandardMaterial color="#090d16" metalness={0.8} roughness={0.1} />
        </mesh>
        <group position={[0.7, 1.04, -1.2]}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.17, 0.09, 24]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.035, 0]}>
            <cylinderGeometry args={[0.18, 0.16, 0.03, 20]} />
            <meshStandardMaterial color={currentDish.color} roughness={0.4} />
          </mesh>
          {isCooking && (
            <>
              <SteamParticles position={[0, 0.1, 0]} />
              <pointLight position={[0, 0.12, 0]} intensity={1.3} distance={3} color="#f97316" />
            </>
          )}
        </group>
        <RoundedBox args={[0.92, 2.2, 0.88]} radius={0.05} position={[2.15, 1.1, -1.2]} castShadow>
          <meshPhysicalMaterial color="#e2e8f0" metalness={0.85} roughness={0.15} clearcoat={0.7} />
        </RoundedBox>
      </group>

      <group position={[3.0, 0, 2.0]}>
        <RoundedBox args={[2.2, 0.07, 1.25]} radius={0.03} position={[0, 0.68, 0]} castShadow>
          <meshPhysicalMaterial map={marbleTex} clearcoat={0.9} roughness={0.1} />
        </RoundedBox>
        <RoundedBox args={[1.6, 0.64, 0.65]} radius={0.04} position={[0, 0.32, 0]} castShadow>
          <meshPhysicalMaterial color="#1e293b" roughness={0.4} />
        </RoundedBox>

        {[-0.45, 0.45].map((plateX, idx) => (
          <group key={idx} position={[plateX, 0.73, 0]}>
            <mesh>
              <cylinderGeometry args={[0.19, 0.16, 0.025, 20]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            {(isEating || currentDish) && (
              <group position={[0, 0.02, 0]}>
                <mesh>
                  <cylinderGeometry args={[0.14, 0.13, 0.025, 16]} />
                  <meshStandardMaterial color={currentDish.color} />
                </mesh>
              </group>
            )}
          </group>
        ))}

        {[
          [-0.62, 0.35, 0],
          [0.62, 0.35, 0],
          [0, 0.35, -0.85],
          [0, 0.35, 0.85],
        ].map((p, i) => (
          <RoundedBox key={i} args={[0.4, 0.44, 0.4]} radius={0.06} position={p as [number, number, number]} castShadow>
            <meshPhysicalMaterial color="#d97706" roughness={0.4} clearcoat={0.2} />
          </RoundedBox>
        ))}
      </group>

      <group position={[0, 0, -2.5]}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((step) => (
          <RoundedBox
            key={step}
            args={[1.3, 0.14, 0.42]}
            radius={0.03}
            position={[0, 0.2 + step * 0.4, -1.5 + step * 0.42]}
            castShadow
          >
            <meshPhysicalMaterial map={woodTex} clearcoat={0.5} roughness={0.3} />
          </RoundedBox>
        ))}
      </group>

      <group position={[0, 3.2, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
          <planeGeometry args={[12, 9]} />
          <MeshReflectorMaterial
            map={woodTex}
            blur={[300, 100]}
            resolution={512}
            mixBlur={0.8}
            mixStrength={0.3}
            roughness={0.38}
            depthScale={1}
            metalness={0.1}
            mirror={0.22}
          />
        </mesh>

        <mesh position={[0, 0.55, 4.45]}>
          <boxGeometry args={[12, 1.1, 0.06]} />
          <meshPhysicalMaterial color="#bae6fd" transmission={0.85} transparent opacity={0.5} roughness={0.05} />
        </mesh>

        <mesh position={[0, 1.5, -4.5]} castShadow>
          <boxGeometry args={[12, 3.0, 0.22]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.6} />
        </mesh>

        <InteractiveWardrobe isOpen={isDressing} />

        <group position={[1.8, 0, -3.4]}>
          <RoundedBox args={[1.5, 0.07, 0.8]} radius={0.02} position={[0, 0.68, 0]} castShadow>
            <meshPhysicalMaterial color="#1e293b" clearcoat={0.6} />
          </RoundedBox>
          <mesh position={[-0.65, 0.34, 0]}>
            <boxGeometry args={[0.08, 0.68, 0.7]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0.65, 0.34, 0]}>
            <boxGeometry args={[0.08, 0.68, 0.7]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <RoundedBox args={[0.88, 0.48, 0.04]} radius={0.02} position={[0, 1.0, -0.22]} castShadow>
            <meshStandardMaterial color="#090d16" emissive="#38bdf8" emissiveIntensity={0.85} />
          </RoundedBox>
          <RoundedBox args={[0.44, 0.42, 0.44]} radius={0.06} position={[0, 0.32, 0.5]} castShadow>
            <meshPhysicalMaterial color="#4f46e5" />
          </RoundedBox>
        </group>

        <group position={[-3.0, 0, -2.0]}>
          <RoundedBox args={[2.3, 0.44, 2.0]} radius={0.08} position={[0, 0.24, 0]} castShadow>
            <meshPhysicalMaterial color="#9f1239" roughness={0.5} />
          </RoundedBox>
          <RoundedBox args={[2.3, 0.85, 0.14]} radius={0.05} position={[0, 0.8, -0.95]} castShadow>
            <meshPhysicalMaterial color="#1e293b" roughness={0.4} />
          </RoundedBox>
          <RoundedBox args={[0.62, 0.12, 0.4]} radius={0.05} position={[-0.42, 0.5, -0.62]}>
            <meshStandardMaterial color="#ffffff" />
          </RoundedBox>
          <RoundedBox args={[0.62, 0.12, 0.4]} radius={0.05} position={[0.42, 0.5, -0.62]}>
            <meshStandardMaterial color="#ffffff" />
          </RoundedBox>
          {someoneInBed && (
            <RoundedBox args={[2.15, 0.16, 1.25]} radius={0.06} position={[0, 0.6, 0.2]} castShadow>
              <meshPhysicalMaterial color="#f8fafc" roughness={0.7} sheen={0.4} />
            </RoundedBox>
          )}
        </group>

        <group position={[-3.6, 0, 2.3]}>
          <mesh position={[0, 1.05, 0]}>
            <boxGeometry args={[1.5, 2.1, 1.5]} />
            <meshPhysicalMaterial color="#e0f2fe" transmission={0.85} transparent opacity={0.5} roughness={0.05} />
          </mesh>
          <mesh position={[0, 2.0, -0.35]}>
            <cylinderGeometry args={[0.14, 0.2, 0.07, 20]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          {isShowering && <ShowerWaterParticles position={[0, 0.0, 0]} />}
        </group>

        <group position={[4.4, 0, 2.2]}>
          <RoundedBox args={[1.8, 0.04, 1.6]} radius={0.02} position={[0, 0.02, 0]}>
            <meshStandardMaterial color="#1e293b" roughness={0.8} />
          </RoundedBox>
          <RoundedBox args={[0.75, 0.1, 1.3]} radius={0.04} position={[-0.35, 0.07, 0]} castShadow>
            <meshStandardMaterial color="#0f172a" />
          </RoundedBox>
          <mesh position={[-0.35, 0.6, -0.55]}>
            <boxGeometry args={[0.7, 1.0, 0.07]} />
            <meshStandardMaterial color="#334155" metalness={0.8} />
          </mesh>
        </group>

        {cribsCount > 0 && (
          <group position={[3.6, 0, -1.2]}>
            <RoundedBox args={[1.35, 0.22, 0.9]} radius={0.05} position={[0, 0.32, 0]} castShadow>
              <meshStandardMaterial color="#fbcfe8" />
            </RoundedBox>
            <mesh position={[0, 0.6, -0.42]}>
              <boxGeometry args={[1.35, 0.5, 0.05]} />
              <meshStandardMaterial color="#f472b6" />
            </mesh>
            <mesh position={[0, 0.6, 0.42]}>
              <boxGeometry args={[1.35, 0.5, 0.05]} />
              <meshStandardMaterial color="#f472b6" />
            </mesh>
            <mesh position={[-0.65, 0.6, 0]}>
              <boxGeometry args={[0.05, 0.5, 0.9]} />
              <meshStandardMaterial color="#f472b6" />
            </mesh>
            <mesh position={[0.65, 0.6, 0]}>
              <boxGeometry args={[0.05, 0.5, 0.9]} />
              <meshStandardMaterial color="#f472b6" />
            </mesh>
          </group>
        )}

        {houseLevel > 1 && (
          <RoundedBox args={[2.0, 0.9, 1.3]} radius={0.08} position={[4.5, 0.45, -2.5]} castShadow>
            <meshPhysicalMaterial color="#10b981" clearcoat={0.4} />
          </RoundedBox>
        )}
      </group>
    </group>
  );
}

function CameraTracker({
  followMode,
  targetAgent,
}: {
  followMode: boolean;
  targetAgent?: Agent3D;
}) {
  useFrame(({ camera }) => {
    if (!followMode || !targetAgent || targetAgent.is_at_work) return;
    const desiredCamPos = new THREE.Vector3(
      targetAgent.x,
      targetAgent.y + 3.1,
      targetAgent.z + 4.4
    );
    camera.position.lerp(desiredCamPos, 0.05);
    camera.lookAt(targetAgent.x, targetAgent.y + 1.05, targetAgent.z);
  });
  return null;
}

interface World3DProps {
  agents: Agent3D[];
  houseLevel: number;
  cribsCount: number;
  currentDish: DishInfo;
  timeOfDay: string;
  followCamera: boolean;
  isFullscreen: boolean;
  speakingAgentName: string | null;
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
}

export default function World3D({
  agents,
  houseLevel,
  cribsCount,
  currentDish,
  timeOfDay,
  followCamera,
  isFullscreen,
  speakingAgentName,
  selectedAgentId,
  onSelectAgent,
}: World3DProps) {
  const hour = parseInt(timeOfDay.split(':')[0] || '12', 10);
  const isNight = hour >= 22 || hour < 6;
  const sunAngle = ((hour - 6) / 16) * Math.PI;
  const sunX = Math.cos(sunAngle) * 22;
  const sunY = isNight ? -8 : Math.max(2.5, Math.sin(sunAngle) * 24);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <div
      className={`w-full overflow-hidden bg-slate-950 shadow-2xl ${
        isFullscreen ? 'h-screen rounded-none' : 'h-[560px] rounded-2xl border border-slate-700/80'
      }`}
    >
      <Canvas
        shadows
        camera={{ position: [0, 10.5, 15.0], fov: 40 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: isNight ? 0.85 : 1.18,
        }}
      >
        <SoftShadows size={18} samples={16} focus={0.5} />
        <color attach="background" args={[isNight ? '#02040a' : '#0c1524']} />
        <Sky
          sunPosition={[sunX, sunY, 12]}
          turbidity={isNight ? 10 : 0.25}
          rayleigh={isNight ? 0.05 : 0.65}
        />
        {isNight && <Stars radius={70} depth={35} count={3500} factor={4} fade />}

        <ambientLight intensity={isNight ? 0.22 : 0.68} />
        <directionalLight
          position={[sunX, Math.max(10, sunY), 14]}
          intensity={isNight ? 0.18 : 1.55}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        <Environment preset={isNight ? 'night' : 'city'} />
        <LuxuryVilla
          houseLevel={houseLevel}
          cribsCount={cribsCount}
          currentDish={currentDish}
          agents={agents}
        />

        <Suspense fallback={null}>
          {agents.map((agent) => {
            if (agent.role === 'pet') {
              return (
                <RiggedPetGLB
                  key={agent.id}
                  agent={agent}
                  isSelected={agent.id === selectedAgentId}
                  isSpeakingAudio={speakingAgentName === agent.name}
                  onSelect={onSelectAgent}
                />
              );
            }
            const partner = agents.find((a) => a.id !== agent.id && a.role === 'full_bot');
            return (
              <ProportionalHuman
                key={agent.id}
                agent={agent}
                partner={partner}
                isSelected={agent.id === selectedAgentId}
                isSpeakingAudio={speakingAgentName === agent.name}
                onSelect={onSelectAgent}
              />
            );
          })}
        </Suspense>

        <ContactShadows position={[0, 0.01, 0]} opacity={0.55} scale={30} blur={2.2} />
        <CameraTracker followMode={followCamera} targetAgent={selectedAgent} />
        {!followCamera && (
          <OrbitControls maxPolarAngle={Math.PI / 2.06} minDistance={3.0} maxDistance={28} />
        )}
      </Canvas>
    </div>
  );
}