'use client';

import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { controls, LAYOUT, SEATS, sweepState, bathState, type Seat, type SweepPhase, type BathPhase } from '@/components/three/controls';
import ChantPanel, { type ChantMode } from '@/components/ui/ChantPanel';
import type { ChantItem } from '@/lib/chanting';
import { multiplayer, getSessionId, guestName, getStoredWsUrl, setStoredWsUrl, getSolo, setSolo, type MpStatus } from '@/lib/multiplayer';
import { loadFlame, markFlameDay, flameLabel, flameNote, type FlameState } from '@/lib/flame';

const World = dynamic(() => import('@/components/three/World'), { ssr: false });

type Prayer = { type: string; text: string; date: string };

/** Isolates a WebGL / Canvas failure to the 3D area: the HTML screen
 *  (map, articles, audio) keeps working instead of the whole page
 *  showing an application error. */
class WorldErrorBoundary extends React.Component<
  { children: React.ReactNode; onRetry: () => void; onOpenMap: () => void },
  { failed: boolean }
> {
  constructor(props: { children: React.ReactNode; onRetry: () => void; onOpenMap: () => void }) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#fdf8ec] p-6 text-center">
          <div className="max-w-sm">
            <p className="font-serif text-xl text-amber-900">Không mở được khung cảnh 3D trên thiết bị này.</p>
            <p className="mt-2 text-sm text-stone-600">Bạn vẫn có thể xem sơ đồ chùa, đọc bài và nghe âm thanh ở chế độ nhẹ.</p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" onClick={this.props.onOpenMap} className="rounded-full bg-amber-800 py-3 font-medium text-white">🗺 Mở sơ đồ chùa</button>
              <button type="button" onClick={this.props.onRetry} className="rounded-full bg-stone-200 py-3 text-sm">Thử lại</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
type Ritual = 'none' | 'choosing' | 'offering' | 'done';

const PRAYERS_KEY = 'thien-vien-prayers';
const NAME_KEY = 'thien-vien-name';

function loadPrayers(): Prayer[] {
  try {
    return JSON.parse(localStorage.getItem(PRAYERS_KEY) || '[]') as Prayer[];
  } catch {
    return [];
  }
}

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [entered, setEntered] = useState(false);
  const [name, setName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [zone, setZone] = useState<'burner' | 'chant' | 'pond' | 'altar' | 'none'>('none');
  const zoneRef = useRef<'burner' | 'chant' | 'pond' | 'altar' | 'none'>('none');
  // Fish release (lotus pond)
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [spawnTick, setSpawnTick] = useState(0);
  const [spawnCount, setSpawnCount] = useState(1);
  const [fishCount, setFishCount] = useState(0);
  const [releaseMessage, setReleaseMessage] = useState('');
  const [remoteTick, setRemoteTick] = useState(0);
  // Hall ritual: kneel / sit in front of the Guanyin statue.
  const [hallRitual, setHallRitual] = useState<'none' | 'sit' | 'kneel'>('none');
  const [wishOpen, setWishOpen] = useState(false);
  const [wishText, setWishText] = useState('');
  const [wishChoice, setWishChoice] = useState('');
  const remoteReleaseSeen = useRef(0);
  const [ritual, setRitual] = useState<Ritual>('none');
  const [prayerChoice, setPrayerChoice] = useState('Cầu bình an');
  const [customPrayer, setCustomPrayer] = useState('');
  const [prayerMessage, setPrayerMessage] = useState('');
  const [burnerStage, setBurnerStage] = useState<'idle' | 'inserting' | 'lit'>('idle');
  const [insertT, setInsertT] = useState(0);
  const [chantOpen, setChantOpen] = useState(false);
  const [chantPlaying, setChantPlaying] = useState(false);
  const [chantMode, setChantMode] = useState<ChantMode>('calm');
  const [finishedChant, setFinishedChant] = useState<ChantItem | null>(null);
  const [dedicationOpen, setDedicationOpen] = useState(false);
  const [dedicationOption, setDedicationOption] = useState<'self' | 'family' | 'relative' | 'all'>('family');
  const [relativeName, setRelativeName] = useState('');
  const [dedicationText, setDedicationText] = useState('');
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [bookOpen, setBookOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [lowQuality, setLowQuality] = useState(false);
  const [mpStatus, setMpStatus] = useState<MpStatus>('offline');
  const [mpRoom, setMpRoom] = useState('');
  const [mpCount, setMpCount] = useState(0);
  const [hideOthers, setHideOthers] = useState(false);
  const [soloMode, setSoloMode] = useState(false);
  const [wsUrl, setWsUrl] = useState('');
  const [wsUrlInput, setWsUrlInput] = useState('');
  const [remoteIncenseActive, setRemoteIncenseActive] = useState(false);
  const [showHint, setShowHint] = useState(false);
  // Mobile-only menu (bottom sheet). Desktop keeps its full top bar.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [soundPlaying, setSoundPlaying] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  // Daily flame (lib/flame.ts): one flame-day per day of real practice,
  // localStorage only. Never 'giữ chuỗi', never attendance-style.
  const [flame, setFlame] = useState<FlameState>(() => loadFlame());
  const touchFlame = () => { setFlame(markFlameDay().state); };
  const [soundBlocked, setSoundBlocked] = useState(false);
  // Usable seats (hall 8 mats + outdoor): sit via auto-walk, then pose.
  const [seatedSeat, setSeatedSeat] = useState<Seat | null>(null);
  const [sitPending, setSitPending] = useState<Seat | null>(null);
  // Context action (nearest object, hysteresis in the poll below).
  type Ctx = { kind: 'seat' | 'broom' | 'jar' | 'bed' | 'bell' | 'bath'; id: string; label: string };
  const [ctxAction, setCtxAction] = useState<Ctx | null>(null);
  const ctxRef = useRef<Ctx | null>(null);
  // Sweep leaves (Request C, 2026-11-04): the timeline lives in
  // Grounds (sweepState); the page mirrors it for UI + movement
  // lock, and owns start / pause / resume / cancel. Leaf positions
  // live in Grounds refs only — never in React state, never synced.
  const [sweepPhase, setSweepPhase] = useState<SweepPhase>('idle');
  const [sweepProgress, setSweepProgress] = useState(0);
  const [sweepPaused, setSweepPaused] = useState(false);
  const [sweepPending, setSweepPending] = useState(false);
  const sweepPrevRef = useRef<SweepPhase>('idle');
  const [sweepDone, setSweepDone] = useState(false);
  const [sweepThanksOpen, setSweepThanksOpen] = useState(false);
  const [sweepWhyOpen, setSweepWhyOpen] = useState(false);
  // Bathing ritual (Request E, 2026-11-04): the timeline lives in
  // Lumbini (bathState); the page mirrors it for UI + movement
  // lock, and owns start / stop. The pose stays 'pray' for the
  // whole ritual, so remote players see a praying figure at
  // Lumbini (the Worker whitelist has no scoop/pour state, and
  // RemotePlayers render no ladle — same first-phase rule as C).
  const [bathPhase, setBathPhase] = useState<BathPhase>('idle');
  const [bathProgress, setBathProgress] = useState(0);
  const [bathPourRound, setBathPourRound] = useState(0);
  const [bathPending, setBathPending] = useState(false);
  const bathPrevRef = useRef<BathPhase>('idle');
  const [bathBlessingOpen, setBathBlessingOpen] = useState(false);
  const [vesakOpen, setVesakOpen] = useState(false);
  const [festivalOn, setFestivalOn] = useState(false);
  // Festival mode persists on this device only (no database,
  // per the E spec: a plain on/off config, default off).
  useEffect(() => {
    try {
      if (localStorage.getItem('chua-lumbini-festival') === '1') setFestivalOn(true);
    } catch { /* private mode: festival just stays off */ }
  }, []);
  // Water vegetables
  const [carryingWater, setCarryingWater] = useState(false);
  const [soilWet, setSoilWet] = useState(false);
  const [waterStream, setWaterStream] = useState(false);
  const [waterCardOpen, setWaterCardOpen] = useState(false);
  // Mindful walk, bell, reading, map, info boards
  const [bellPlaying, setBellPlaying] = useState(false);
  const [bellRingSeq, setBellRingSeq] = useState(0);
  const [bellRinging, setBellRinging] = useState(false);
  const bellCooldownUntil = useRef(0);
  const bellRef = useRef<HTMLAudioElement | null>(null);
  const [readingOpen, setReadingOpen] = useState(false);
  const [readingId, setReadingId] = useState<'first' | 'mindful' | 'dedication'>('first');
  const [mapOpen, setMapOpen] = useState(false);
  const [mapZone, setMapZone] = useState<string>('hall');
  const [playerPos, setPlayerPos] = useState({ x: 0, z: 17.5 });
  const [webglFailed, setWebglFailed] = useState(false);
  const [worldKey, setWorldKey] = useState(0);
  const [toast, setToast] = useState('');
  const bgRef = useRef<HTMLAudioElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; moved: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const joyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(NAME_KEY);
    if (saved) {
      setName(saved);
      setNameInput(saved);
      setSettingsName(saved);
    }
    setPrayers(loadPrayers());
    setSoloMode(getSolo());
    setSoundMuted(localStorage.getItem('thien-vien-sound') === 'off');
    setHideOthers(localStorage.getItem('thien-vien-hide-others') === '1');
    const envUrl = process.env.NEXT_PUBLIC_MULTIPLAYER_WS_URL || '';
    const storedUrl = getStoredWsUrl();
    const initialUrl = storedUrl || envUrl;
    setWsUrl(initialUrl);
    setWsUrlInput(initialUrl);
    setLoaded(true);
  }, []);

  useEffect(() => {
    const unsub = multiplayer.subscribe(() => {
      setMpStatus(multiplayer.status);
      setMpRoom(multiplayer.roomId);
      setMpCount(multiplayer.count);
    });
    const iv = setInterval(() => {
      const now = Date.now();
      let active = false;
      for (const ts of Array.from(multiplayer.incenseAt.values())) {
        if (now - ts < 4000) { active = true; break; }
      }
      setRemoteIncenseActive(active);
      // Remote release: each new timestamp spawns one ripple + one
      // fish on this client only — the fish themselves are never synced.
      let latest = 0;
      for (const ts of Array.from(multiplayer.releaseAt.values())) {
        if (ts > latest) latest = ts;
      }
      if (latest > remoteReleaseSeen.current) {
        remoteReleaseSeen.current = latest;
        setRemoteTick((t) => t + 1);
      }
    }, 500);
    return () => { unsub(); clearInterval(iv); };
  }, []);

  // Multiplayer bridge: render loop and network are independent.
  // This runs 10x/sec, outside the canvas, and sends only when the
  // position moved >0.15m, facing changed >0.15 rad, the animation
  // state changed, or 5s passed since the last send.
  const lastSentRef = useRef({ x: 0, z: 0, facing: 0, state: '', at: 0 });
  useEffect(() => {
    if (!entered) return;
    const iv = setInterval(() => {
      const x = controls.playerPos.x;
      const z = controls.playerPos.z;
      const facing = controls.playerFacing;
      // Sweep note (Request C, first phase): the Worker only
      // accepts idle/walking/sitting/praying/offering_incense, so a
      // 'sweeping' state would be dropped and remote clients have
      // no broom animation. Sweeping therefore stays local (like
      // bell sound and chant audio, which are personal-only):
      // others still see this player standing at the banyan, and
      // leaf state is personal, so no one clears anyone else's
      // leaves. A Worker + remote-broom change is a separate,
      // riskier step — not done here, to keep proven multiplayer intact.
      let state: 'idle' | 'walking' | 'sitting' | 'praying' | 'offering_incense' = 'idle';
      if (ritual === 'offering') state = 'offering_incense';
      else if (chantPlaying && chantMode === 'calm') state = 'sitting';
      else if (controls.pose === 'pray' || controls.pose === 'kneel') state = 'praying';
      else if (controls.pose === 'sit') state = 'sitting';
      else if (controls.playerMoving) state = 'walking';
      const last = lastSentRef.current;
      const moved = Math.hypot(x - last.x, z - last.z);
      const turned = Math.abs(facing - last.facing);
      const now = Date.now();
      if (moved > 0.15 || turned > 0.15 || state !== last.state || now - last.at > 5000) {
        multiplayer.sendMove(x, z, facing, state);
        lastSentRef.current = { x, z, facing, state, at: now };
      }
    }, 100);
    return () => clearInterval(iv);
  }, [entered, ritual, chantPlaying, chantMode]);

  const connectMultiplayer = useCallback((url: string, displayName: string) => {
    if (getSolo()) {
      multiplayer.disconnect();
      setMpStatus('offline');
      return;
    }
    if (!url) {
      multiplayer.disconnect();
      setMpStatus('offline');
      return;
    }
    multiplayer.connect(url, displayName);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const savePrayer = (type: string, text: string) => {
    const entry = { type, text, date: new Date().toLocaleString('vi-VN') };
    const next = [...loadPrayers(), entry];
    localStorage.setItem(PRAYERS_KEY, JSON.stringify(next));
    setPrayers(next);
  };

  // Camera mode + pose follow the current activity (intro is left alone
  // until CameraRig itself finishes the sweep and switches to follow).
  const canMove =
    entered &&
    sweepPhase === 'idle' &&
    !sweepPending &&
    bathPhase === 'idle' &&
    !bathPending &&
    !bathBlessingOpen &&
    !vesakOpen &&
    ritual === 'none' &&
    !(chantPlaying && chantMode === 'calm') &&
    !dedicationOpen &&
    !mobileMenuOpen &&
    !releaseOpen &&
    hallRitual === 'none' &&
    !seatedSeat &&
    !bellRinging;

  useEffect(() => {
    if (!entered) {
      controls.mode = 'menu';
      return;
    }
    if (ritual === 'choosing' || ritual === 'offering') {
      controls.mode = 'burner';
      controls.pose = 'pray';
    } else if (chantPlaying && chantMode === 'calm') {
      controls.mode = 'chant';
      controls.pose = 'sit';
    } else if (hallRitual === 'kneel') {
      controls.pose = 'kneel';
      if (controls.mode !== 'intro') controls.mode = 'follow';
    } else if (hallRitual === 'sit') {
      controls.pose = 'sit';
      if (controls.mode !== 'intro') controls.mode = 'follow';
    } else if (seatedSeat) {
      controls.pose = 'sit';
      controls.sitFacing = seatedSeat.facing;
      if (controls.mode !== 'intro') controls.mode = 'follow';
    } else {
      controls.pose = 'stand';
      if (controls.mode !== 'intro') controls.mode = 'follow';
    }
  }, [entered, ritual, chantPlaying, chantMode, hallRitual, seatedSeat]);

  // Background music vs chanting: two separate streams, never
  // overlapping. When chanting starts, fade the background down
  // and pause it; when chanting really stops, bring it back only
  // if the guest still allows music (not muted).
  const bgWasPlaying = useRef(false);
  useEffect(() => {
    const bg = bgRef.current;
    if (!bg) return;
    if (chantPlaying) {
      bgWasPlaying.current = !bg.paused;
      bg.volume = 0.05;
      const tm = setTimeout(() => bg.pause(), 500);
      return () => clearTimeout(tm);
    }
    if (bgWasPlaying.current && !soundMuted && entered) {
      bg.volume = 0.1;
      bg.play().then(() => {
        bg.volume = 0.22;
      }).catch(() => {});
    }
  }, [chantPlaying, soundMuted, entered]);
  // WebGL support pre-check: if the device cannot create a WebGL
  // context at all, show the light HTML mode instead of a crash.
  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      if (!c.getContext('webgl') && !c.getContext('webgl2') && !c.getContext('experimental-webgl')) {
        setWebglFailed(true);
      }
    } catch {
      setWebglFailed(true);
    }
  }, []);

  // Keyboard: WASD/arrows + E to interact. While the user types in an
  // input/textarea (welcome name, wish text, custom prayer), keys must
  // go to the field: Space was previously preventDefaulted globally,
  // so spaces could not be typed in a wish, and typing "e" could
  // re-trigger a ritual.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        if (sweepState.phase !== 'idle') { cancelSweep(); return; }
        setMapOpen(false); setReadingOpen(false);
        setSettingsOpen(false); setHelpOpen(false); setBookOpen(false);
        setChantOpen(false); setReleaseOpen(false); setWishOpen(false);
        setMobileMenuOpen(false); setSweepWhyOpen(false); setWaterCardOpen(false);
        return;
      }
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      controls.keys.add(k);
      if (showHint) setShowHint(false);
      if (k === 'e' && entered) {
        if (zoneRef.current === 'burner' && ritual === 'none') startRitual();
        else if (zoneRef.current === 'chant' && !chantOpen) setChantOpen(true);
        else if (zoneRef.current === 'pond' && !releaseOpen) setReleaseOpen(true);
        else if (zoneRef.current === 'altar' && hallRitual === 'none') startHallRitual('kneel');
        else if (zoneRef.current === 'altar' && hallRitual !== 'none' && !wishOpen) setWishOpen(true);
      }
    };
    const up = (e: KeyboardEvent) => controls.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered, ritual, chantOpen, showHint, hallRitual, wishOpen]);

  const handleZone = useCallback((z: 'burner' | 'chant' | 'pond' | 'altar' | 'none') => {
    zoneRef.current = z;
    setZone(z);
  }, []);

  const enterTemple = () => {
    const raw = nameInput.trim();
    // Guest default, stable per browser (from sessionId), so a guest
    // is never forced to invent a name and never duplicates on reconnect.
    const clean = (raw || guestName(getSessionId())).slice(0, 30);
    setName(clean);
    setSettingsName(clean);
    localStorage.setItem(NAME_KEY, clean);
    setEntered(true);
    setShowHint(true);
    // Music starts in this very click / Enter gesture, before any
    // async work, at a gentle 20-25% volume. If the browser refuses,
    // the speaker button itself becomes the "Bật nhạc" control.
    if (localStorage.getItem('thien-vien-sound') !== 'off') {
      const bg = bgRef.current;
      if (bg) {
        bg.volume = 0.22;
        bg.play().then(() => {
          setSoundPlaying(true); setSoundBlocked(false);
        }).catch(() => {
          setSoundPlaying(false); setSoundBlocked(true);
          showToast('Trình duyệt chưa cho phát nhạc — bấm nút loa để bật nhạc.');
        });
      }
    }
    controls.mode = 'intro';
    controls.introT = 0;
    controls.playerPos = { x: LAYOUT.spawn.x, y: 0, z: LAYOUT.spawn.z };
    setTimeout(() => setShowHint(false), 12000);
    const url = getStoredWsUrl() || process.env.NEXT_PUBLIC_MULTIPLAYER_WS_URL || '';
    connectMultiplayer(url, clean);
    if (!getSolo() && !url) {
      showToast('Bạn đang ở chế độ riêng — phòng chung chưa được cấu hình, xem Cài đặt để bật multiplayer.');
    }
  };

  // Hall ritual: kneel or sit in front of the Guanyin statue, then
  // the wish panel opens on its own (after the pose settles).
  // The wish itself is PRIVATE: it is saved only to this device's
  // prayer book and is never sent to multiplayer or read aloud.
  const startHallRitual = (kind: 'sit' | 'kneel') => {
    setHallRitual(kind);
    setWishChoice('');
    setWishText('');
    setTimeout(() => setWishOpen(true), 700);
  };
  const standUp = () => {
    setHallRitual('none');
    setWishOpen(false);
  };
  // Sit on a usable seat: walk to it first (existing auto-move),
  // then pose. Standing up walks the guest back to the aisle/path.
  const sitAtSeat = (seat: Seat) => {
    setSitPending(seat);
    controls.waypoints = [];
    controls.moveTarget = { x: seat.x, z: seat.z };
    if (controls.mode === 'menu' || controls.mode === 'intro') controls.mode = 'follow';
  };
  const standUpSeat = () => {
    if (!seatedSeat) return;
    const s = seatedSeat;
    setSeatedSeat(null);
    controls.pose = 'stand';
    // Exit point: south for hall/banyan/tea seats, east for the
    // lake seat (onto the bank path), south for the corridor chair.
    const exit =
      s.area === 'lake' ? { x: s.x + 1.5, z: s.z } : { x: s.x, z: s.z + 1.5 };
    controls.moveTarget = exit;
    controls.waypoints = [];
  };
  // Arrival check for a pending seat + sweep gathering + context poll.
  useEffect(() => {
    if (!entered) return;
    const iv = setInterval(() => {
      const px = controls.playerPos.x;
      const pz = controls.playerPos.z;
      setPlayerPos({ x: px, z: pz });
      if (sitPending) {
        if (Math.hypot(px - sitPending.x, pz - sitPending.z) < 0.45) {
          setSeatedSeat(sitPending);
          setSitPending(null);
        }
      }
      // Sweep: auto-walk arrival -> start; phase/progress mirror;
      // completed->idle -> final message + free walk resumes.
      // Safety: if the player somehow ends up far from the sweep
      // spot mid-sweep, cancel (leaves keep positions, no
      // background animation after leaving the area).
      if (sweepPending && Math.hypot(px - LAYOUT.sweepSpot.x, pz - LAYOUT.sweepSpot.z) < 0.45) {
        setSweepPending(false);
        controls.sweepAutoWalk = false;
        sweepState.paused = false;
        setSweepPaused(false);
        sweepState.phase = 'preparing';
        controls.mode = 'sweep';
        setSweepPhase('preparing');
        sweepPrevRef.current = 'preparing';
      }
      {
        const ph = sweepState.phase;
        if (ph !== sweepPrevRef.current) {
          if (ph === 'completed') controls.mode = 'follow'; // camera lerps back during D
          if (sweepPrevRef.current === 'completed' && ph === 'idle') {
            setSweepDone(true);
            setSweepThanksOpen(true);
          }
          sweepPrevRef.current = ph;
          setSweepPhase(ph);
        }
        setSweepProgress(sweepState.progress);
        if (ph !== 'idle' && Math.hypot(px - LAYOUT.sweepSpot.x, pz - LAYOUT.sweepSpot.z) > 4) {
          cancelSweep();
        }
      }
      // Bath ritual (Request E): auto-walk arrival -> start;
      // phase/pour-round mirror; done -> blessing dialog.
      // Pose stays 'pray' for the whole ritual (remote players
      // see a praying figure at Lumbini); safety-cancel if the
      // player somehow ends up far from the ritual spot mid-way.
      if (bathPending && Math.hypot(px - LAYOUT.lumbiniSpot.x, pz - LAYOUT.lumbiniSpot.z) < 0.45) {
        setBathPending(false);
        controls.bathAutoWalk = false;
        controls.pose = 'pray';
        bathState.phase = 'pray';
        bathPrevRef.current = 'pray';
        setBathPhase('pray');
      }
      {
        const ph = bathState.phase;
        if (ph !== bathPrevRef.current) {
          if (ph === 'done') {
            controls.pose = 'stand';
            setBathBlessingOpen(true);
          }
          bathPrevRef.current = ph;
          setBathPhase(ph);
        }
        setBathProgress(bathState.progress);
        setBathPourRound(bathState.pourRound);
        if (ph !== 'idle' && ph !== 'done' && Math.hypot(px - LAYOUT.lumbiniSpot.x, pz - LAYOUT.lumbiniSpot.z) > 4) {
          cancelBath();
        }
      }
      // Context action: nearest object, with hysteresis so the
      // prompt does not flicker when standing between two objects.
      const candidates: Array<Ctx & { d: number }> = [];
      const seatOccupied = (s: Seat) => {
        for (const rp of Array.from(multiplayer.players.values())) {
          if ((rp.target.state === 'sitting' || rp.target.state === 'praying') && Math.hypot(rp.target.x - s.x, rp.target.z - s.z) < 0.8) return true;
        }
        return false;
      };
      if (!seatedSeat && !sitPending) {
        for (const s of SEATS) {
          if (seatOccupied(s)) continue;
          const d = Math.hypot(px - s.x, pz - s.z);
          if (d < 1.4) candidates.push({ kind: 'seat', id: s.id, label: s.area === 'lake' ? 'Ngồi ngắm hồ' : 'Ngồi tại đây', d });
        }
      }
      if (sweepState.phase === 'idle' && !sweepPending && !sweepDone) {
        const d = Math.hypot(px - LAYOUT.broom.x, pz - LAYOUT.broom.z);
        if (d < 2.0) candidates.push({ kind: 'broom', id: 'broom', label: 'Quét lá', d });
      }
      {
        const d = Math.hypot(px - LAYOUT.waterJar.x, pz - LAYOUT.waterJar.z);
        if (d < 1.6 && !carryingWater) candidates.push({ kind: 'jar', id: 'jar', label: 'Múc nước', d });
      }
      if (carryingWater) {
        const d = Math.hypot(px - LAYOUT.vegBed.x, pz - LAYOUT.vegBed.z);
        if (d < 1.8) candidates.push({ kind: 'bed', id: 'bed', label: 'Tưới cây', d });
      }
      {
        const d = Math.hypot(px - LAYOUT.bellTower.x, pz - LAYOUT.bellTower.z);
        // Radius 3.0 (was 2.0): the new standing spot (-12,-5.5) is
        // 2.69m from the tower centre, so 2.0 never triggered here.
        if (d < 3.0) candidates.push({ kind: 'bell', id: 'bell', label: 'Thỉnh chuông', d });
      }
      // Bathing ritual (Request E): within 2.5m of the basin
      // centre (-17,-19.5). The basin collider keeps the player
      // ~1m out, so 2.5m is reachable from the ritual spot and
      // the platform edge alike. Uses bathState directly (like
      // the sweep), not the mirrored React state, so the prompt
      // never goes stale between polls.
      if (bathState.phase === 'idle' && !bathPending) {
        const d = Math.hypot(px - LAYOUT.lumbiniBasin.x, pz - LAYOUT.lumbiniBasin.z);
        if (d < 2.5) candidates.push({ kind: 'bath', id: 'bath', label: 'Tắm Phật', d });
      }
      candidates.sort((a, b) => a.d - b.d);
      const best = candidates[0] ?? null;
      const cur = ctxRef.current;
      let next: Ctx | null = null;
      if (best) {
        if (!cur || cur.id !== best.id) {
          const curD = cur ? candidates.find((c) => c.id === cur.id)?.d ?? 99 : 99;
          if (!cur || best.d < curD - 0.5 || curD >= 99) next = { kind: best.kind, id: best.id, label: best.label };
          else next = cur;
        } else next = cur;
      }
      if (next?.id !== cur?.id) { ctxRef.current = next; setCtxAction(next); }
      else if (!next && cur) { ctxRef.current = null; setCtxAction(null); }
    }, 200);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered, sitPending, sweepPending, sweepDone, bathPending, seatedSeat, carryingWater]);
  const doCtxAction = () => {
    const a = ctxRef.current;
    if (!a) return;
    if (a.kind === 'seat') {
      const s = SEATS.find((x) => x.id === a.id);
      if (s) sitAtSeat(s);
    } else if (a.kind === 'broom') {
      // Request C auto flow (one click, 13s total): walk to the
      // sweep spot first; the poll starts 'preparing' on arrival.
      // If already at the spot, start at once.
      if (Math.hypot(controls.playerPos.x - LAYOUT.sweepSpot.x, controls.playerPos.z - LAYOUT.sweepSpot.z) < 0.45) {
        controls.sweepAutoWalk = false;
        sweepState.paused = false;
        setSweepPaused(false);
        sweepState.phase = 'preparing';
        controls.mode = 'sweep';
        setSweepPhase('preparing');
        sweepPrevRef.current = 'preparing';
      } else {
        setSweepPending(true);
        controls.sweepAutoWalk = true;
        controls.waypoints = [];
        controls.moveTarget = { ...LAYOUT.sweepSpot };
        showToast('Đang đi đến chỗ quét lá dưới gốc đa…');
      }
    } else if (a.kind === 'jar') {
      setCarryingWater(true);
      showToast('Đã múc một gáo nước — tới luống rau ở vườn sau để tưới.');
    } else if (a.kind === 'bed') {
      setWaterStream(true);
      setTimeout(() => {
        setWaterStream(false);
        setSoilWet(true);
        setCarryingWater(false);
        setWaterCardOpen(true);
      }, 3000);
    } else if (a.kind === 'bath') {
      // Request E flow (mirrors the broom flow): walk to the
      // ritual spot first; the poll starts 'pray' on arrival.
      // If already at the spot, start at once.
      if (Math.hypot(controls.playerPos.x - LAYOUT.lumbiniSpot.x, controls.playerPos.z - LAYOUT.lumbiniSpot.z) < 0.45) {
        controls.bathAutoWalk = false;
        controls.pose = 'pray';
        bathState.phase = 'pray';
        bathPrevRef.current = 'pray';
        setBathPhase('pray');
      } else {
        setBathPending(true);
        controls.bathAutoWalk = true;
        controls.waypoints = [];
        controls.moveTarget = { ...LAYOUT.lumbiniSpot };
        showToast('Đang đi đến lễ đài Tắm Phật…');
      }
    } else if (a.kind === 'bell') {
      // Cooldown (5s) + ring lock (3s): no spam, no overlapping
      // animations. Sound is the old bell.mp3 (3.5s decay, as before
      // B — the 9s synth decay was too long and, with the mute check
      // + delayed AudioContext, produced no sound at all on live).
      // Bell sound plays even when background music is muted, as
      // before B: the mute button only mutes background music.
      if (bellRinging || Date.now() < bellCooldownUntil.current) return;
      bellCooldownUntil.current = Date.now() + 5000;
      setBellRingSeq((s) => s + 1);
      setBellRinging(true);
      touchFlame();
      setTimeout(() => setBellRinging(false), 3000);
      const bell = bellRef.current;
      if (bell) {
        bell.currentTime = 0;
        bell.play().then(() => { setBellPlaying(true); }).catch(() => {});
      }
    }
  };
  // Cancel a sweep mid-way: timeline stops, broom returns to
  // rest (Grounds idle branch), camera back to follow, leaves keep
  // their current positions, sweep NOT done — starting again later
  // continues from the partial state, never resets to full.
  const cancelSweep = () => {
    setSweepPending(false);
    controls.sweepAutoWalk = false;
    controls.moveTarget = null;
    controls.waypoints = [];
    sweepState.paused = false;
    setSweepPaused(false);
    sweepState.phase = 'idle';
    sweepPrevRef.current = 'idle';
    setSweepPhase('idle');
    if (controls.mode === 'sweep') controls.mode = 'follow';
  };
  // Cancel a bath mid-way: timeline stops, ladle returns to its
  // exact rest spot (Lumbini idle branch), avatar stands again.
  const cancelBath = () => {
    setBathPending(false);
    controls.bathAutoWalk = false;
    controls.moveTarget = null;
    controls.waypoints = [];
    controls.pose = 'stand';
    bathState.phase = 'idle';
    bathPrevRef.current = 'idle';
    setBathPhase('idle');
  };
  const goToZone = (zoneId: string) => {
    // Leaving the area stops a running sweep first — no
    // background animation after leaving.
    if (sweepState.phase !== 'idle') cancelSweep();
    // Same for a running bath: the ladle returns to its rest
    // spot (Lumbini resets on the transition to idle).
    if (bathState.phase !== 'idle') cancelBath();
    setMapOpen(false);
    const routes: Record<string, { target: { x: number; z: number }; via: Array<{ x: number; z: number }> }> = {
      hall: { target: LAYOUT.altarSpot, via: [{ x: -2.5, z: 0.5 }, { x: -2.5, z: -4 }, { x: 0, z: -4 }, { x: 0, z: -9 }] },
      burner: { target: LAYOUT.burnerApproach, via: [] },
      chant: { target: LAYOUT.chantApproach, via: [{ x: -2.5, z: 0.5 }, { x: -2.5, z: -4 }, { x: 0, z: -4 }] },
      pond: { target: LAYOUT.pondApproach, via: [{ x: 0, z: 10 }] },
      banyan: { target: LAYOUT.banyan, via: [{ x: 8, z: 10 }] },
      // Garden/tea routes (Request D, 2026-11-04): the old routes
      // went via the gate (13,-10) AND via corridor centre
      // (13.5,-6) — both unreachable: corridor centre x 13.5 is
      // only 0.5m from the garden wall (x 13), inside the wall's
      // expanded collider (0.58m), so northward auto-walk stalled
      // at z -4.62 and never reached the gate waypoint, and the
      // gate waypoint itself forced a westward detour across the
      // wall segment. New routes stay EAST of the wall, on the
      // corridor walkway (x 14.0, clear of the wall by 0.42m) and
      // on the new garden path stones, to the garden / tea porch.
      // Tea target is the porch (18.5,-19.5), NOT the table centre
      // (18.5,-21), which is inside the table collider and
      // unreachable — the porch is walkable, on the platform.
      // Architecture pass 2026-11-04: corridor waypoints moved to
      // x 14.4 (clear of the new corridor-chair collider by 0.22m)
      // and the garden leg follows the rerouted west-edge stones;
      // the tea leg stages at (18.0,-16.6) then goes straight
      // north up the steps to the porch.
      garden: { target: LAYOUT.garden, via: [{ x: 14.4, z: 2 }, { x: 14.4, z: -6 }, { x: 14.2, z: -8 }, { x: 14.6, z: -10 }, { x: 15.0, z: -12 }, { x: 15.2, z: -14 }, { x: 15.6, z: -15.8 }, { x: 16.2, z: -17.4 }] },
      tea: { target: { x: 18.5, z: -19.5 }, via: [{ x: 14.4, z: 2 }, { x: 14.4, z: -6 }, { x: 14.2, z: -8 }, { x: 14.6, z: -10 }, { x: 15.0, z: -12 }, { x: 15.2, z: -14 }, { x: 15.6, z: -15.8 }, { x: 16.2, z: -17.4 }, { x: 18.0, z: -16.6 }] },
      bell: { target: { x: -12, z: -5.5 }, via: [{ x: -3.5, z: 1.5 }, { x: -3.5, z: -5 }, { x: -12, z: -5 }] }, // around the pond, never through it
      // Lumbini (Request E): around the pond like the bell route,
      // then west along z -5.2 (south of the bell steps' expanded
      // edge -5.52 by 0.32m), north along x -15.5 (west of the bell
      // platform's expanded edge -15.08 by 0.42m), then straight
      // north on the yard path x -17 to the ritual spot. The
      // direct diagonal from the spawn would run head-on into
      // the pond, so it is never used.
      lumbini: { target: { ...LAYOUT.lumbiniSpot }, via: [{ x: -3.5, z: 1.5 }, { x: -3.5, z: -5 }, { x: -15.5, z: -5.2 }, { x: -15.5, z: -10 }, { x: -17, z: -14 }, { x: -17, z: -16.8 }] },
      gate: { target: { x: 0, z: 15 }, via: [] },
    };
    const r = routes[zoneId];
    if (r) {
      // Starting inside the hall (2026-11-04): the hall's only
      // exit is the doorway (x -1.7..1.7 at z -5.8) — the front
      // and side walls meet in a solid corner, so a direct
      // diagonal out wedges the player between the front wall and
      // a door post (v3 froze at (7.33,-6.46); v4's creep reached
      // the corner and stalled there). Stage out through the
      // doorway first, then follow the normal route. Hall and
      // chant targets are inside, so they keep their own staging.
      const px = controls.playerPos.x;
      const pz = controls.playerPos.z;
      const insideHall = px > -9.5 && px < 9.5 && pz > -26 && pz < -5.8;
      const via = insideHall && zoneId !== 'hall' && zoneId !== 'chant'
        ? [{ x: 0, z: -4 }, ...r.via]
        : r.via;
      goTo(r.target, via);
    }
  };
  const confirmWish = () => {
    const text = (wishChoice || wishText.trim() || 'Cầu bình an').slice(0, 200);
    savePrayer('Lời nguyện trong điện', text);
    setWishOpen(false);
    showToast('Đã lưu lời nguyện — chỉ trên thiết bị của bạn, không công khai.');
  };

  const startRitual = () => {
    setRitual('choosing');
    setPrayerChoice('Cầu bình an');
    setCustomPrayer('');
  };

  const confirmRitual = () => {
    const prayer = prayerChoice === 'Lời nguyện riêng' ? customPrayer.trim() || 'Cầu bình an' : prayerChoice;
    setRitual('offering');
    setBurnerStage('inserting');
    setInsertT(0);
    const t0 = Date.now();
    const iv = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / 1400);
      setInsertT(k);
      if (k >= 1) {
        clearInterval(iv);
        setBurnerStage('lit');
        multiplayer.sendIncense();
        const msg =
          prayerChoice === 'Lời nguyện riêng'
            ? `Nguyện cầu đến ${name}: ${prayer}.`
            : `Nguyện cầu ${prayer.toLowerCase()} đến ${name}.`;
        setPrayerMessage(msg);
        setRitual('done');
        savePrayer('Dâng hương', prayer);
        setTimeout(() => {
          setRitual('none');
          setPrayerMessage('');
        }, 5000);
      }
    }, 100);
  };

  // Fish release: no money, no points, no saved history — just a
  // gentle animation, a ripple, and a short blessing message.
  const confirmRelease = (count: number, blessing: boolean) => {
    setReleaseOpen(false);
    setSpawnCount(count);
    setSpawnTick((t) => t + 1);
    multiplayer.sendRelease();
    const msg = blessing
      ? `${name} vừa thả cá cầu bình an. Nguyện một niệm lành gửi theo làn nước.`
      : 'Bạn đã thả cá xuống hồ sen. Chúc bạn thân tâm an yên.';
    setReleaseMessage(msg);
    setTimeout(() => setReleaseMessage(''), 7000);
  };

  const makeDedication = useCallback(
    (option: typeof dedicationOption, relative: string) => {
      const base = 'Nguyện đem công đức tu tập này hồi hướng';
      if (option === 'self') return `${base} cho ${name} được bình an, thân tâm an lạc, tăng trưởng thiện lành.`;
      if (option === 'family') return `${base} cho cha mẹ và gia đình của ${name} được bình an, thân tâm an lạc, tăng trưởng thiện lành.`;
      if (option === 'relative') return `${base} cho ${relative || 'người thân'} được bình an, thân tâm an lạc, tăng trưởng thiện lành.`;
      return `${base} cho tất cả chúng sinh đều được an lạc, thoát khổ, tăng trưởng thiện lành.`;
    },
    [name],
  );

  const openDedication = () => {
    setDedicationText(makeDedication(dedicationOption, relativeName));
    setDedicationOpen(true);
  };

  useEffect(() => {
    if (dedicationOpen) setDedicationText(makeDedication(dedicationOption, relativeName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dedicationOption, relativeName]);

  const toggleSound = async () => {
    const audio = bgRef.current;
    if (!audio) return;
    try {
      if (soundPlaying) {
        audio.pause();
        setSoundPlaying(false);
        setSoundMuted(true);
        localStorage.setItem('thien-vien-sound', 'off');
      } else {
        audio.volume = 0.22;
        await audio.play();
        setSoundPlaying(true);
        setSoundMuted(false);
        setSoundBlocked(false);
        localStorage.setItem('thien-vien-sound', 'on');
      }
    } catch {
      setSoundPlaying(false);
      setSoundBlocked(true);
    }
  };

  const openMobileMenu = () => {
    // Stop any joystick movement so the character does not keep
    // walking while the menu is open.
    setKnob({ x: 0, y: 0 });
    controls.joystick = { x: 0, y: 0 };
    setMobileMenuOpen(true);
  };

  const goTo = (target: { x: number; z: number }, via: Array<{ x: number; z: number }> = []) => {
    controls.waypoints = [...via];
    controls.moveTarget = target;
    if (controls.mode === 'menu' || controls.mode === 'intro') controls.mode = 'follow';
    showToast('Đang đi đến điểm đã chọn — bạn vẫn có thể điều khiển bằng WASD.');
  };

  // Look-drag on the canvas wrapper (mouse drag + touch drag on the
  // non-joystick area). Wheel zooms the follow camera.
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).tagName !== 'CANVAS') return;
    dragRef.current = { x: e.clientX, y: e.clientY, moved: 0 };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.moved += Math.abs(dx) + Math.abs(dy);
    d.x = e.clientX;
    d.y = e.clientY;
    controls.yaw -= dx * 0.005;
    controls.pitch = Math.max(0.12, Math.min(1.0, controls.pitch - dy * 0.005));
    if (showHint) setShowHint(false);
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    controls.distance = Math.max(4, Math.min(11, controls.distance + e.deltaY * 0.005));
  };

  // Virtual joystick (mobile). Pointer capture keeps the drag alive
  // when the finger slides off the joystick circle, so the character
  // never keeps walking after release.
  const joyDown = (e: React.PointerEvent) => {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* old browsers */ }
    joyMove(e);
  };
  const joyMove = (e: React.PointerEvent) => {
    const el = joyRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    const max = 42;
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    setKnob({ x: dx, y: dy });
    controls.joystick = { x: dx / max, y: dy / max };
    if (showHint) setShowHint(false);
  };
  const joyEnd = () => {
    setKnob({ x: 0, y: 0 });
    controls.joystick = { x: 0, y: 0 };
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#e6d9b8] font-sans" style={{ height: '100dvh' }}>
      {/* 3D world */}
      <div
        className="absolute inset-0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
      >
        {!webglFailed ? (
        <WorldErrorBoundary onRetry={() => setWorldKey((k) => k + 1)} onOpenMap={() => setMapOpen(true)}>
        <World
          key={worldKey}
          name={name || 'Khách'}
          entered={entered}
          canMove={canMove}
          bellRingSeq={bellRingSeq}
          burnerStage={burnerStage}
          insertT={insertT}
          lowQuality={lowQuality}
          onZone={handleZone}
          onInteractBurner={() => {
            if (zoneRef.current === 'burner' && ritual === 'none') startRitual();
            else if (ritual === 'none') showToast('Hãy đi đến gần lư hương rồi nhấn E hoặc chạm để dâng hương.');
          }}
          onGroundClick={() => {}}
          hideOthers={hideOthers}
          remoteIncenseActive={remoteIncenseActive}
          spawnTick={spawnTick}
          spawnCount={spawnCount}
          remoteTick={remoteTick}
          onFishCount={setFishCount}
          soilWet={soilWet}
          waterStream={waterStream}
          carryingWater={carryingWater}
          festivalOn={festivalOn}
        />
        </WorldErrorBoundary>
        ) : (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#fdf8ec] p-6 text-center">
          <div className="max-w-sm">
            <p className="font-serif text-xl text-amber-900">Chế độ nhẹ — không có khung cảnh 3D.</p>
            <p className="mt-2 text-sm text-stone-600">Thiết bị này không tạo được WebGL. Bạn vẫn xem được sơ đồ, đọc bài và nghe nhạc.</p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" onClick={() => setMapOpen(true)} className="rounded-full bg-amber-800 py-3 font-medium text-white">🗺 Mở sơ đồ chùa</button>
              <button type="button" onClick={() => setReadingOpen(true)} className="rounded-full bg-stone-200 py-3 text-sm">📖 Hiên đọc</button>
              <button type="button" onClick={toggleSound} className="rounded-full bg-stone-200 py-3 text-sm">{soundPlaying ? '🔊 Tắt nhạc' : '🔇 Bật nhạc'}</button>
              <button type="button" onClick={() => setWebglFailed(false)} className="rounded-full bg-stone-200 py-3 text-sm">Thử lại 3D</button>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Loading (before the canvas reports in — the welcome card is the
          real gate, so this only shows for a moment on slow devices) */}
      {!loaded && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#fdf8ec]">
          <p className="font-serif text-xl text-amber-900">Đang mở cổng chùa…</p>
        </div>
      )}

      {/* Top bar (after entering) — desktop only, unchanged. */}
      {entered && seatedSeat?.area !== 'lake' && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 hidden items-start justify-between gap-2 p-3 md:flex">
          <div className="rounded-2xl border border-white/50 bg-white/70 px-4 py-2 shadow backdrop-blur">
            <h1 className="font-serif text-lg font-semibold leading-tight text-amber-900">Chùa Hải An</h1>
            <p className="text-[11px] text-stone-500">Đi dạo · Dâng hương · Niệm Phật</p>
          </div>
          <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setSettingsOpen(true)} className="rounded-full border border-white/50 bg-white/70 px-3 py-2 text-sm shadow backdrop-blur">👤 {name}</button>
            <button type="button" onClick={() => setBookOpen(true)} className="rounded-full border border-white/50 bg-white/70 px-3 py-2 text-sm shadow backdrop-blur">📖 Sổ cầu an</button>
            <button type="button" onClick={() => setHelpOpen(true)} className="rounded-full border border-white/50 bg-white/70 px-3 py-2 text-sm shadow backdrop-blur">❓ Hướng dẫn</button>
            <button
              type="button"
              onClick={toggleSound}
              className="rounded-full border border-white/50 bg-white/70 px-3 py-2 text-sm shadow backdrop-blur"
              aria-label={soundPlaying ? 'Tắt âm thanh' : 'Bật âm thanh'}
            >
              {soundPlaying ? '🔊 Tắt âm thanh' : soundBlocked ? '🔇 Bật nhạc' : '🔇 Bật âm thanh'}
            </button>
            <button type="button" onClick={() => setMapOpen(true)} className="rounded-full border border-white/50 bg-white/70 px-3 py-2 text-sm shadow backdrop-blur">🗺 Sơ đồ chùa</button>
            <button type="button" onClick={() => setSettingsOpen(true)} className="rounded-full border border-white/50 bg-white/70 px-3 py-2 text-sm shadow backdrop-blur">
              {soloMode ? '🧘 Chế độ riêng' : mpStatus === 'online' ? `👥 Phòng chung - ${mpCount}` : mpStatus === 'connecting' ? '👥 Đang kết nối…' : wsUrl ? '👥 Ngoại tuyến (solo)' : '🧘 Chế độ riêng'}
            </button>
            <button type="button" onClick={() => {
              const next = !hideOthers;
              setHideOthers(next);
              localStorage.setItem('thien-vien-hide-others', next ? '1' : '0');
            }} className="rounded-full border border-white/50 bg-white/70 px-3 py-2 text-sm shadow backdrop-blur">
              {hideOthers ? '👥 Hiện người khác' : '🙈 Ẩn người khác'}
            </button>
            <button type="button" onClick={() => setSettingsOpen(true)} className="rounded-full border border-white/50 bg-white/70 px-3 py-2 text-sm shadow backdrop-blur">⚙ Cài đặt</button>
            <button type="button" onClick={() => showToast(flameNote(flame))} title={flameNote(flame)} className="rounded-full border border-white/50 bg-white/70 px-3 py-2 text-sm shadow backdrop-blur">{flameLabel(flame)}</button>
          </div>
        </div>
      )}

      {/* Mobile header — one compact row, never the wide desktop title.
          The title itself is pointer-events-none, so dragging on it
          still rotates the camera; only the two buttons take touches. */}
      {entered && seatedSeat?.area !== 'lake' && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-3 pb-2 md:hidden"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}
        >
          <div className="min-w-0 rounded-2xl border border-white/50 bg-white/70 px-3 py-1.5 shadow backdrop-blur">
            <h1 className="whitespace-nowrap font-serif text-base font-semibold leading-tight text-amber-900">Chùa Hải An</h1>
            <p className="whitespace-nowrap text-[10px] leading-tight text-stone-500">Không gian bình an</p>
          </div>
          <div className="pointer-events-auto flex shrink-0 gap-2">
            <button
              type="button"
              onClick={toggleSound}
              aria-label={soundPlaying ? 'Tắt âm thanh' : 'Bật âm thanh'}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-white/70 text-base shadow backdrop-blur"
            >
              {soundPlaying ? '🔊' : '🔇'}
            </button>
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              aria-label="Mở sơ đồ chùa"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-white/70 text-base shadow backdrop-blur"
            >
              🗺
            </button>
            <button
              type="button"
              onClick={openMobileMenu}
              aria-label="Mở menu"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-white/70 text-lg shadow backdrop-blur"
            >
              ☰
            </button>
            <button
              type="button"
              onClick={() => showToast(flameNote(flame))}
              title={flameNote(flame)}
              className="flex h-10 items-center justify-center rounded-full border border-white/50 bg-white/70 px-3 text-base shadow backdrop-blur"
            >
              {flameLabel(flame)}
            </button>
          </div>
        </div>
      )}

      {/* Mobile menu — bottom sheet, rendered only while open, so when
          it is closed there is no invisible layer over the canvas or
          the joystick. Tapping the backdrop closes it. */}
      {entered && mobileMenuOpen && (
        <div className="absolute inset-0 z-40 md:hidden" role="dialog" aria-label="Menu">
          {/* Backdrop is a plain div, not a second "close" button: tapping
              the area outside the sheet closes the menu, and there is
              exactly one labelled close button (✕) for assistive tech. */}
          <div onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 h-full w-full bg-black/40" />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[75dvh] overflow-y-auto rounded-t-3xl bg-[#fdf8ec] px-4 pt-3 shadow-2xl"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-serif text-base font-semibold text-amber-900">Menu</p>
              <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Đóng menu" className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-200 text-base">✕</button>
            </div>
            <p className="mb-2 text-xs text-stone-500">
              {soloMode ? '🧘 Chế độ riêng' : mpStatus === 'online' ? `👥 Phòng chung - ${mpCount}` : mpStatus === 'connecting' ? '👥 Đang kết nối…' : '👥 Ngoại tuyến (solo)'}
            </p>
            <div className="flex flex-col gap-1.5 pb-1">
              <button type="button" onClick={() => { setMobileMenuOpen(false); setMapOpen(true); }} className="rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm">🗺 Sơ đồ chùa</button>
              <button type="button" onClick={() => { setMobileMenuOpen(false); setSettingsOpen(true); }} className="rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm">👤 {name} — Đổi tên</button>
              <button type="button" onClick={() => { setMobileMenuOpen(false); setBookOpen(true); }} className="rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm">📖 Sổ cầu an</button>
              <button type="button" onClick={() => { setMobileMenuOpen(false); setHelpOpen(true); }} className="rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm">❓ Hướng dẫn</button>
              <button type="button" onClick={() => { setMobileMenuOpen(false); goTo(LAYOUT.burnerApproach); }} className="rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm">🪔 Đến lư hương</button>
              <button type="button" onClick={() => { setMobileMenuOpen(false); goTo(LAYOUT.chantApproach); }} className="rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm">📿 Đến khu niệm Phật</button>
              <button type="button" onClick={() => { setMobileMenuOpen(false); goTo(LAYOUT.pondApproach, [{ x: 0, z: 10 }]); }} className="rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm">🪷 Đến hồ sen</button>
              <button type="button" onClick={() => { setMobileMenuOpen(false); goTo(LAYOUT.altarSpot, [{ x: -2.5, z: 0.5 }, { x: -2.5, z: -4 }, { x: 0, z: -4 }, { x: 0, z: -7 }]); }} className="rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm">🏯 Vào chính điện hành lễ</button>
              <button type="button" onClick={toggleSound} className="rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm">{soundPlaying ? '🔊 Tắt âm thanh' : '🔇 Bật âm thanh'}</button>
              <button type="button" onClick={() => {
                const next = !soloMode;
                setSoloMode(next);
                setSolo(next);
                if (next) { multiplayer.disconnect(); setMpStatus('offline'); }
                else connectMultiplayer(wsUrl, name);
              }} className="rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm">{soloMode ? '👥 Bật phòng chung' : '🧘 Bật chế độ riêng'}</button>
              <button type="button" onClick={() => {
                const next = !hideOthers;
                setHideOthers(next);
                localStorage.setItem('thien-vien-hide-others', next ? '1' : '0');
              }} className="rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm">{hideOthers ? '👥 Hiện người khác' : '🙈 Ẩn người khác'}</button>
              <button type="button" onClick={() => { setMobileMenuOpen(false); setSettingsOpen(true); }} className="rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm">⚙ Cài đặt</button>
            </div>
          </div>
        </div>
      )}

      {/* Hint — below the header on mobile, same place as desktop on md+. */}
      {entered && showHint && (
        <div className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 top-[calc(env(safe-area-inset-top)+64px)] md:top-20">
          <p className="max-w-[calc(100vw-2rem)] rounded-full bg-black/55 px-4 py-2 text-center text-xs text-amber-50 sm:text-sm">
            WASD để di chuyển · Kéo chuột để quan sát · E để tương tác · Chạm vào mặt đất để tự đi đến đó
          </p>
        </div>
      )}

      {/* Interaction prompt — desktop: centred above the bottom row (unchanged).
          Mobile: bottom-right, opposite the joystick, at joystick height, so
          it never sits on top of the joystick or the centre of the scene. */}
      {entered && ritual === 'none' && !chantOpen && !releaseOpen && hallRitual === 'none' && zone !== 'none' && (
        <>
          <div className="absolute bottom-28 left-1/2 z-20 hidden -translate-x-1/2 sm:bottom-24 md:block">
            {zone === 'altar' ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => startHallRitual('kneel')} className="rounded-full bg-amber-800 px-5 py-3 text-sm font-medium text-white shadow-xl">🧎 Quỳ lễ</button>
                <button type="button" onClick={() => startHallRitual('sit')} className="rounded-full bg-amber-800 px-5 py-3 text-sm font-medium text-white shadow-xl">🧘 Ngồi tĩnh tâm</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => (zone === 'burner' ? startRitual() : zone === 'pond' ? setReleaseOpen(true) : setChantOpen(true))}
                className="rounded-full bg-amber-800 px-5 py-3 text-sm font-medium text-white shadow-xl"
              >
                {zone === 'burner' ? '🪔 Nhấn E hoặc chạm để dâng hương' : zone === 'pond' ? '🪷 Nhấn E để phóng sinh' : '📿 Nhấn E để niệm Phật'}
              </button>
            )}
          </div>
          <div
            className="absolute right-3 z-20 flex flex-col items-end gap-2 md:hidden"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
          >
            {zone === 'altar' ? (
              <>
                <button type="button" onClick={() => startHallRitual('kneel')} className="max-w-[42vw] rounded-full bg-amber-800 px-4 py-3 text-center text-sm font-medium text-white shadow-xl">🧎 Quỳ lễ</button>
                <button type="button" onClick={() => startHallRitual('sit')} className="max-w-[42vw] rounded-full bg-amber-800 px-4 py-3 text-center text-sm font-medium text-white shadow-xl">🧘 Ngồi tĩnh tâm</button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => (zone === 'burner' ? startRitual() : zone === 'pond' ? setReleaseOpen(true) : setChantOpen(true))}
                className="max-w-[42vw] rounded-full bg-amber-800 px-4 py-3 text-center text-sm font-medium text-white shadow-xl"
              >
                {zone === 'burner' ? '🪔 Dâng hương' : zone === 'pond' ? '🪷 Phóng sinh' : '📿 Niệm Phật'}
              </button>
            )}
          </div>
        </>
      )}

      {/* While kneeling/sitting in the hall: reopen the wish, or stand up.
          Desktop: centred bottom. Mobile: bottom-right, opposite the
          joystick, so it never covers it. */}
      {entered && hallRitual !== 'none' && (
        <>
          <div className="absolute bottom-28 left-1/2 z-20 hidden -translate-x-1/2 gap-2 sm:bottom-24 md:flex">
            <button type="button" onClick={() => setWishOpen(true)} className="rounded-full bg-amber-800 px-5 py-3 text-sm font-medium text-white shadow-xl">✍️ Nhập lời nguyện</button>
            <button type="button" onClick={standUp} className="rounded-full bg-white/85 px-5 py-3 text-sm font-medium text-amber-900 shadow-xl">Đứng dậy</button>
          </div>
          <div className="absolute right-3 z-20 flex flex-col items-end gap-2 md:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <button type="button" onClick={() => setWishOpen(true)} className="max-w-[42vw] rounded-full bg-amber-800 px-4 py-3 text-center text-sm font-medium text-white shadow-xl">✍️ Lời nguyện</button>
            <button type="button" onClick={standUp} className="max-w-[42vw] rounded-full bg-white/85 px-4 py-3 text-center text-sm font-medium text-amber-900 shadow-xl">Đứng dậy</button>
          </div>
        </>
      )}

      {/* Single map button (desktop) — the old four floating
          quick-go buttons are removed; quick destinations live
          in the map and in the menu. */}
      {entered && ritual === 'none' && !chantOpen && (
        <div className="absolute bottom-24 left-3 z-20 hidden sm:bottom-20 md:block">
          <button type="button" onClick={() => setMapOpen(true)} className="rounded-full bg-white/80 px-4 py-2.5 text-sm shadow backdrop-blur">🗺 Sơ đồ chùa</button>
        </div>
      )}


      {/* Minimised chant bar (listening while walking, panel closed) —
          desktop: bottom-right (unchanged). Mobile: just under the header,
          so it never collides with the joystick or the action button. */}
      {entered && chantPlaying && !chantOpen && (
        <div className="absolute right-3 z-20 top-[calc(env(safe-area-inset-top)+64px)] md:top-auto md:bottom-24">
          <button type="button" onClick={() => setChantOpen(true)} className="rounded-full bg-amber-800 px-4 py-2 text-xs text-white shadow">
            🎵 Đang niệm Phật — chạm để mở bảng
          </button>
        </div>
      )}

      {/* Toast — below the header on mobile, same place as desktop on md+. */}
      {toast && (
        <div className="pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 top-[calc(env(safe-area-inset-top)+64px)] md:top-32">
          <p className="max-w-[calc(100vw-2rem)] rounded-full bg-black/60 px-4 py-2 text-center text-sm text-amber-50">{toast}</p>
        </div>
      )}

      {/* Joystick (touch screens) — bottom-left, inside the safe area,
          100px so it never reaches the right-side action button, and
          nothing else is placed above it on mobile any more. */}
      {entered && seatedSeat?.area !== 'lake' && (
        <div
          className="absolute left-4 z-20 md:hidden"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
        >
          <div
            ref={joyRef}
            className="relative h-[100px] w-[100px] touch-none rounded-full border border-white/60 bg-white/30 backdrop-blur"
            onPointerDown={joyDown}
            onPointerMove={joyMove}
            onPointerUp={joyEnd}
            onPointerCancel={joyEnd}
          >
            <div
              className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-white/90 shadow"
              style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
            />
          </div>
          <p className="mt-1 text-center text-[11px] text-white drop-shadow">Di chuyển</p>
        </div>
      )}

      {/* Welcome screen — scrolls inside itself when the on-screen
          keyboard shrinks the viewport, instead of being pushed off-screen. */}
      {!entered && loaded && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/35 p-4">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-amber-900/20 bg-[#fdf8ec]/95 p-6 text-center shadow-2xl">
            <p className="text-4xl">🪷</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold leading-snug text-amber-900">Chào mừng bạn đến<br />Chùa Hải An</h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              Một ngôi chùa nhỏ giữa thiên nhiên — đi dạo trong sân, dâng một nén hương,
              ngồi niệm Phật và hồi hướng cho những người bạn thương.
            </p>
            <label className="mt-5 block text-left text-sm font-medium text-stone-700" htmlFor="visitor-name">
              Tên của bạn
            </label>
            <input
              id="visitor-name"
              type="text"
              value={nameInput}
              maxLength={30}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') enterTemple();
              }}
              placeholder="Ví dụ: Nguyễn Văn A (để trống sẽ là tên Khách)"
              className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base outline-none focus:border-amber-700"
              autoFocus
            />
            <button
              type="button"
              onClick={enterTemple}
              className="mt-4 w-full rounded-full bg-amber-800 py-3.5 text-base font-medium text-white shadow hover:bg-amber-900"
            >
              Bước vào chùa
            </button>
            <p className="mt-2 text-xs text-amber-800">Khi vào chùa, bạn sẽ nghe nhạc tĩnh tâm. Có thể tắt bằng nút loa.</p>
            <p className="mt-3 text-xs text-stone-500">
              Tên chỉ lưu trên thiết bị của bạn (localStorage), không cần tài khoản và không tự động công khai.
              Khi phòng chung được bật, người khác chỉ thấy tên và nhân vật của bạn đi lại trong chùa — không thấy lời nguyện riêng.
            </p>
          </div>
        </div>
      )}

      {/* Incense ritual */}
      {ritual === 'choosing' && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/25 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-amber-900/20 bg-[#fdf8ec] p-5 shadow-2xl">
            <h2 className="font-serif text-xl font-semibold text-amber-900">Dâng hương</h2>
            <p className="mt-1 text-sm text-stone-600">Chọn một lời nguyện, rồi xác nhận để cắm ba nén hương vào lư.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {['Cầu bình an', 'Cầu sức khỏe', 'Cầu may mắn', 'Lời nguyện riêng'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPrayerChoice(c)}
                  className={`rounded-xl px-3 py-2.5 text-sm ${prayerChoice === c ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-900'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            {prayerChoice === 'Lời nguyện riêng' && (
              <input
                type="text"
                value={customPrayer}
                maxLength={120}
                onChange={(e) => setCustomPrayer(e.target.value)}
                placeholder="Viết lời nguyện riêng của bạn…"
                className="mt-3 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm"
              />
            )}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={confirmRitual} className="flex-1 rounded-full bg-amber-800 py-3 font-medium text-white">Dâng hương</button>
              <button type="button" onClick={() => setRitual('none')} className="rounded-full bg-stone-200 px-5 py-3">Hủy</button>
            </div>
          </div>
        </div>
      )}
      {ritual === 'offering' && (
        <div className="pointer-events-none absolute bottom-32 left-1/2 z-30 -translate-x-1/2">
          <p className="rounded-full bg-black/60 px-4 py-2 text-sm text-amber-50">Đang cắm hương vào lư…</p>
        </div>
      )}
      {ritual === 'done' && prayerMessage && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2 px-4 text-center">
          <p className="rounded-3xl bg-[#fdf8ec]/95 px-6 py-4 font-serif text-lg text-amber-900 shadow-2xl">{prayerMessage}</p>
        </div>
      )}

      {/* Fish release panel — same visual language as the incense
          panel: cream card, amber primary, rounded, no points, no money. */}
      {releaseOpen && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/25 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-amber-900/20 bg-[#fdf8ec] p-5 shadow-2xl">
            <h2 className="font-serif text-xl font-semibold text-amber-900">Phóng sinh</h2>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              Thả cá chép xuống hồ sen, gửi một niệm lành theo làn nước.
              Cá chỉ bơi trong hồ này, không lưu lại, không tính điểm.
            </p>
            <p className="mt-2 text-xs text-stone-500">Trải nghiệm mô phỏng — cá chỉ bơi trong hồ này, hồ chứa tối đa 18 con.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[1, 3, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => confirmRelease(n, false)}
                  className="rounded-xl bg-amber-100 px-3 py-3 text-sm font-medium text-amber-900"
                >
                  Thả {n} con
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => confirmRelease(3, true)}
              className="mt-3 w-full rounded-full bg-amber-800 py-3 font-medium text-white"
            >
              🪷 Thả cá cầu bình an
            </button>
            <button
              type="button"
              onClick={() => setReleaseOpen(false)}
              className="mt-2 w-full rounded-full bg-stone-200 py-3 text-sm"
            >
              Để sau
            </button>
          </div>
        </div>
      )}
      {releaseMessage && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2 px-4 text-center">
          <p className="rounded-3xl bg-[#fdf8ec]/95 px-6 py-4 font-serif text-lg text-amber-900 shadow-2xl">{releaseMessage}</p>
        </div>
      )}

      {/* Hall wish panel — same cream/amber language as the incense
          panel. Private by design: saved only to this device's prayer
          book, never sent to multiplayer, never read aloud. */}
      {wishOpen && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/25 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-amber-900/20 bg-[#fdf8ec] p-5 shadow-2xl">
            <h2 className="font-serif text-xl font-semibold text-amber-900">Tĩnh tâm và cầu nguyện</h2>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              Trước tượng Phật Bà Quan Âm, bạn có thể gửi gắm một điều mong cầu.
              Lời này chỉ lưu trên thiết bị của bạn, không công khai với người khác.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Cầu bình an', 'Cầu sức khỏe', 'Cầu cho gia đình', 'Cầu học tập / công việc thuận lợi'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setWishChoice(c); setWishText(c); }}
                  className={`rounded-full px-3 py-2 text-xs ${wishChoice === c ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-900'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm font-medium text-stone-700" htmlFor="wish-text">Điều con muốn gửi gắm</label>
            <textarea
              id="wish-text"
              value={wishText}
              maxLength={200}
              rows={3}
              onChange={(e) => { setWishText(e.target.value); setWishChoice(''); }}
              placeholder="Viết lời nguyện của bạn… (không bắt buộc chọn gợi ý)"
              className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-700"
            />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={confirmWish} className="flex-1 rounded-full bg-amber-800 py-3 font-medium text-white">Xác nhận</button>
              <button type="button" onClick={() => setWishOpen(false)} className="rounded-full bg-stone-200 px-5 py-3">Đóng</button>
              <button type="button" onClick={standUp} className="rounded-full bg-white px-5 py-3 ring-1 ring-amber-800/40 text-amber-900">Đứng dậy</button>
            </div>
            <p className="mt-3 text-center text-xs text-stone-500">Bạn vẫn đang {hallRitual === 'kneel' ? 'quỳ' : 'ngồi'} trước tượng — đóng panel này vẫn giữ tư thế, bấm “Đứng dậy” để kết thúc.</p>
          </div>
        </div>
      )}

      {/* Chanting panel */}
      <ChantPanel
        muted={soundMuted}
        open={chantOpen}
        onClose={() => setChantOpen(false)}
        onPlayback={(playing, mode) => {
          setChantPlaying(playing);
          setChantMode(mode);
        }}
        onFinish={(item) => {
          setFinishedChant(item);
        }}
        onDedicate={openDedication}
      />

      {/* After-chant dedication prompt */}
      {finishedChant && !dedicationOpen && (
        <div className="absolute bottom-28 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-3xl bg-[#fdf8ec] p-4 text-center shadow-2xl">
          <p className="font-serif text-lg text-amber-900">Nguyện bạn và gia đình luôn được bình an.</p>
          <p className="mt-1 text-sm text-stone-600">Bạn có muốn hồi hướng công đức niệm Phật “{finishedChant.name}” không?</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={openDedication} className="flex-1 rounded-full bg-amber-800 py-2.5 text-sm font-medium text-white">Hồi hướng</button>
            <button type="button" onClick={() => setFinishedChant(null)} className="rounded-full bg-stone-200 px-4 py-2.5 text-sm">Để sau</button>
          </div>
        </div>
      )}

      {/* Dedication */}
      {dedicationOpen && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-[#fdf8ec] p-5 shadow-2xl">
            <h2 className="font-serif text-xl font-semibold text-amber-900">Hồi hướng</h2>
            <p className="mt-1 text-xs text-stone-500">Lời dưới đây là lời nguyện tham khảo do ứng dụng tạo ra, không phải nguyên văn kinh Phật. Tên và lời nguyện không tự động công khai hay đọc thành tiếng.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([
                ['self', 'Cho bản thân'],
                ['family', 'Cho cha mẹ và gia đình'],
                ['relative', 'Cho một người thân'],
                ['all', 'Cho tất cả chúng sinh'],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDedicationOption(k)}
                  className={`rounded-xl px-3 py-2 text-sm ${dedicationOption === k ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-900'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {dedicationOption === 'relative' && (
              <input
                type="text"
                value={relativeName}
                maxLength={40}
                onChange={(e) => setRelativeName(e.target.value)}
                placeholder="Tên người thân…"
                className="mt-3 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm"
              />
            )}
            <textarea
              value={dedicationText}
              onChange={(e) => setDedicationText(e.target.value)}
              rows={4}
              className="mt-3 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  savePrayer('Hồi hướng', dedicationText);
                  setDedicationOpen(false);
                  setFinishedChant(null);
                  showToast('Đã lưu lời hồi hướng — chỉ trên thiết bị của bạn.');
                }}
                className="flex-1 rounded-full bg-amber-800 py-3 font-medium text-white"
              >
                Lưu lời hồi hướng
              </button>
              <button type="button" onClick={() => { setDedicationOpen(false); setFinishedChant(null); }} className="rounded-full bg-stone-200 px-5 py-3">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Prayer book */}
      {bookOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-3xl bg-[#fdf8ec] p-5 shadow-2xl">
            <div className="flex justify-between">
              <h2 className="font-serif text-xl font-semibold text-amber-900">Sổ cầu an của bạn</h2>
              <button type="button" onClick={() => setBookOpen(false)} className="rounded-full bg-stone-200 px-3 py-1 text-sm">✕</button>
            </div>
            <p className="mt-1 text-xs text-stone-500">Chỉ lưu trên thiết bị này, không đăng nhập, không công khai.</p>
            {prayers.length === 0 ? (
              <p className="mt-4 text-sm text-stone-600">Chưa có lời nguyện nào. Hãy dâng hương hoặc hồi hướng sau khi niệm Phật.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {[...prayers].reverse().map((p, i) => (
                  <li key={i} className="rounded-xl border border-stone-200 bg-white p-3 text-sm">
                    <span className="font-medium text-amber-800">{p.type}</span>
                    <span className="text-stone-400"> · {p.date}</span>
                    <p className="mt-1 text-stone-700">{p.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Help */}
      {helpOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-[#fdf8ec] p-5 shadow-2xl">
            <div className="flex justify-between">
              <h2 className="font-serif text-xl font-semibold text-amber-900">Hướng dẫn di chuyển</h2>
              <button type="button" onClick={() => setHelpOpen(false)} className="rounded-full bg-stone-200 px-3 py-1 text-sm">✕</button>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-stone-700">
              <li><strong>Máy tính:</strong> W/A/S/D hoặc phím mũi tên để đi, kéo chuột để xoay góc nhìn, cuộn chuột để zoom, E để tương tác, chạm vào mặt đất để tự đi đến đó.</li>
              <li><strong>Điện thoại:</strong> joystick góc trái dưới để đi, vuốt phần còn lại của màn hình để xoay góc nhìn, các nút tương tác đủ lớn để chạm.</li>
              <li>Bạn bắt đầu trước cổng tam quan, đi qua cổng vào sân, đến lư hương trước chính điện, hoặc vào chính điện niệm Phật trước tượng Quan Âm. Chính điện mở cửa giữa: đi thẳng qua cửa vào trong, đến trước tượng Phật Bà Quan Âm nghìn mắt nghìn tay, rồi chọn Quỳ lễ hoặc Ngồi tĩnh tâm để nhập lời nguyện.</li>
              <li>Không thể đi xuyên qua cột, tường, lư hương hay hồ sen — nhân vật sẽ trượt dọc theo vật cản.</li>
              <li><strong>Phòng chung:</strong> khi phòng chung được bật, bạn sẽ thấy người khác cùng đi chùa trong cùng một phòng (tối đa 15 người/phòng, phòng đầy sẽ tự chuyển sang phòng khác). Số người và tên phòng hiện ở góc trên. Bạn có thể ẩn người khác hoặc bật chế độ riêng trong Cài đặt. Nếu mất mạng, bạn vẫn đi chùa bình thường một mình.</li>
              <li>Lư hương luôn cố định — dâng hương của người khác chỉ hiện thêm một làn khói ngắn ở lư, không làm lư xoay hay thêm vô hạn que hương.</li>
              <li><strong>Nguồn âm thanh:</strong> nhạc nền đang phát là đoạn trích 5 phút (phút 10:00–15:00) từ bài “02 Nhac Thien Dan Tranh (Meditation Music) [60 min]” trong album Nhạc Thiền 1, trang <a className="underline" href="https://ph.tinhtong.vn/Home/MP3?p=MP3+Nhac*07+Nhac+Thien*Nhac+Thien+1&shem=aimgspe," target="_blank" rel="noreferrer">ph.tinhtong.vn — Nhạc Thiền 1</a>. Bài gốc dài 61 phút 20 giây, chỉ lấy 5 phút ở giữa để phát lặp, gắn fade-in 3 giây đầu và fade-out 3 giây cuối, mã hóa lại 128 kbps, không cắt nội dung khác. Trang nguồn không ghi rõ giấy phép; đây là nhạc Phật giáo chia sẻ trên trang Tịnh Tông, chùa dùng phi thương mại (không thu phí, không quảng cáo). Các bản trước (Tibetan Bowls, Kevin MacLeod) vẫn còn trong dự án nếu bạn muốn đổi lại.</li>
              <li><strong>Vườn Lâm Tỳ Ni – Tắm Phật:</strong> sau gác chuông, phía trái chính điện — đi theo đường lát đá từ gác chuông về phía bắc. Tới gần bồn nước, bấm “Tắm Phật” để thực hiện nghi thức mô phỏng (chắp tay, múc nước, ba gáo rưới, hồi hướng, khoảng 24 giây) hoặc “Tìm hiểu Phật đản” để đọc ý nghĩa và bật chế độ lễ hội. Đài sen trong bồn hiện để trống, chờ tượng Thái tử sơ sinh được cấp phép — chưa có tượng tạm nào đặt ở đó.</li>
              <li><strong>Nguồn tượng (hai ban phụ, bản xem trước):</strong> ban Tây là tượng quét 3D “1986.7 Shakyamuni” của Cleveland Museum of Art, tượng gỗ sơn mài Nhật Bản thời Heian (khoảng năm 900), phạm vi công cộng CC0, đã giảm kích thước texture và chỉnh tông ấm, xem tại <a className="underline" href="https://sketchfab.com/3d-models/19867-shakyamuni-e8b473c60f3c417c86dc07a02b0de289" target="_blank" rel="noreferrer">Sketchfab — 1986.7 Shakyamuni</a>. Ban Đông là tượng “Ksitigarbha Bodhisattva - Statue” của Truong Kieu Van, giấy phép CC BY 4.0, đã bỏ đế đá và giảm đa giác, xem tại <a className="underline" href="https://sketchfab.com/3d-models/ksitigarbha-bodhisattva-statue-86ac52263ea74a16ac2bf8900dcd8456" target="_blank" rel="noreferrer">Sketchfab — Ksitigarbha Bodhisattva</a>. Cả hai đều là bản xem trước đặt trên bệ riêng trong chính điện, chưa phải tượng đúc cuối cùng; tượng Địa Tạng trong bản này đứng chứ không ngồi như ảnh mẫu.</li>
            </ul>
            <button type="button" onClick={() => setHelpOpen(false)} className="mt-4 w-full rounded-full bg-amber-800 py-3 font-medium text-white">Đã hiểu</button>
          </div>
        </div>
      )}

      {/* Settings */}
      {settingsOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-[#fdf8ec] p-5 shadow-2xl">
            <div className="flex justify-between">
              <h2 className="font-serif text-xl font-semibold text-amber-900">Cài đặt</h2>
              <button type="button" onClick={() => setSettingsOpen(false)} className="rounded-full bg-stone-200 px-3 py-1 text-sm">✕</button>
            </div>
            <label className="mt-4 block text-sm font-medium text-stone-700" htmlFor="settings-name">Tên hiển thị trên nhân vật</label>
            <input
              id="settings-name"
              type="text"
              value={settingsName}
              maxLength={30}
              onChange={(e) => setSettingsName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                const clean = settingsName.trim().slice(0, 30);
                if (!clean) return;
                setName(clean);
                localStorage.setItem(NAME_KEY, clean);
                multiplayer.updateName(clean);
                showToast('Đã đổi tên thành ' + clean + '.');
                setSettingsOpen(false);
              }}
              className="mt-3 w-full rounded-full bg-amber-800 py-3 font-medium text-white"
            >
              Lưu tên
            </button>
            <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-3">
              <h3 className="font-medium text-amber-900">Phòng chung (multiplayer)</h3>
              <p className="mt-1 text-xs text-stone-500">
                {soloMode ? 'Đang ở chế độ riêng: bạn không tham gia phòng realtime.' : mpStatus === 'online' ? `Đang online trong phòng ${mpRoom || 'chung'} — ${mpCount} người.` : wsUrl ? 'Chưa kết nối được phòng chung, bạn vẫn đi chùa bình thường ở chế độ riêng.' : 'Chưa có địa chỉ phòng chung: nhập địa chỉ Worker WebSocket bên dưới để vào phòng chung, hoặc để trống để đi một mình.'}
                Tổng số online toàn hệ thống không hiện, vì không có bộ đếm trung tâm đáng tin cậy — chỉ số người trong đúng phòng của bạn mới được hiển thị, không bịa thêm.
              </p>
              <label className="mt-3 block text-xs font-medium text-stone-700" htmlFor="ws-url">Địa chỉ phòng chung (WebSocket, bắt đầu bằng wss://)</label>
              <input
                id="ws-url"
                type="text"
                value={wsUrlInput}
                onChange={(e) => setWsUrlInput(e.target.value)}
                placeholder="wss://chua-online-temple.<tên-miền>.workers.dev/ws"
                className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
              />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => {
                  const url = wsUrlInput.trim();
                  setWsUrl(url);
                  setStoredWsUrl(url);
                  if (!soloMode) connectMultiplayer(url, name);
                  showToast(url ? 'Đã lưu địa chỉ phòng chung, đang kết nối…' : 'Đã xóa địa chỉ phòng chung, đang ở chế độ riêng.');
                }} className="flex-1 rounded-full bg-amber-800 py-2 text-xs font-medium text-white">Lưu và kết nối</button>
                <button type="button" onClick={() => {
                  const next = !soloMode;
                  setSoloMode(next);
                  setSolo(next);
                  if (next) { multiplayer.disconnect(); setMpStatus('offline'); }
                  else connectMultiplayer(wsUrl, name);
                }} className="rounded-full bg-stone-200 px-4 py-2 text-xs">
                  {soloMode ? 'Bật phòng chung' : 'Chế độ riêng'}
                </button>
              </div>
              <label className="mt-3 flex items-center justify-between text-xs text-stone-700">
                Ẩn người khác (vẫn kết nối, chỉ không hiển thị họ)
                <input type="checkbox" checked={hideOthers} onChange={(e) => {
                  setHideOthers(e.target.checked);
                  localStorage.setItem('thien-vien-hide-others', e.target.checked ? '1' : '0');
                }} className="h-4 w-4 accent-amber-800" />
              </label>
            </div>
            <label className="mt-4 flex items-center justify-between text-sm text-stone-700">
              Chế độ nhẹ cho máy yếu (giảm bóng đổ, giảm độ phân giải)
              <input type="checkbox" checked={lowQuality} onChange={(e) => setLowQuality(e.target.checked)} className="h-5 w-5 accent-amber-800" />
            </label>
            <p className="mt-3 text-xs text-stone-500">Tên và lời nguyện chỉ lưu trên thiết bị này. Nhạc nền tự phát khi vào chùa; tắt bằng nút loa, lựa chọn được nhớ cho lần sau.</p>
          </div>
        </div>
      )}


      {/* Context action: at most one, nearest object, stable prompt.
          Shows only when no existing zone prompt is active. */}
      {entered && zone === 'none' && !seatedSeat && !sitPending && hallRitual === 'none' && ritual === 'none' && !chantOpen && !releaseOpen && !mapOpen && ctxAction && (
        <>
          <div className="absolute bottom-28 left-1/2 z-20 hidden -translate-x-1/2 sm:bottom-24 md:block">
            {ctxAction.kind === 'bath' ? (
              <div className="flex gap-2">
                <button type="button" onClick={doCtxAction} className="rounded-full bg-amber-800 px-5 py-3 text-sm font-medium text-white shadow-xl">🪷 Tắm Phật</button>
                <button type="button" onClick={() => setVesakOpen(true)} className="rounded-full bg-white/85 px-5 py-3 text-sm font-medium text-amber-900 shadow-xl">📖 Tìm hiểu Phật đản</button>
              </div>
            ) : (
              <button type="button" onClick={doCtxAction} className="rounded-full bg-amber-800 px-5 py-3 text-sm font-medium text-white shadow-xl">
                {ctxAction.kind === 'seat' ? '🪑 ' : ctxAction.kind === 'broom' ? '🧹 ' : ctxAction.kind === 'jar' ? '🪣 ' : ctxAction.kind === 'bed' ? '💧 ' : ctxAction.kind === 'bell' ? '🔔 ' : '📖 '}
                {ctxAction.label}
              </button>
            )}
          </div>
          <div className="absolute right-3 z-20 flex flex-col items-end gap-2 md:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            {ctxAction.kind === 'bath' ? (
              <>
                <button type="button" onClick={doCtxAction} className="max-w-[42vw] rounded-full bg-amber-800 px-4 py-3 text-center text-sm font-medium text-white shadow-xl">🪷 Tắm Phật</button>
                <button type="button" onClick={() => setVesakOpen(true)} className="max-w-[42vw] rounded-full bg-white/85 px-4 py-3 text-center text-sm font-medium text-amber-900 shadow-xl">📖 Tìm hiểu Phật đản</button>
              </>
            ) : (
              <button type="button" onClick={doCtxAction} className="max-w-[42vw] rounded-full bg-amber-800 px-4 py-3 text-center text-sm font-medium text-white shadow-xl">
                {ctxAction.label}
              </button>
            )}
          </div>
        </>
      )}

      {/* Seated on a usable seat: stand up, walk back to the aisle/path. */}
      {entered && seatedSeat && (
        <>
          <div className="absolute bottom-28 left-1/2 z-20 hidden -translate-x-1/2 gap-2 sm:bottom-24 md:flex">
            <span className="rounded-full bg-black/55 px-4 py-3 text-sm text-amber-50">{seatedSeat.area === 'lake' ? 'Đang ngắm hồ — giao diện đã thu gọn' : `Đang ngồi: ${seatedSeat.label}`}</span>
            {seatedSeat.area === 'tea' && (
              <button type="button" onClick={() => setReadingOpen(true)} className="rounded-full bg-amber-800 px-5 py-3 text-sm font-medium text-white shadow-xl">📖 Mở hiên đọc</button>
            )}
            <button type="button" onClick={standUpSeat} className="rounded-full bg-white/85 px-5 py-3 text-sm font-medium text-amber-900 shadow-xl">Đứng dậy</button>
          </div>
          <div className="absolute right-3 z-20 flex flex-col items-end gap-2 md:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <span className="max-w-[42vw] rounded-full bg-black/55 px-3 py-2 text-center text-xs text-amber-50">{seatedSeat.area === 'lake' ? 'Đang ngắm hồ' : seatedSeat.label}</span>
            <button type="button" onClick={standUpSeat} className="max-w-[42vw] rounded-full bg-white/85 px-4 py-3 text-center text-sm font-medium text-amber-900 shadow-xl">Đứng dậy</button>
          </div>
        </>
      )}
      {entered && sitPending && (
        <div className="pointer-events-none absolute bottom-32 left-1/2 z-30 -translate-x-1/2">
          <p className="rounded-full bg-black/60 px-4 py-2 text-sm text-amber-50">Đang đi đến chỗ ngồi…</p>
        </div>
      )}

      {/* Sweep leaves bar (Request C): auto flow, 13s total.
          No instant-clear button anymore — that was the bug. */}
      {entered && sweepPhase !== 'idle' && (
        <div className="absolute bottom-28 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-3xl bg-[#fdf8ec] p-4 text-center shadow-2xl sm:bottom-24">
          <p className="font-medium text-amber-900">🧹 Đang quét lá dưới gốc đa</p>
          <p className="mt-1 text-sm text-stone-600">{sweepPhase === 'preparing' ? 'Chuẩn bị: cầm chổi, chổi chạm đất…' : sweepPhase === 'sweeping' ? 'Đang quét — từng nhát chổi gom lá dần về một đống.' : sweepPhase === 'gathering' ? 'Gom lá — đống lá đang thu dần vào giỏ.' : 'Xong rồi — sân sạch, một phút giây an yên.'}{sweepPaused ? ' (đang tạm dừng)' : ''}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full rounded-full bg-amber-800 transition-all duration-200" style={{ width: `${Math.round(sweepProgress * 100)}%` }} />
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => { sweepState.paused = !sweepState.paused; setSweepPaused(sweepState.paused); }} className="flex-1 rounded-full bg-amber-800 py-2.5 text-sm font-medium text-white">{sweepPaused ? 'Tiếp tục' : 'Tạm dừng'}</button>
            <button type="button" onClick={() => setSweepWhyOpen(true)} className="rounded-full bg-amber-100 px-4 py-2.5 text-sm text-amber-900">Vì sao quét sân?</button>
            <button type="button" onClick={cancelSweep} className="rounded-full bg-stone-200 px-4 py-2.5 text-sm">Dừng hẳn</button>
          </div>
        </div>
      )}
      {entered && sweepPending && (
        <div className="absolute bottom-28 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm text-amber-50">Đang đi đến chỗ quét lá…</div>
      )}
      {/* Bath ritual bar (Request E): 24s total, light ivory/wood
          palette, pour-round status, stop button. Hidden once the
          blessing dialog opens (phase 'done'). */}
      {entered && bathPhase !== 'idle' && bathPhase !== 'done' && (
        <div className="absolute bottom-28 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-3xl bg-[#fdf8ec] p-4 text-center shadow-2xl sm:bottom-24">
          <p className="font-medium text-amber-900">🪷 Đang tắm Phật — lễ đài Lâm Tỳ Ni</p>
          <p className="mt-1 text-sm text-stone-600">{bathPhase === 'pray' ? 'Chắp tay — lặng một nhịp trước khi bắt đầu.' : bathPhase === 'scoop' ? 'Múc nước thơm — gáo chạm mặt nước, rồi nâng lên nhẹ nhàng.' : bathPhase === 'pour' ? `Gáo ${bathPourRound}/3 — rưới nước lên tôn tượng, nước chảy về bồn.` : 'Hoàn tất — gáo về đúng chỗ, chắp tay hồi hướng.'}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full rounded-full bg-amber-800 transition-all duration-200" style={{ width: `${Math.round(bathProgress * 100)}%` }} />
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={cancelBath} className="flex-1 rounded-full bg-stone-200 py-2.5 text-sm">Dừng lại</button>
          </div>
        </div>
      )}
      {entered && bathPending && (
        <div className="absolute bottom-28 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm text-amber-50">Đang đi đến lễ đài Tắm Phật…</div>
      )}
      {bathBlessingOpen && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/25 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-[#fdf8ec] p-5 text-center shadow-2xl">
            <p className="font-serif text-xl text-amber-900">Nguyện thân tâm thanh tịnh, nuôi dưỡng điều lành.</p>
            <p className="mt-2 text-sm text-stone-600">Đã tắm Phật xong ba gáo nước thơm. Đây là mô phỏng để học và khởi tâm lành, không thay cho lễ tắm Phật tại chùa, và không mang ý nghĩa cầu tài lộc hay trừ nghiệp.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => { setBathBlessingOpen(false); setVesakOpen(true); }} className="flex-1 rounded-full bg-amber-800 py-3 font-medium text-white">Tìm hiểu Phật đản</button>
              <button type="button" onClick={() => { setBathBlessingOpen(false); bathState.phase = 'idle'; bathPrevRef.current = 'idle'; setBathPhase('idle'); }} className="rounded-full bg-stone-200 px-5 py-3">Đóng</button>
            </div>
          </div>
        </div>
      )}
      {vesakOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
          <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-[#fdf8ec] p-5 shadow-2xl">
            <h2 className="font-serif text-xl font-semibold text-amber-900">Tìm hiểu lễ Phật đản</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-700"><b>Đức Phật Thích Ca và sự đản sinh.</b> Theo truyền thống Phật giáo, Thái tử Tất Đạt Đa — về sau là Đức Phật Thích Ca Mâu Ni — đản sinh tại vườn Lâm Tỳ Ni, khi hoàng hậu Ma Da đang trên đường về quê ngoại. Câu chuyện được kể như một sự tích, không phải biên niên sử: hài nhi bước bảy bước, mỗi bước nở một đóa sen.</p>
            <p className="mt-2 text-sm leading-relaxed text-stone-700"><b>Vườn Lâm Tỳ Ni.</b> Nay thuộc vùng Terai, phía nam Nepal, được UNESCO công nhận Di sản Thế giới năm 1997 với tư cách nơi Đức Phật đản sinh, căn cứ bia đá vua A Dục dựng năm 249 trước Công nguyên.</p>
            <p className="mt-2 text-sm leading-relaxed text-stone-700"><b>Thế tay một chỉ trời, một chỉ đất.</b> Tượng Thái tử sơ sinh đứng trên đài sen, một tay chỉ lên trời, một tay chỉ xuống đất. Theo cách tạo tượng phổ biến ở các chùa Bắc tông miền Bắc Việt Nam, tay trái chỉ lên, tay phải chỉ xuống — diễn tả lời tuyên bố về một bậc giác ngộ ra đời giữa trời đất. Một số truyền thống khác đảo ngược hai tay; đó là khác biệt vùng miền, không phải đúng — sai.</p>
            <p className="mt-2 text-sm leading-relaxed text-stone-700"><b>Ý nghĩa tắm Phật bằng nước thơm.</b> Trong lễ Phật đản, người dự lễ rưới nước thơm lên tượng sơ sinh, gợi lại hình ảnh chư thiên tắm cho hài nhi lúc đản sinh. Việc làm mang ý nghĩa gột rửa thân tâm, nhắc mình sống lành và nuôi dưỡng trí tuệ — không phải nghi thức cầu tài lộc, trừ nghiệp hay chữa bệnh.</p>
            <p className="mt-2 text-sm leading-relaxed text-stone-700"><b>Đại lễ Phật đản (Vesak).</b> Ngày kỷ niệm Đức Phật đản sinh; ở Việt Nam các chùa thường tổ chức vào dịp rằm tháng Tư âm lịch, với cờ Phật giáo năm màu, hoa sen và lễ tắm Phật. Nghi thức mô phỏng trong chùa này chỉ để học và khởi tâm lành, không thay cho lễ tại chùa thật.</p>
            <p className="mt-3 text-xs leading-relaxed text-stone-500">Nguồn: UNESCO, “Lumbini, the Birthplace of the Lord Buddha” (Di sản Thế giới, 1997); Roots — Ban Di sản Quốc gia Singapore, các hiện vật “Figure of the infant Buddha” (tượng sơ sinh đứng, tay trái chỉ lên — tay phải chỉ xuống, phổ biến ở chùa Bắc tông miền Bắc Việt Nam, rước trong lễ Vesak). Không trích dẫn kinh văn nguyên văn ở đây.</p>
            <label className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3">
              <span className="text-sm font-medium text-amber-900">Chế độ lễ hội — cờ ngũ sắc, biển “Kính mừng Đại lễ Phật đản”, thêm hoa sen</span>
              <input type="checkbox" checked={festivalOn} onChange={(e) => { const v = e.target.checked; setFestivalOn(v); try { localStorage.setItem('chua-lumbini-festival', v ? '1' : '0'); } catch { /* ignore */ } }} className="h-5 w-5 accent-amber-800" />
            </label>
            <button type="button" onClick={() => setVesakOpen(false)} className="mt-4 w-full rounded-full bg-amber-800 py-3 font-medium text-white">Đã hiểu</button>
          </div>
        </div>
      )}
      {sweepThanksOpen && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/25 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-[#fdf8ec] p-5 text-center shadow-2xl">
            <p className="font-serif text-xl text-amber-900">Một khoảng sân sạch, một phút giây an yên.</p>
            <p className="mt-2 text-sm text-stone-600">Sân đa đã sạch. Một việc nhỏ làm bằng sự chú ý cũng là một cách thực tập.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => { setSweepThanksOpen(false); setSweepWhyOpen(true); }} className="flex-1 rounded-full bg-amber-800 py-3 font-medium text-white">Vì sao quét sân?</button>
              <button type="button" onClick={() => setSweepThanksOpen(false)} className="rounded-full bg-stone-200 px-5 py-3">Đóng</button>
            </div>
          </div>
        </div>
      )}
      {sweepWhyOpen && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/25 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-[#fdf8ec] p-5 shadow-2xl">
            <h2 className="font-serif text-xl font-semibold text-amber-900">Vì sao quét sân?</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">Sân chùa là nơi chung: ai đến cũng đi qua, cũng ngồi nghỉ. Quét sân là chăm sóc nơi chung ấy, và cũng là dịp để ý tới việc mình đang làm — từng nhát chổi, từng cụm lá — thay vì vừa làm vừa nghĩ chuyện khác. Không cần làm thật nhanh, chỉ cần làm trọn vẹn một việc nhỏ.</p>
            <button type="button" onClick={() => setSweepWhyOpen(false)} className="mt-4 w-full rounded-full bg-amber-800 py-3 font-medium text-white">Đã hiểu</button>
          </div>
        </div>
      )}

      {/* Water vegetables card */}
      {waterCardOpen && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/25 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-[#fdf8ec] p-5 shadow-2xl">
            <h2 className="font-serif text-xl font-semibold text-amber-900">Đã tưới xong một lượt</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">Đất đã sẫm lại. Chăm vườn cũng giống chăm một việc chung: không cần tưới thật nhiều một lần, chỉ cần đều đặn, đúng chỗ, và để ý xem cây đang cần gì. Một lượt là đủ cho hôm nay.</p>
            <button type="button" onClick={() => setWaterCardOpen(false)} className="mt-4 w-full rounded-full bg-amber-800 py-3 font-medium text-white">Đã hiểu</button>
          </div>
        </div>
      )}
      {entered && carryingWater && (
        <div className="pointer-events-none absolute bottom-32 left-1/2 z-30 -translate-x-1/2">
          <p className="rounded-full bg-black/60 px-4 py-2 text-sm text-amber-50">Đang mang một gáo nước — tới luống rau để tưới.</p>
        </div>
      )}

      {/* Bell indicator (mindful slow-walk removed 2026-11-03 at the user's order) */}
      {bellPlaying && (
        <div className="pointer-events-none absolute bottom-32 left-1/2 z-30 -translate-x-1/2">
          <p className="rounded-full bg-black/60 px-4 py-2 text-sm text-amber-50">🔔 Đang thỉnh chuông — hãy để âm ngân hết.</p>
        </div>
      )}

      <audio ref={bellRef} src="/audio/bell.mp3" preload="auto" onEnded={() => setBellPlaying(false)} />

      {/* Reading porch (tea house) — three short introductions, no
          sutra quotations, so nothing here presents itself as scripture. */}
      {readingOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
          <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-[#fdf8ec] p-5 shadow-2xl">
            <div className="flex justify-between">
              <h2 className="font-serif text-xl font-semibold text-amber-900">Hiên đọc — Nhà trà</h2>
              <button type="button" onClick={() => setReadingOpen(false)} className="rounded-full bg-stone-200 px-3 py-1 text-sm">✕</button>
            </div>
            <div className="mt-3 flex gap-2">
              {([['first', 'Lần đầu ghé chùa'], ['mindful', 'Chánh niệm trong việc thường ngày'], ['dedication', 'Hồi hướng là gì?']] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setReadingId(id)} className={`flex-1 rounded-xl px-2 py-2 text-xs ${readingId === id ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-900'}`}>{label}</button>
              ))}
            </div>
            <div className="mt-4 text-sm leading-relaxed text-stone-700">
              {readingId === 'first' && (
                <>
                  <p>Đến chùa lần đầu, bạn không cần biết hết nghi lễ. Chỉ cần đi chậm, giữ yên lặng ở những nơi thờ, và làm những việc mình hiểu: thắp một nén hương nếu muốn, ngồi một lúc, hoặc chỉ đi dạo ngắm cảnh.</p>
                  <p className="mt-2">Nếu không chắc một việc có nên làm không, hãy nhìn xem mọi người xung quanh làm gì, hoặc hỏi một người đang ở đó. Không ai bắt bạn phải làm đủ mọi nghi thức mới được vào chùa.</p>
                </>
              )}
              {readingId === 'mindful' && (
                <>
                  <p>Chánh niệm trong việc thường ngày không phải là một kỹ thuật khó. Nó chỉ là để ý trọn vẹn tới việc đang làm: khi quét sân thì biết mình đang quét, khi tưới rau thì biết nước đang chảy, khi đi bộ thì biết bàn chân đang chạm đất.</p>
                  <p className="mt-2">Ví dụ: thay vì vừa quét vừa nghĩ chuyện ngày mai, bạn thử quét hết một cụm lá rồi mới chuyển sang cụm khác. Việc nhỏ làm trọn vẹn cũng đủ để tâm lắng xuống một chút.</p>
                </>
              )}
              {readingId === 'dedication' && (
                <>
                  <p>Hồi hướng là gửi những điều tốt lành mình vừa làm — một lúc ngồi yên, một lời niệm Phật — đến cho người khác: cha mẹ, gia đình, hoặc tất cả mọi người. Không phải là một phép đổi chác, mà là một cách mở rộng lòng mình ra ngoài bản thân.</p>
                  <p className="mt-2">Trong chùa này, sau khi niệm Phật xong, bạn có thể chọn một lời hồi hướng do ứng dụng gợi ý. Lời đó là lời nguyện tham khảo, không phải nguyên văn kinh Phật.</p>
                </>
              )}
            </div>
            <p className="mt-4 text-xs text-stone-500">Bài viết giới thiệu chung, không trích dẫn kinh văn. Nội dung giáo lý có trích dẫn sẽ cần nguồn và được duyệt trước khi đăng.</p>
          </div>
        </div>
      )}

      {/* Map — 2D, follows the real floor plan, "Bạn đang ở đây" marker.
          Desktop: side panel. Mobile: bottom sheet. */}
      {mapOpen && (
        <div className="absolute inset-0 z-40 md:pointer-events-none">
          <div className="absolute inset-0 bg-black/25 md:hidden" onClick={() => setMapOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-y-auto rounded-t-3xl bg-[#fdf8ec] p-4 shadow-2xl md:left-auto md:right-4 md:top-20 md:bottom-20 md:w-[380px] md:max-h-none md:rounded-3xl md:pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between">
              <h2 className="font-serif text-xl font-semibold text-amber-900">Sơ đồ Chùa Hải An</h2>
              <button type="button" onClick={() => setMapOpen(false)} className="rounded-full bg-stone-200 px-3 py-1 text-sm">✕</button>
            </div>
            <svg viewBox="0 0 480 600" className="mt-3 w-full rounded-2xl bg-[#e8e0cc]">
              {/* Hall */}
              <rect x="145" y="80" width="190" height="202" fill="#e8d9b8" stroke="#7a5c3a" />
              <text x="240" y="180" textAnchor="middle" fontSize="13" fill="#7a1f1f">Chính điện</text>
              {/* Tam quan + courtyard */}
              <rect x="190" y="470" width="100" height="20" fill="#a8432a" />
              <text x="240" y="505" textAnchor="middle" fontSize="11">Cổng tam quan</text>
              {/* Pond */}
              <circle cx="155" cy="355" r="36" fill="#7aa8c8" />
              <text x="155" y="358" textAnchor="middle" fontSize="11" fill="#fff">Hồ sen</text>
              {/* Banyan, garden, tea, bell */}
              <circle cx="400" cy="440" r="26" fill="#3f7a2e" />
              <text x="400" y="444" textAnchor="middle" fontSize="11" fill="#fff">Sân đa</text>
              <rect x="380" y="140" width="70" height="70" fill="#7a9a5a" />
              <text x="415" y="178" textAnchor="middle" fontSize="11">Vườn sau</text>
              <rect x="390" y="90" width="50" height="35" fill="#e8d9b8" stroke="#7a5c3a" />
              <text x="415" y="112" textAnchor="middle" fontSize="10">Nhà trà</text>
              <circle cx="110" cy="260" r="14" fill="#c9a227" />
              <text x="110" y="282" textAnchor="middle" fontSize="10">Gác chuông</text>
              {/* Lumbini (Request E): exact formula (wx+24)*10,
                  (wz+34)*10 for the altar (-17,-20) -> (70,140);
                  clear of the bell (110,260), hall rect (x 145+)
                  and pond (155,355). */}
              <circle cx="70" cy="140" r="16" fill="#c98a9e" stroke="#7a5c3a" />
              {/* Label EAST of the dot (2026-11-04): the old centred
                  white label sat under the red 'Bạn đang ở đây'
                  marker whenever the guest stood at Lumbini. */}
              <text x="92" y="144" textAnchor="start" fontSize="10" fill="#7a5c3a">Lâm Tỳ Ni</text>
              {/* Player marker */}
              <circle cx={(playerPos.x + 24) * 10} cy={(playerPos.z + 34) * 10} r="10" fill="#dc2626" stroke="#fff" strokeWidth="2" />
              <text x={(playerPos.x + 24) * 10} y={(playerPos.z + 34) * 10 - 16} textAnchor="middle" fontSize="11" fill="#dc2626">Bạn đang ở đây</text>
            </svg>
            <div className="mt-3 grid gap-2">
              {([
                ['hall', '🏯 Chính điện', 'Ngồi (8 đệm) · Quỳ lễ · Ban Thích Ca · Ban Địa Tạng'],
                ['burner', '🪔 Lư hương', 'Dâng hương'],
                ['chant', '📿 Khu niệm Phật', 'Niệm Phật · Hồi hướng'],
                ['pond', '🪷 Hồ sen', 'Phóng sinh (mô phỏng) · Ngồi ngắm hồ'],
                ['banyan', '🌳 Sân đa', 'Ngồi dưới tán cây · Quét lá'],
                ['garden', '🥬 Vườn sau', 'Múc nước · Tưới cây'],
                ['tea', '🍵 Nhà trà', 'Ngồi nhà trà · Hiên đọc'],
                ['bell', '🔔 Gác chuông', 'Thỉnh chuông'],
                ['lumbini', '🪷 Vườn Lâm Tỳ Ni – Tắm Phật', 'Tắm Phật · Tìm hiểu Phật đản'],
                ['gate', '⛩ Cổng tam quan', 'Biển tên Chùa Hải An'],
              ] as const).map(([id, label, acts]) => (
                <div key={id} className={`rounded-2xl border p-3 ${mapZone === id ? 'border-amber-700 bg-amber-50' : 'border-stone-200 bg-white'}`}>
                  <button type="button" onClick={() => setMapZone(id)} className="w-full text-left">
                    <span className="font-medium">{label}</span>
                    <span className="mt-0.5 block text-xs text-stone-500">{acts}</span>
                  </button>
                  {mapZone === id && (
                    <button type="button" onClick={() => goToZone(id)} className="mt-2 w-full rounded-full bg-amber-800 py-2.5 text-sm font-medium text-white">Đến đây</button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-stone-500">Chọn một địa điểm, rồi bấm “Đến đây” mới bắt đầu đi. Tự điều khiển bằng WASD / joystick sẽ hủy tự đi.</p>
          </div>
        </div>
      )}

      {/* Background music: dan tranh meditation excerpt (see
          Help credit), separate from the chant voice. Manual loop
          with fade: onEnded restarts with a soft fade-in instead
          of a hard loop click. The file itself also has a 3s
          fade-in and a 3s fade-out baked in. */}
      <audio
        ref={bgRef}
        src="/audio/nhac-thien-dan-tranh.mp3"
        preload="auto"
        onEnded={(e) => {
          const a = e.target as HTMLAudioElement;
          if (!soundMuted && !chantPlaying) {
            a.currentTime = 0;
            a.volume = 0.1;
            a.play().then(() => { a.volume = 0.22; }).catch(() => {});
          }
        }}
        onError={() => setSoundBlocked(true)}
      />
    </main>
  );
}
