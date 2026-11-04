'use client';

import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  controls,
  LAYOUT,
  SEATS,
  isInHall,
  sweepState,
  bathState,
  waterState,
  releaseState,
  monksState,
  boatState,
  wishingRackState,
  lanternState,
  type Seat,
  type SweepPhase,
  type BathPhase,
  type BoatPhase,
  type PlayerGender,
  type MonkId,
} from '@/components/three/controls';
import ChantPanel, { type ChantMode } from '@/components/ui/ChantPanel';
import type { ChantItem } from '@/lib/chanting';
import { multiplayer, getSessionId, guestName, getStoredWsUrl, setStoredWsUrl, getSolo, setSolo, type MpStatus } from '@/lib/multiplayer';
import { loadFlame, markFlameDay, flameLabel, flameNote, type FlameState } from '@/lib/flame';
import {
  loadMeritState,
  awardMerit,
  buildMeritLeaderboard,
  getMeritRank,
  getNextMeritRank,
  MERIT_RANKS,
  MERIT_ACTIONS,
  type MeritActionKey,
  type MeritState,
} from '@/lib/merit';

const World = dynamic(() => import('@/components/three/World'), { ssr: false });


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

const NAME_KEY = 'thien-vien-name';
const GENDER_KEY = 'thien-vien-gender';
const HSK_URL = 'https://hoc-hsk.vercel.app/';

const FORTUNE_STICKS = [
  {
    num: 1,
    rank: 'Thượng Cát · Tâm An Vạn Sự An',
    verse: 'Trăng sáng soi gương mặt nước trong,\nTâm bình vạn sự tự hanh thông.\nGieo nhân thiện lành nơi hiện tại,\nHoa trái ngọt ngào nở cuối đông.',
    meaning: 'Khi tâm giữ được sự điềm tĩnh, sáng suốt thì mọi việc học hành, gia đạo và công việc đều tự khắc mở lối thuận lợi.',
    practice: 'Hôm nay hãy dành 3 phút hít thở sâu và làm một việc nhỏ giúp đỡ người thân.',
  },
  {
    num: 2,
    rank: 'Đại Cát · Trí Tuệ Đăng Khoa',
    verse: 'Đèn khuya chăm chỉ rạng trang thư,\nMưa móc thấm nhuần nảy mầm từ.\nChớ ngại đường xa nhiều dốc đá,\nBến bờ trí tuệ đón người xưa.',
    meaning: 'Quẻ lành về học tập và thi cử (đặc biệt thuận lợi cho người đang ôn luyện ngoại ngữ, HSK, nâng cao tri thức). Sự kiên trì mỗi ngày sẽ mang lại quả ngọt.',
    practice: 'Ôn tập thêm 10 từ vựng mới trên Đảo HSK (hoc-hsk.vercel.app) với tâm thế vui vẻ, không áp lực.',
  },
  {
    num: 3,
    rank: 'Thượng Cát · Hiếu Đạo Sinh Phước',
    verse: 'Hai đấng sinh thành tựa Phật tiền,\nChăm lo hiếu kính phước vô biên.\nGia đình hòa thuận xuân常 ở,\nChẳng phải tìm đâu chốn cảnh tiên.',
    meaning: 'Phước báu lớn nhất bắt nguồn từ lòng hiếu thảo và sự hòa thuận trong gia đình. Gia đạo êm ấm là nền tảng của mọi thành công.',
    practice: 'Gửi một lời hỏi thăm ấm áp hoặc giúp cha mẹ, người thân một việc nhà ngay hôm nay.',
  },
  {
    num: 4,
    rank: 'Thượng Cát · Nhẫn Hòa Kết Duyên Lành',
    verse: 'Một câu nhịn nhường chín sự lành,\nGió xuân thổi mát rặng tùng xanh.\nMỉm cười buông nhẹ lời hơn thiệt,\nThiện hữu tri thức tự vây quanh.',
    meaning: 'Lấy sự ôn hòa, lắng nghe để đối đãi với mọi người sẽ hóa giải hiểu lầm và kết thêm nhiều thiện duyên quý giá.',
    practice: 'Lắng nghe trọn vẹn khi người khác nói và trao đi một nụ cười chân thành.',
  },
  {
    num: 5,
    rank: 'Đại Cát · Tinh Tấn Vững Bước',
    verse: 'Nước chảy đá mòn bởi bền lâu,\nTừng bước an nhiên vượt nhịp cầu.\nChẳng sợ mây mù che lối nhỏ,\nNắng mai rực rỡ phía rừng sâu.',
    meaning: 'Mục tiêu lớn không thành tựu trong một sớm một chiều mà nhờ sự đều đặn, bền bỉ mỗi ngày như dòng nước chảy.',
    practice: 'Chia nhỏ mục tiêu lớn của bạn thành một việc nhỏ có thể hoàn thành trọn vẹn ngay hôm nay.',
  },
  {
    num: 6,
    rank: 'Thượng Cát · Từ Bi Hỷ Xả',
    verse: 'Sen nở trong bùn chẳng nhiễm hương,\nLòng người rộng mở khắp muôn phương.\nBuông đi gánh nặng chuyện năm cũ,\nBước nhẹ thênh thang vạn dặm đường.',
    meaning: 'Biết tha thứ cho người khác và bao dung với chính mình sẽ giúp tâm hồn nhẹ nhõm, đón nhận năng lượng mới tươi sáng.',
    practice: 'Buông bỏ một nỗi bận tâm cũ và viết một lời chúc lành gửi người bạn thương.',
  },
] as const;

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [entered, setEntered] = useState(false);
  const [name, setName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [gender, setGender] = useState<PlayerGender>('female');
  const [zone, setZone] = useState<'burner' | 'chant' | 'pond' | 'altar' | 'none'>('none');
  const zoneRef = useRef<'burner' | 'chant' | 'pond' | 'altar' | 'none'>('none');
  // Fish release (lotus pond)
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releasingFish, setReleasingFish] = useState(false);
  const [releasingCount, setReleasingCount] = useState(1);
  const [releaseProgress, setReleaseProgress] = useState(0);
  const [spawnTick, setSpawnTick] = useState(0);
  const [spawnCount, setSpawnCount] = useState(1);
  const [fishCount, setFishCount] = useState(0);
  const [releaseMessage, setReleaseMessage] = useState('');
  const [remoteTick, setRemoteTick] = useState(0);
  // Hall ritual: kneel / sit in front of the Guanyin statue + slow-walk etiquette
  const [hallRitual, setHallRitual] = useState<'none' | 'sit' | 'kneel'>('none');
  const [inHall, setInHall] = useState(false);
  const inHallPrevRef = useRef(false);
  const [hallWhyOpen, setHallWhyOpen] = useState(false);
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
  // Usable seats (38 chanting & meditation seats across 7 temple zones): sit via auto-walk, then pose.
  const [seatedSeat, setSeatedSeat] = useState<Seat | null>(null);
  const [sitPending, setSitPending] = useState<Seat | null>(null);
  const [seatsModalOpen, setSeatsModalOpen] = useState(false);
  const [seatsFilter, setSeatsFilter] = useState<'all' | 'hall' | 'westChant' | 'stupaChant' | 'outdoor'>('all');
  // Merit Leaderboard & Temple Rank System (lib/merit.ts)
  const [meritState, setMeritState] = useState<MeritState>(() => loadMeritState());
  const [meritOpen, setMeritOpen] = useState(false);
  const [meritTab, setMeritTab] = useState<'leaderboard' | 'ranks' | 'history'>('leaderboard');
  // Context action (nearest object, hysteresis in the poll below).
  type Ctx = {
    kind: 'seat' | 'broom' | 'jar' | 'bed' | 'bell' | 'bath' | 'monk' | 'boat' | 'wishingRack' | 'fortune' | 'stupa' | 'lantern' | 'meritBoard';
    id: string;
    label: string;
  };
  const [ctxAction, setCtxAction] = useState<Ctx | null>(null);
  const ctxRef = useRef<Ctx | null>(null);
  // 2 Chú tiểu đi quanh chùa (Novice monks interactive dialogue)
  const [activeMonk, setActiveMonk] = useState<MonkId | null>(null);
  const [monkTopic, setMonkTopic] = useState<'welcome' | 'etiquette' | 'daily' | 'blessing' | 'wayfinding'>('welcome');
  const [monkBlessingIdx, setMonkBlessingIdx] = useState(0);
  // Boat ride across Sông Bát Nhã to Hòn Đảo HSK (https://hoc-hsk.vercel.app/)
  const [boatPhase, setBoatPhase] = useState<BoatPhase>('idle');
  const [boatProgress, setBoatProgress] = useState(0);
  const [boatPending, setBoatPending] = useState(false);
  const boatPrevRef = useRef<BoatPhase>('idle');
  const [hskModalOpen, setHskModalOpen] = useState(false);
  // Meaningful Buddhist temple activities:
  // 1) Xin xâm / Gieo quẻ Từ Bi đầu năm (Ống xâm Quán Thế Âm)
  const [fortuneOpen, setFortuneOpen] = useState(false);
  const [fortuneShaking, setFortuneShaking] = useState(false);
  const [fortuneStickIdx, setFortuneStickIdx] = useState<number | null>(null);
  // 2) Treo thẻ gỗ ước nguyện Bồ Đề cạnh Cây đa Bách Linh
  const [plaqueOpen, setPlaqueOpen] = useState(false);
  const [plaqueWish, setPlaqueWish] = useState('');
  const [plaqueCategory, setPlaqueCategory] = useState('Cầu học tập tinh tấn · Thi đỗ HSK điểm cao');
  // 3) Thả đèn Hoa Đăng cầu an trên Tâm Liên Hồ & Sông Bát Nhã
  const [lanternModalOpen, setLanternModalOpen] = useState(false);
  const [lanternWish, setLanternWish] = useState('Nguyện cầu bình an, trí tuệ sáng suốt cho gia đình và bản thân');
  // 4) Bảo Tháp Báo Ân 7 tầng & Kinh hành nhiễu tháp
  const [stupaModalOpen, setStupaModalOpen] = useState(false);
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
  const [waterProgress, setWaterProgress] = useState(0);
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

  const changeGender = (g: PlayerGender) => {
    setGender(g);
    controls.gender = g;
    try {
      localStorage.setItem(GENDER_KEY, g);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const saved = localStorage.getItem(NAME_KEY);
    if (saved) {
      setName(saved);
      setNameInput(saved);
      setSettingsName(saved);
    }
    const savedGender = localStorage.getItem(GENDER_KEY);
    if (savedGender === 'male' || savedGender === 'female') {
      setGender(savedGender);
      controls.gender = savedGender;
    }
    setMeritState(loadMeritState());
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

  const earnMerit = useCallback((action: MeritActionKey, customToast?: string) => {
    const res = awardMerit(action);
    setMeritState(res.state);
    if (res.rankUp) {
      showToast(`🏆 Thăng phẩm vị Công Đức: ${res.rankUp.badge} ${res.rankUp.title} (${res.state.points} Công Đức)!`);
    } else if (customToast) {
      showToast(`${customToast} (+${res.added} Công Đức)`);
    } else {
      showToast(`🪷 +${res.added} Công Đức (${MERIT_ACTIONS[action].label}) · Tổng: ${res.state.points} Công Đức`);
    }
  }, []);

  const currentRank = getMeritRank(meritState.points);
  const nextRank = getNextMeritRank(meritState.points);

  const openMap = () => {
    setPlayerPos({ x: controls.playerPos.x, z: controls.playerPos.z });
    setMapOpen(true);
  };


  const openMonkModal = (id: MonkId) => {
    setActiveMonk(id);
    setMonkTopic('welcome');
    monksState.taman.talking = id === 'taman';
    monksState.tamminh.talking = id === 'tamminh';
    earnMerit('monk_talk');
  };

  const closeMonkModal = () => {
    setActiveMonk(null);
    monksState.taman.talking = false;
    monksState.tamminh.talking = false;
  };

  // --- Boat ride across Sông Bát Nhã to Hòn Đảo HSK (https://hoc-hsk.vercel.app/) ---
  const startBoatToHSK = () => {
    setMapOpen(false);
    setMobileMenuOpen(false);
    if (boatState.phase === 'at_hsk') {
      setHskModalOpen(true);
      return;
    }
    if (boatState.phase === 'sailing_to_hsk' || boatState.phase === 'sailing_back') {
      return;
    }
    const px = controls.playerPos.x;
    const pz = controls.playerPos.z;
    if (Math.hypot(px - LAYOUT.pier.x, pz - LAYOUT.pier.z) < 2.4) {
      setBoatPending(false);
      controls.boatAutoWalk = false;
      boatState.phase = 'sailing_to_hsk';
      boatState.progress = 0;
      boatPrevRef.current = 'sailing_to_hsk';
      setBoatPhase('sailing_to_hsk');
      controls.mode = 'boat';
      touchFlame();
    } else {
      setBoatPending(true);
      controls.boatAutoWalk = true;
      const insideHall = px > -9.5 && px < 9.5 && pz > -26 && pz < -5.8;
      controls.waypoints = insideHall ? [{ x: 0, z: -4.2 }, { x: 0, z: 15 }] : [{ x: 0, z: 15 }];
      controls.moveTarget = { ...LAYOUT.pier };
      if (controls.mode === 'menu' || controls.mode === 'intro') controls.mode = 'follow';
      showToast('⛵ Đang bước ra Bến Thuyền Độ Sinh để lên thuyền sang Đảo HSK…');
    }
  };

  const sailBackFromHSK = () => {
    setHskModalOpen(false);
    boatState.phase = 'sailing_back';
    boatState.progress = 0;
    boatPrevRef.current = 'sailing_back';
    setBoatPhase('sailing_back');
    controls.mode = 'boat';
  };

  const cancelBoat = () => {
    setBoatPending(false);
    controls.boatAutoWalk = false;
    controls.moveTarget = null;
    controls.waypoints = [];
    boatState.phase = 'idle';
    boatState.progress = 0;
    boatPrevRef.current = 'idle';
    setBoatPhase('idle');
    setHskModalOpen(false);
    if (controls.mode === 'boat') controls.mode = 'follow';
  };

  // --- Meaningful Buddhist Temple Activities ---
  const drawFortuneStick = () => {
    if (fortuneShaking) return;
    setFortuneShaking(true);
    setFortuneStickIdx(null);
    touchFlame();
    setTimeout(() => {
      const idx = Math.floor(Math.random() * FORTUNE_STICKS.length);
      setFortuneStickIdx(idx);
      setFortuneShaking(false);
      earnMerit('fortune_stick');
    }, 1500);
  };

  const confirmHangPlaque = () => {
    const text = (plaqueWish.trim() || plaqueCategory).slice(0, 180);
    wishingRackState.customCount = Math.min(7, wishingRackState.customCount + 1);
    wishingRackState.lastHungAt = Date.now();
    touchFlame();
    setPlaqueOpen(false);
    setPlaqueWish('');
    earnMerit('wishing_plaque', '🎋 Đã treo thẻ gỗ ước nguyện dưới tán Cây đa Bách Linh');
  };

  const confirmReleaseLantern = () => {
    const text = (lanternWish.trim() || 'Nguyện cầu bình an, trí tuệ sáng suốt').slice(0, 180);
    lanternState.pondCount = Math.min(6, lanternState.pondCount + 1);
    lanternState.riverCount = Math.min(8, lanternState.riverCount + 1);
    lanternState.lastSpawnAt = Date.now();
    touchFlame();
    setLanternModalOpen(false);
    earnMerit('lotus_lantern', '🪷 Đã thắp và thả một ngọn đèn Hoa Đăng trên mặt nước');
  };

  const startStupaCircumambulation = () => {
    setStupaModalOpen(false);
    touchFlame();
    earnMerit('stupa_walk', '🙏 Đang đi kinh hành nhiễu Bảo Tháp Báo Ân 1 vòng theo chiều kim đồng hồ');
    // Nhiễu tháp 1 vòng theo chiều kim đồng hồ quanh Bảo Tháp Báo Ân (35.0, -2.5)
    controls.waypoints = [
      { x: 31.2, z: -2.5 },
      { x: 31.2, z: -6.2 },
      { x: 38.8, z: -6.2 },
      { x: 38.8, z: 1.2 },
      { x: 31.2, z: 1.2 },
    ];
    controls.moveTarget = { x: 31.2, z: -2.5 };
    if (controls.mode === 'menu' || controls.mode === 'intro') controls.mode = 'follow';
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
    boatPhase === 'idle' &&
    !boatPending &&
    !hskModalOpen &&
    !fortuneOpen &&
    !plaqueOpen &&
    !lanternModalOpen &&
    !stupaModalOpen &&
    !meritOpen &&
    !seatsModalOpen &&
    ritual === 'none' &&
    !(chantPlaying && chantMode === 'calm') &&
    !dedicationOpen &&
    !mobileMenuOpen &&
    !releaseOpen &&
    !releasingFish &&
    !waterStream &&
    !activeMonk &&
    !hallWhyOpen &&
    hallRitual === 'none' &&
    !seatedSeat &&
    !bellRinging;

  useEffect(() => {
    controls.seatId = seatedSeat ? seatedSeat.id : '';
    if (!entered) {
      controls.mode = 'menu';
      return;
    }
    if (boatPhase !== 'idle') {
      controls.mode = 'boat';
      controls.pose = 'stand';
    } else if (ritual === 'choosing' || ritual === 'offering') {
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
  }, [entered, ritual, chantPlaying, chantMode, hallRitual, seatedSeat, boatPhase]);

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
        setSettingsOpen(false); setHelpOpen(false);
        setChantOpen(false); setReleaseOpen(false); setWishOpen(false);
        setMobileMenuOpen(false); setSweepWhyOpen(false); setWaterCardOpen(false);
        setHallWhyOpen(false); closeMonkModal();
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
      showToast('Bạn đang ở chế độ riêng — phòng chung chưa được cấu hình, bấm nút Phòng chung để bật multiplayer.');
    }
  };

  // Hall ritual: kneel or sit in front of the Guanyin statue, then
  // the wish panel opens on its own (after the pose settles).
  // The wish itself is PRIVATE: it is never sent to multiplayer or read aloud.
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
      // Performance optimization: only update React playerPos state when the 2D map
      // is open and the player actually moved >0.35m (prevents 5x/sec full-app re-renders!).
      if (mapOpen) {
        setPlayerPos((prev) => (Math.hypot(px - prev.x, pz - prev.z) > 0.35 ? { x: px, z: pz } : prev));
      }
      const insideHallNow = isInHall(px, pz);
      if (insideHallNow !== inHallPrevRef.current) {
        inHallPrevRef.current = insideHallNow;
        setInHall(insideHallNow);
        if (insideHallNow) {
          showToast('🙏 Bước vào Chính điện — Đi nhẹ bước êm để giữ sự thanh tịnh, tôn nghiêm nơi thờ Phật.');
        }
      }
      if (sitPending) {
        if (Math.hypot(px - sitPending.x, pz - sitPending.z) < 0.45) {
          setSeatedSeat(sitPending);
          setSitPending(null);
        }
      }
      // Sweep: auto-walk arrival -> start; phase/progress mirror;
      // completed->idle -> final message + free walk resumes.
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
            earnMerit('sweep_leaves');
          }
          sweepPrevRef.current = ph;
          setSweepPhase(ph);
        }
        if (ph !== 'idle') {
          setSweepProgress(sweepState.progress);
          if (Math.hypot(px - LAYOUT.sweepSpot.x, pz - LAYOUT.sweepSpot.z) > 4) {
            cancelSweep();
          }
        }
      }
      // Bath ritual (Request E): auto-walk arrival -> start;
      // phase/pour-round mirror; done -> blessing dialog.
      if (bathPending && Math.hypot(px - LAYOUT.lumbiniSpot.x, pz - LAYOUT.lumbiniSpot.z) < 0.45) {
        setBathPending(false);
        controls.bathAutoWalk = false;
        controls.pose = 'pray';
        bathState.phase = 'pray';
        controls.mode = 'bath';
        bathPrevRef.current = 'pray';
        setBathPhase('pray');
      }
      {
        const ph = bathState.phase;
        if (ph !== bathPrevRef.current) {
          if (ph === 'done') {
            controls.pose = 'stand';
            setBathBlessingOpen(true);
            earnMerit('bath_buddha');
          }
          bathPrevRef.current = ph;
          setBathPhase(ph);
        }
        if (ph !== 'idle' && ph !== 'done') {
          setBathProgress(bathState.progress);
          setBathPourRound(bathState.pourRound);
          if (Math.hypot(px - LAYOUT.lumbiniSpot.x, pz - LAYOUT.lumbiniSpot.z) > 4) {
            cancelBath();
          }
        }
      }
      // Boat ride across Sông Bát Nhã to Hòn Đảo HSK:
      if (boatPending && Math.hypot(px - LAYOUT.pier.x, pz - LAYOUT.pier.z) < 0.85) {
        setBoatPending(false);
        controls.boatAutoWalk = false;
        boatState.phase = 'sailing_to_hsk';
        boatState.progress = 0;
        boatPrevRef.current = 'sailing_to_hsk';
        setBoatPhase('sailing_to_hsk');
        controls.mode = 'boat';
        touchFlame();
      }
      {
        const bph = boatState.phase;
        if (bph !== boatPrevRef.current) {
          if (bph === 'at_hsk') {
            setHskModalOpen(true);
            earnMerit('hsk_boat');
          } else if (bph === 'idle' && boatPrevRef.current === 'sailing_back') {
            controls.mode = 'follow';
            showToast('⛵ Thuyền đã cập Bến Thuyền Độ Sinh — chào mừng bạn trở lại Chùa Hải An.');
          }
          boatPrevRef.current = bph;
          setBoatPhase(bph);
        }
        if (bph === 'sailing_to_hsk' || bph === 'sailing_back') {
          setBoatProgress(boatState.progress);
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
          if (d < 1.4) {
            const label =
              s.area === 'lake'
                ? 'Ngồi tọa thiền · Ngắm hồ'
                : s.area === 'hall' || s.area === 'westChant' || s.area === 'stupaChant'
                  ? `Ngồi tọa cụ niệm kinh (${s.label})`
                  : `Ngồi tại đây (${s.label})`;
            candidates.push({ kind: 'seat', id: s.id, label, d });
          }
        }
      }
      if (sweepState.phase === 'idle' && !sweepPending && !sweepDone) {
        const d = Math.hypot(px - LAYOUT.broom.x, pz - LAYOUT.broom.z);
        if (d < 2.0) candidates.push({ kind: 'broom', id: 'broom', label: 'Quét lá', d });
      }
      {
        const d = Math.hypot(px - LAYOUT.waterJar.x, pz - LAYOUT.waterJar.z);
        if (d < 1.8 && !carryingWater) candidates.push({ kind: 'jar', id: 'jar', label: 'Múc nước vào gáo', d });
      }
      if (carryingWater && !waterStream) {
        const d = Math.hypot(px - LAYOUT.vegBed.x, pz - LAYOUT.vegBed.z);
        if (d < 2.4) candidates.push({ kind: 'bed', id: 'bed', label: 'Cầm gáo tưới rau', d });
      }
      {
        const d = Math.hypot(px - LAYOUT.bellTower.x, pz - LAYOUT.bellTower.z);
        if (d < 3.0) candidates.push({ kind: 'bell', id: 'bell', label: 'Thỉnh chuông', d });
      }
      if (bathState.phase === 'idle' && !bathPending) {
        const d = Math.hypot(px - LAYOUT.lumbiniBasin.x, pz - LAYOUT.lumbiniBasin.z);
        if (d < 2.5) candidates.push({ kind: 'bath', id: 'bath', label: 'Tắm Phật', d });
      }
      // Bến Thuyền Độ Sinh -> Đi thuyền qua Sông Bát Nhã sang Đảo HSK
      if (boatState.phase === 'idle' && !boatPending) {
        const d = Math.hypot(px - LAYOUT.pier.x, pz - LAYOUT.pier.z);
        if (d < 3.8) candidates.push({ kind: 'boat', id: 'boat', label: 'Đi thuyền sang Đảo HSK', d });
      }
      // Đài Bia Vàng Công Đức Chùa Hải An
      {
        const d = Math.hypot(px - LAYOUT.meritBoard.x, pz - LAYOUT.meritBoard.z);
        if (d < 3.0) candidates.push({ kind: 'meritBoard', id: 'meritBoard', label: 'Xem Bảng Vàng Công Đức & Phẩm Vị', d });
      }
      // Giá treo thẻ ước nguyện Bồ Đề cạnh Cây đa Bách Linh
      {
        const d = Math.hypot(px - LAYOUT.wishingRack.x, pz - LAYOUT.wishingRack.z);
        if (d < 2.8) candidates.push({ kind: 'wishingRack', id: 'wishingRack', label: 'Treo thẻ gỗ ước nguyện Bồ Đề', d });
      }
      // Ống xâm Từ Bi trong Chính điện
      {
        const d = Math.hypot(px - LAYOUT.fortuneCylinder.x, pz - LAYOUT.fortuneCylinder.z);
        if (d < 2.6) candidates.push({ kind: 'fortune', id: 'fortune', label: 'Xin quẻ Từ Bi chỉ lối', d });
      }
      // Bảo Tháp Báo Ân 7 tầng
      {
        const d = Math.hypot(px - LAYOUT.stupa.x, pz - LAYOUT.stupa.z);
        if (d < 5.0) candidates.push({ kind: 'stupa', id: 'stupa', label: 'Chiêm bái Bảo Tháp Báo Ân 7 tầng', d });
      }
      // 2 Chú tiểu đi quanh chùa: khi lại gần (< 3.0m) có thể bắt chuyện hỏi thăm
      if (!activeMonk) {
        for (const mId of ['taman', 'tamminh'] as const) {
          const m = monksState[mId];
          const d = Math.hypot(px - m.x, pz - m.z);
          if (d < 3.0) {
            candidates.push({
              kind: 'monk',
              id: mId,
              label: `Trò chuyện cùng ${m.name}`,
              d,
            });
          }
        }
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
  }, [entered, mapOpen, sitPending, sweepPending, sweepDone, bathPending, boatPending, seatedSeat, carryingWater, waterStream, activeMonk]);

  const doCtxAction = () => {
    const a = ctxRef.current;
    if (!a) return;
    if (a.kind === 'seat') {
      const s = SEATS.find((x) => x.id === a.id);
      if (s) sitAtSeat(s);
    } else if (a.kind === 'meritBoard') {
      setMeritOpen(true);
    } else if (a.kind === 'monk') {
      openMonkModal(a.id as MonkId);
    } else if (a.kind === 'boat') {
      startBoatToHSK();
    } else if (a.kind === 'wishingRack') {
      setPlaqueOpen(true);
    } else if (a.kind === 'fortune') {
      setFortuneOpen(true);
      drawFortuneStick();
    } else if (a.kind === 'stupa') {
      setStupaModalOpen(true);
    } else if (a.kind === 'lantern') {
      setLanternModalOpen(true);
    } else if (a.kind === 'broom') {
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
      waterState.phase = 'carrying';
      waterState.progress = 0;
      showToast('🪣 Đã múc đầy một gáo nước gỗ — hãy cầm gáo bước tới luống rau Vườn Lộc Uyển để tưới.');
    } else if (a.kind === 'bed') {
      setWaterStream(true);
      setWaterProgress(0);
      waterState.phase = 'watering';
      waterState.progress = 0;
      touchFlame();
      const t0 = Date.now();
      const dur = 4200;
      const iv = setInterval(() => {
        const k = Math.min(1, (Date.now() - t0) / dur);
        waterState.progress = k;
        waterState.pourT = k;
        setWaterProgress(k);
        if (k >= 1) {
          clearInterval(iv);
          setWaterStream(false);
          waterState.phase = 'idle';
          setSoilWet(true);
          setCarryingWater(false);
          setWaterCardOpen(true);
          earnMerit('water_garden');
        }
      }, 60);
    } else if (a.kind === 'bath') {
      if (Math.hypot(controls.playerPos.x - LAYOUT.lumbiniSpot.x, controls.playerPos.z - LAYOUT.lumbiniSpot.z) < 0.45) {
        controls.bathAutoWalk = false;
        controls.pose = 'pray';
        bathState.phase = 'pray';
        controls.mode = 'bath';
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
      if (bellRinging || Date.now() < bellCooldownUntil.current) return;
      bellCooldownUntil.current = Date.now() + 5000;
      setBellRingSeq((s) => s + 1);
      setBellRinging(true);
      touchFlame();
      earnMerit('ring_bell');
      setTimeout(() => setBellRinging(false), 3000);
      const bell = bellRef.current;
      if (bell) {
        bell.currentTime = 0;
        bell.play().then(() => { setBellPlaying(true); }).catch(() => {});
      }
    }
  };
  // Cancel a sweep mid-way
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
  // Cancel a bath mid-way
  const cancelBath = () => {
    setBathPending(false);
    controls.bathAutoWalk = false;
    controls.moveTarget = null;
    controls.waypoints = [];
    controls.pose = 'stand';
    bathState.phase = 'idle';
    bathPrevRef.current = 'idle';
    setBathPhase('idle');
    if (controls.mode === 'bath') controls.mode = 'follow';
  };
  const goToZone = (zoneId: string) => {
    if (sweepState.phase !== 'idle') cancelSweep();
    if (bathState.phase !== 'idle') cancelBath();
    if (boatState.phase !== 'idle' || boatPending) cancelBoat();
    setMapOpen(false);
    if (zoneId === 'hsk') {
      startBoatToHSK();
      return;
    }
    const routes: Record<string, { target: { x: number; z: number }; via: Array<{ x: number; z: number }> }> = {
      hall: { target: LAYOUT.altarSpot, via: [{ x: -2.5, z: 0.5 }, { x: -2.5, z: -4.2 }, { x: 0, z: -4.2 }, { x: 0, z: -9 }] },
      burner: { target: LAYOUT.burnerApproach, via: [] },
      chant: { target: { x: -15.5, z: -13.0 }, via: [{ x: -3.5, z: 1.5 }, { x: -3.5, z: -5 }, { x: -15.5, z: -5 }] }, // same approach as westChant: the map 'chant' entry is labelled Đình Niệm Phật sân Tây, so it must route west, not to the removed hall spot
      westChant: { target: { x: -15.5, z: -13.0 }, via: [{ x: -3.5, z: 1.5 }, { x: -3.5, z: -5 }, { x: -15.5, z: -5 }] },
      stupaChant: { target: { x: 35.0, z: 5.8 }, via: [{ x: 14.5, z: 8 }, { x: 26, z: 8 }] },
      merit: { target: { ...LAYOUT.meritSpot }, via: [] },
      pond: { target: LAYOUT.pondApproach, via: [{ x: 0, z: 10 }, { x: -11.1, z: 10 }] },
      banyan: { target: LAYOUT.banyan, via: [{ x: 0, z: 10 }, { x: 14.5, z: 10 }, { x: 14.5, z: 8 }] },
      wishing: { target: LAYOUT.wishingSpot, via: [{ x: 0, z: 10 }, { x: 14.5, z: 10 }, { x: 14.5, z: 6.4 }] },
      stupa: { target: LAYOUT.stupaSpot, via: [{ x: 14.5, z: 2 }, { x: 14.5, z: -2.5 }] },
      garden: { target: LAYOUT.garden, via: [{ x: 14.5, z: 2 }, { x: 14.5, z: -6 }, { x: 14.5, z: -10 }, { x: 20.0, z: -10 }, { x: 26.5, z: -10 }] },
      tea: { target: { x: 38.3, z: -17.7 }, via: [{ x: 14.5, z: 2 }, { x: 14.5, z: -6 }, { x: 14.5, z: -10 }, { x: 20.0, z: -10 }, { x: 26.5, z: -10 }, { x: 36.5, z: -10 }, { x: 36.5, z: -14.0 }, { x: 38.3, z: -14.0 }] },
      bell: { target: { x: -22, z: -6.2 }, via: [{ x: -3.5, z: 1.5 }, { x: -3.5, z: -5 }, { x: -22, z: -5 }] },
      lumbini: { target: { ...LAYOUT.lumbiniSpot }, via: [{ x: -3.5, z: 1.5 }, { x: -3.5, z: -5 }, { x: -28, z: -5 }, { x: -28, z: -20.8 }] },
      gate: { target: { x: 0, z: 15 }, via: [] },
      pier: { target: { ...LAYOUT.pier }, via: [{ x: 0, z: 15 }] },
    };
    const r = routes[zoneId];
    if (r) {
      const px = controls.playerPos.x;
      const pz = controls.playerPos.z;
      const insideHall = px > -9.5 && px < 9.5 && pz > -26 && pz < -5.8;
      const via = insideHall && zoneId !== 'hall' && zoneId !== 'chant'
        ? [{ x: 0, z: -4.2 }, ...r.via]
        : r.via;
      goTo(r.target, via);
    }
  };
  const confirmWish = () => {
    const text = (wishChoice || wishText.trim() || 'Cầu bình an').slice(0, 200);
    setWishOpen(false);
    earnMerit('hall_pray', '🙏 Đã phát nguyện trong Chính điện');
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
        earnMerit('incense');
        setTimeout(() => {
          setRitual('none');
          setPrayerMessage('');
        }, 5000);
      }
    }, 100);
  };

  // Fish release: player gently bends at the pond bank holding a terracotta
  // bowl with both hands while the exact number of Koi (1, 2, or 3) leap
  // along a parabolic water arc into Tâm Liên Hồ.
  const confirmRelease = (count: number, blessing: boolean) => {
    const exactCount = (count >= 3 ? 3 : count === 2 ? 2 : 1) as 1 | 2 | 3;
    setReleaseOpen(false);
    setReleasingFish(true);
    setReleasingCount(exactCount);
    setReleaseProgress(0);
    releaseState.count = exactCount;
    releaseState.phase = 'releasing';
    releaseState.progress = 0;
    touchFlame();

    let spawnedInPond = false;
    const t0 = Date.now();
    const dur = 3200;
    const iv = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / dur);
      releaseState.progress = k;
      setReleaseProgress(k);
      if (!spawnedInPond && k >= 0.52) {
        spawnedInPond = true;
        setSpawnCount(exactCount);
        setSpawnTick((t) => t + 1);
        multiplayer.sendRelease();
      }
      if (k >= 1) {
        clearInterval(iv);
        releaseState.phase = 'idle';
        releaseState.progress = 0;
        setReleasingFish(false);
        earnMerit('fish_release');
        const msg = blessing
          ? `${name} vừa nhẹ tay thả ${exactCount} chú cá chép cầu bình an. Nguyện một niệm lành gửi theo làn nước.`
          : `Bạn đã nhẹ tay thả ${exactCount} chú cá chép xuống Tâm Liên Hồ. Chúc bạn thân tâm an yên.`;
        setReleaseMessage(msg);
        setTimeout(() => setReleaseMessage(''), 7000);
      }
    }, 50);
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
        <WorldErrorBoundary onRetry={() => setWorldKey((k) => k + 1)} onOpenMap={openMap}>
        <World
          key={worldKey}
          name={name || 'Khách'}
          gender={gender}
          rankBadge={currentRank.badge}
          rankTitle={currentRank.title}
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
          onSelectMonk={openMonkModal}
          onClickPierOrBoat={startBoatToHSK}
          onOpenHSKModal={() => setHskModalOpen(true)}
          onOpenMeritModal={() => setMeritOpen(true)}
        />
        </WorldErrorBoundary>
        ) : (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#fdf8ec] p-6 text-center">
          <div className="max-w-sm">
            <p className="font-serif text-xl text-amber-900">Chế độ nhẹ — không có khung cảnh 3D.</p>
            <p className="mt-2 text-sm text-stone-600">Thiết bị này không tạo được WebGL. Bạn vẫn xem được sơ đồ, đọc bài và nghe nhạc.</p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" onClick={openMap} className="rounded-full bg-amber-800 py-3 font-medium text-white">🗺 Mở sơ đồ chùa</button>
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
            <p className="text-[11px] text-stone-500">Đi dạo · Dâng hương · Niệm Phật · {currentRank.badge} {currentRank.title}</p>
          </div>
          <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setMeritOpen(true)}
              className="rounded-full border border-amber-400/80 bg-gradient-to-r from-amber-800 to-amber-700 px-3.5 py-2 text-sm font-medium text-white shadow backdrop-blur hover:from-amber-900 hover:to-amber-800"
            >
              🏆 Bảng Công Đức ({meritState.points})
            </button>
            <button
              type="button"
              onClick={() => setSeatsModalOpen(true)}
              className="rounded-full border border-amber-300/80 bg-amber-100/90 px-3.5 py-2 text-sm font-medium text-amber-950 shadow backdrop-blur hover:bg-amber-200"
            >
              🧘 Chỗ ngồi Niệm Kinh ({SEATS.length})
            </button>
            <button
              type="button"
              onClick={startBoatToHSK}
              className="rounded-full border border-amber-300/70 bg-amber-800 px-3.5 py-2 text-sm font-medium text-white shadow backdrop-blur hover:bg-amber-900"
            >
              ⛵ Đi thuyền → Đảo HSK
            </button>
            <button type="button" onClick={() => setSettingsOpen(true)} className="rounded-full border border-white/50 bg-white/70 px-3 py-2 text-sm shadow backdrop-blur">👤 {name}</button>
            <button type="button" onClick={() => setHelpOpen(true)} className="rounded-full border border-white/50 bg-white/70 px-3 py-2 text-sm shadow backdrop-blur">❓ Hướng dẫn</button>
            <button
              type="button"
              onClick={toggleSound}
              className="rounded-full border border-white/50 bg-white/70 px-3 py-2 text-sm shadow backdrop-blur"
              aria-label={soundPlaying ? 'Tắt âm thanh' : 'Bật âm thanh'}
            >
              {soundPlaying ? '🔊 Tắt âm thanh' : soundBlocked ? '🔇 Bật nhạc' : '🔇 Bật âm thanh'}
            </button>
            <button type="button" onClick={openMap} className="rounded-full border border-white/50 bg-white/70 px-3 py-2 text-sm shadow backdrop-blur">🗺 Sơ đồ chùa</button>
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
            <p className="whitespace-nowrap text-[10px] leading-tight text-stone-500">{currentRank.badge} {currentRank.title}</p>
          </div>
          <div className="pointer-events-auto flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => setMeritOpen(true)}
              aria-label="Mở bảng xếp hạng công đức"
              className="flex h-10 items-center justify-center rounded-full border border-amber-300 bg-amber-800 px-2.5 text-xs font-medium text-white shadow backdrop-blur"
            >
              🏆 {meritState.points}
            </button>
            <button
              type="button"
              onClick={() => setSeatsModalOpen(true)}
              aria-label="Chọn chỗ ngồi niệm kinh"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-white/70 text-base shadow backdrop-blur"
            >
              🧘
            </button>
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
              onClick={openMap}
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
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); setMeritOpen(true); }}
                className="rounded-xl bg-amber-800 px-4 py-3 text-left text-sm font-medium text-white shadow-sm"
              >
                🏆 Bảng Vàng Công Đức ({currentRank.badge} {currentRank.title} · {meritState.points} điểm)
              </button>
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); setSeatsModalOpen(true); }}
                className="rounded-xl bg-amber-100 px-4 py-3 text-left text-sm font-medium text-amber-950 shadow-sm"
              >
                🧘 Chọn chỗ ngồi Tọa Thiền & Niệm Kinh ({SEATS.length} vị trí)
              </button>
              <button
                type="button"
                onClick={startBoatToHSK}
                className="rounded-xl bg-amber-800 px-4 py-3 text-left text-sm font-medium text-white shadow-sm"
              >
                ⛵ Đi thuyền qua Sông Bát Nhã → Đảo HSK (hoc-hsk.vercel.app)
              </button>
              <button type="button" onClick={() => { setMobileMenuOpen(false); openMap(); }} className="rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm">🗺 Sơ đồ chùa</button>
              <button type="button" onClick={() => { setMobileMenuOpen(false); setSettingsOpen(true); }} className="rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm">👤 {name} — Đổi tên</button>
              <button type="button" onClick={() => { setMobileMenuOpen(false); setHelpOpen(true); }} className="rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm">❓ Hướng dẫn</button>
              <button type="button" onClick={() => { setMobileMenuOpen(false); goTo(LAYOUT.burnerApproach); }} className="rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm">🪔 Đến lư hương</button>
              <button type="button" onClick={() => { setMobileMenuOpen(false); goToZone('westChant'); }} className="rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm">📿 Đến khu niệm Phật</button>
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
                <button type="button" onClick={() => { setFortuneOpen(true); drawFortuneStick(); }} className="rounded-full bg-white/90 px-5 py-3 text-sm font-medium text-amber-900 shadow-xl ring-1 ring-amber-800/30">🎋 Xin quẻ Từ Bi</button>
              </div>
            ) : zone === 'pond' ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => setReleaseOpen(true)} className="rounded-full bg-amber-800 px-5 py-3 text-sm font-medium text-white shadow-xl">🐟 Phóng sinh cá chép</button>
                <button type="button" onClick={() => setLanternModalOpen(true)} className="rounded-full bg-white/90 px-5 py-3 text-sm font-medium text-amber-900 shadow-xl ring-1 ring-amber-800/30">🪷 Thả đèn Hoa Đăng</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => (zone === 'burner' ? startRitual() : setChantOpen(true))}
                className="rounded-full bg-amber-800 px-5 py-3 text-sm font-medium text-white shadow-xl"
              >
                {zone === 'burner' ? '🪔 Nhấn E hoặc chạm để dâng hương' : '📿 Nhấn E để niệm Phật'}
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
                <button type="button" onClick={() => { setFortuneOpen(true); drawFortuneStick(); }} className="max-w-[42vw] rounded-full bg-white/90 px-4 py-3 text-center text-sm font-medium text-amber-900 shadow-xl">🎋 Xin quẻ Từ Bi</button>
              </>
            ) : zone === 'pond' ? (
              <>
                <button type="button" onClick={() => setReleaseOpen(true)} className="max-w-[42vw] rounded-full bg-amber-800 px-4 py-3 text-center text-sm font-medium text-white shadow-xl">🐟 Phóng sinh</button>
                <button type="button" onClick={() => setLanternModalOpen(true)} className="max-w-[42vw] rounded-full bg-white/90 px-4 py-3 text-center text-sm font-medium text-amber-900 shadow-xl">🪷 Thả Hoa Đăng</button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => (zone === 'burner' ? startRitual() : setChantOpen(true))}
                className="max-w-[42vw] rounded-full bg-amber-800 px-4 py-3 text-center text-sm font-medium text-white shadow-xl"
              >
                {zone === 'burner' ? '🪔 Dâng hương' : '📿 Niệm Phật'}
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
        <div className="absolute bottom-24 left-3 z-20 hidden gap-2 sm:bottom-20 md:flex">
          <button type="button" onClick={openMap} className="rounded-full bg-white/80 px-4 py-2.5 text-sm shadow backdrop-blur">🗺 Sơ đồ chùa</button>
          <button type="button" onClick={() => setSeatsModalOpen(true)} className="rounded-full bg-amber-800/90 px-4 py-2.5 text-sm font-medium text-white shadow backdrop-blur hover:bg-amber-900">🧘 Chọn chỗ ngồi niệm kinh ({SEATS.length})</button>
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
              Tên hoặc Pháp danh của bạn
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
            <p className="mt-4 text-left text-sm font-medium text-stone-700">
              Chọn nhân vật & trang phục Phật tử
            </p>
            <div className="mt-1.5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => changeGender('female')}
                className={`flex flex-col items-center rounded-2xl border px-3 py-3 text-center transition ${
                  gender === 'female'
                    ? 'border-amber-800 bg-amber-800 text-white shadow'
                    : 'border-stone-300 bg-white text-stone-700 hover:border-amber-700/60'
                }`}
              >
                <span className="text-sm font-semibold">👩 Nữ Phật tử</span>
                <span className={`mt-0.5 text-[11px] ${gender === 'female' ? 'text-amber-100' : 'text-stone-500'}`}>
                  Áo lam cổ tàu vạt chéo · tóc búi cài trâm
                </span>
              </button>
              <button
                type="button"
                onClick={() => changeGender('male')}
                className={`flex flex-col items-center rounded-2xl border px-3 py-3 text-center transition ${
                  gender === 'male'
                    ? 'border-amber-800 bg-amber-800 text-white shadow'
                    : 'border-stone-300 bg-white text-stone-700 hover:border-amber-700/60'
                }`}
              >
                <span className="text-sm font-semibold">👨 Nam Phật tử</span>
                <span className={`mt-0.5 text-[11px] ${gender === 'male' ? 'text-amber-100' : 'text-stone-500'}`}>
                  Đồ lam cư sĩ nẹp thẳng · tóc ngắn gọn gàng
                </span>
              </button>
            </div>
            <button
              type="button"
              onClick={enterTemple}
              className="mt-5 w-full rounded-full bg-amber-800 py-3.5 text-base font-medium text-white shadow hover:bg-amber-900"
            >
              Bước vào chùa
            </button>
            <p className="mt-2 text-xs text-amber-800">Khi vào chùa, bạn sẽ nghe nhạc tĩnh tâm. Có thể tắt bằng nút loa.</p>
            <p className="mt-3 text-xs text-stone-500">
              Tên và hình mẫu nhân vật chỉ lưu trên thiết bị của bạn (localStorage), không cần tài khoản và không tự động công khai.
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
            <h2 className="font-serif text-xl font-semibold text-amber-900">Phóng sinh tại Tâm Liên Hồ</h2>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              Hai tay nâng bát sành, nhẹ nhàng nghiêng bát thả đúng số lượng cá chép xuống hồ sen,
              gửi một niệm lành theo làn nước mát.
            </p>
            <p className="mt-2 text-xs text-stone-500">Trải nghiệm mô phỏng — cá chỉ bơi trong hồ này, hồ chứa tối đa 18 con.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => confirmRelease(n, false)}
                  className="rounded-xl bg-amber-100 px-3 py-3 text-sm font-medium text-amber-900 hover:bg-amber-200"
                >
                  Thả {n} chú cá
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => confirmRelease(3, true)}
              className="mt-3 w-full rounded-full bg-amber-800 py-3 font-medium text-white shadow hover:bg-amber-900"
            >
              🪷 Thả 3 chú cá chép cầu bình an
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
      {entered && releasingFish && (
        <div className="absolute bottom-28 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-3xl bg-[#fdf8ec] p-4 text-center shadow-2xl sm:bottom-24">
          <p className="font-medium text-amber-900">
            🐟 Đang nhẹ tay thả {releasingCount} chú cá chép xuống Tâm Liên Hồ…
          </p>
          <p className="mt-1 text-xs text-stone-600">
            Nghiêng bát sành để đàn cá chép vẫy đuôi bơi vào làn nước mát.
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-amber-800 transition-all duration-100"
              style={{ width: `${Math.round(releaseProgress * 100)}%` }}
            />
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
          earnMerit('chant');
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
              <button type="button" onClick={() => { setDedicationOpen(false); setFinishedChant(null); }} className="rounded-full bg-stone-200 px-5 py-3">Đóng</button>
            </div>
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
              <li><strong>Phòng chung:</strong> khi phòng chung được bật, bạn sẽ thấy người khác cùng đi chùa trong cùng một phòng (tối đa 15 người/phòng, phòng đầy sẽ tự chuyển sang phòng khác). Số người và tên phòng hiện ở góc trên. Bạn có thể ẩn người khác hoặc bật chế độ riêng trong bảng Phòng chung. Nếu mất mạng, bạn vẫn đi chùa bình thường một mình.</li>
              <li>Lư hương luôn cố định — dâng hương của người khác chỉ hiện thêm một làn khói ngắn ở lư, không làm lư xoay hay thêm vô hạn que hương.</li>
              <li><strong>Nguồn âm thanh:</strong> nhạc nền đang phát là đoạn trích 5 phút (phút 10:00–15:00) từ bài “02 Nhac Thien Dan Tranh (Meditation Music) [60 min]” trong album Nhạc Thiền 1, trang <a className="underline" href="https://ph.tinhtong.vn/Home/MP3?p=MP3+Nhac*07+Nhac+Thien*Nhac+Thien+1&shem=aimgspe," target="_blank" rel="noreferrer">ph.tinhtong.vn — Nhạc Thiền 1</a>. Bài gốc dài 61 phút 20 giây, chỉ lấy 5 phút ở giữa để phát lặp, gắn fade-in 3 giây đầu và fade-out 3 giây cuối, mã hóa lại 128 kbps, không cắt nội dung khác. Trang nguồn không ghi rõ giấy phép; đây là nhạc Phật giáo chia sẻ trên trang Tịnh Tông, chùa dùng phi thương mại (không thu phí, không quảng cáo). Các bản trước (Tibetan Bowls, Kevin MacLeod) vẫn còn trong dự án nếu bạn muốn đổi lại.</li>
              <li><strong>Vườn Lâm Tỳ Ni – Tắm Phật:</strong> nằm trong khuôn viên chùa ở phía tây bắc, sau gác chuông — đi theo đường lát đá từ gác chuông về phía bắc. Giữa bồn nước hoa sen là tôn tượng Thái tử Tất Đạt Đa đản sinh đứng trên đài sen (tay trái chỉ trời, tay phải chỉ đất theo truyền thống Bắc tông Việt Nam). Tới gần bồn nước, bấm “Tắm Phật” để thực hiện nghi thức Mộc Dục mô phỏng (chắp tay, múc nước thơm, rưới ba gáo lên vai tôn tượng Thái tử, hồi hướng, khoảng 24 giây) hoặc “Tìm hiểu Phật đản” để đọc ý nghĩa và bật chế độ lễ hội.</li>
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
            <p className="mt-4 text-sm font-medium text-stone-700">Hình mẫu nhân vật Phật tử</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => changeGender('female')}
                className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition ${
                  gender === 'female'
                    ? 'border-amber-800 bg-amber-800 text-white'
                    : 'border-stone-300 bg-white text-stone-700'
                }`}
              >
                👩 Nữ Phật tử (Áo lam nữ)
              </button>
              <button
                type="button"
                onClick={() => changeGender('male')}
                className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition ${
                  gender === 'male'
                    ? 'border-amber-800 bg-amber-800 text-white'
                    : 'border-stone-300 bg-white text-stone-700'
                }`}
              >
                👨 Nam Phật tử (Đồ lam cư sĩ)
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                const clean = settingsName.trim().slice(0, 30);
                if (!clean) return;
                setName(clean);
                localStorage.setItem(NAME_KEY, clean);
                multiplayer.updateName(clean);
                showToast('Đã lưu cài đặt nhân vật ' + clean + '.');
                setSettingsOpen(false);
              }}
              className="mt-3 w-full rounded-full bg-amber-800 py-3 font-medium text-white"
            >
              Lưu tên & nhân vật
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
            <p className="mt-3 text-xs text-stone-500">Tên chỉ lưu trên thiết bị này. Nhạc nền tự phát khi vào chùa; tắt bằng nút loa, lựa chọn được nhớ cho lần sau.</p>
          </div>
        </div>
      )}


      {/* Context action: at most one, nearest object, stable prompt.
          Shows only when no existing zone prompt is active. */}
      {entered && zone === 'none' && !seatedSeat && !sitPending && hallRitual === 'none' && ritual === 'none' && !chantOpen && !releaseOpen && !releasingFish && !waterStream && !activeMonk && !mapOpen && ctxAction && (
        <>
          <div className="absolute bottom-28 left-1/2 z-20 hidden -translate-x-1/2 sm:bottom-24 md:block">
            {ctxAction.kind === 'bath' ? (
              <div className="flex gap-2">
                <button type="button" onClick={doCtxAction} className="rounded-full bg-amber-800 px-5 py-3 text-sm font-medium text-white shadow-xl">🪷 Tắm Phật</button>
                <button type="button" onClick={() => setVesakOpen(true)} className="rounded-full bg-white/85 px-5 py-3 text-sm font-medium text-amber-900 shadow-xl">📖 Tìm hiểu Phật đản</button>
              </div>
            ) : ctxAction.kind === 'boat' ? (
              <div className="flex gap-2">
                <button type="button" onClick={doCtxAction} className="rounded-full bg-amber-800 px-5 py-3 text-sm font-medium text-white shadow-xl">⛵ Đi thuyền sang Đảo HSK</button>
                <button type="button" onClick={() => setLanternModalOpen(true)} className="rounded-full bg-white/90 px-4 py-3 text-sm font-medium text-amber-900 shadow-xl">🪷 Thả Hoa Đăng</button>
                <a href={HSK_URL} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white/90 px-4 py-3 text-sm font-medium text-amber-900 shadow-xl">🌐 Mở hoc-hsk.vercel.app</a>
              </div>
            ) : (
              <button type="button" onClick={doCtxAction} className="rounded-full bg-amber-800 px-5 py-3 text-sm font-medium text-white shadow-xl">
                {ctxAction.kind === 'seat'
                  ? '🧘 '
                  : ctxAction.kind === 'broom'
                    ? '🧹 '
                    : ctxAction.kind === 'jar'
                      ? '🪣 '
                      : ctxAction.kind === 'bed'
                        ? '💧 '
                        : ctxAction.kind === 'bell'
                          ? '🔔 '
                          : ctxAction.kind === 'monk'
                            ? '🙏 '
                            : ctxAction.kind === 'wishingRack'
                              ? '🎋 '
                              : ctxAction.kind === 'fortune'
                                ? '🎋 '
                                : ctxAction.kind === 'stupa'
                                  ? '🏯 '
                                  : ctxAction.kind === 'meritBoard'
                                    ? '🏆 '
                                    : '📖 '}
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
            ) : ctxAction.kind === 'boat' ? (
              <>
                <button type="button" onClick={doCtxAction} className="max-w-[46vw] rounded-full bg-amber-800 px-4 py-3 text-center text-sm font-medium text-white shadow-xl">⛵ Đi thuyền → Đảo HSK</button>
                <a href={HSK_URL} target="_blank" rel="noopener noreferrer" className="max-w-[46vw] rounded-full bg-white/90 px-4 py-2.5 text-center text-xs font-medium text-amber-900 shadow-xl">🌐 hoc-hsk.vercel.app</a>
              </>
            ) : (
              <button type="button" onClick={doCtxAction} className="max-w-[42vw] rounded-full bg-amber-800 px-4 py-3 text-center text-sm font-medium text-white shadow-xl">
                {ctxAction.label}
              </button>
            )}
          </div>
        </>
      )}

      {/* Seated on a usable seat: open Sutra Chanting panel, stand up, walk back to the aisle/path. */}
      {entered && seatedSeat && (
        <>
          <div className="absolute bottom-28 left-1/2 z-20 hidden -translate-x-1/2 gap-2 sm:bottom-24 md:flex">
            <span className="rounded-full bg-black/55 px-4 py-3 text-sm text-amber-50">{seatedSeat.area === 'lake' ? 'Đang ngắm hồ — giao diện đã thu gọn' : `Đang ngồi: ${seatedSeat.label}`}</span>
            <button type="button" onClick={() => setChantOpen(true)} className="rounded-full bg-amber-800 px-5 py-3 text-sm font-medium text-white shadow-xl hover:bg-amber-900">📿 Mở Kinh Niệm Phật</button>
            {seatedSeat.area === 'tea' && (
              <button type="button" onClick={() => setReadingOpen(true)} className="rounded-full bg-amber-100 px-5 py-3 text-sm font-medium text-amber-900 shadow-xl">📖 Mở hiên đọc</button>
            )}
            <button type="button" onClick={standUpSeat} className="rounded-full bg-white/85 px-5 py-3 text-sm font-medium text-amber-900 shadow-xl">Đứng dậy</button>
          </div>
          <div className="absolute right-3 z-20 flex flex-col items-end gap-2 md:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <span className="max-w-[42vw] rounded-full bg-black/55 px-3 py-2 text-center text-xs text-amber-50">{seatedSeat.area === 'lake' ? 'Đang ngắm hồ' : seatedSeat.label}</span>
            <button type="button" onClick={() => setChantOpen(true)} className="max-w-[44vw] rounded-full bg-amber-800 px-4 py-3 text-center text-sm font-medium text-white shadow-xl">📿 Niệm Kinh</button>
            {seatedSeat.area === 'tea' && (
              <button type="button" onClick={() => setReadingOpen(true)} className="max-w-[44vw] rounded-full bg-amber-100 px-4 py-2.5 text-center text-xs font-medium text-amber-900 shadow-xl">📖 Hiên đọc</button>
            )}
            <button type="button" onClick={standUpSeat} className="max-w-[42vw] rounded-full bg-white/85 px-4 py-3 text-center text-sm font-medium text-amber-900 shadow-xl">Đứng dậy</button>
          </div>
        </>
      )}
      {entered && sitPending && (
        <div className="pointer-events-none absolute bottom-32 left-1/2 z-30 -translate-x-1/2">
          <p className="rounded-full bg-black/60 px-4 py-2 text-sm text-amber-50">Đang đi đến chỗ ngồi…</p>
        </div>
      )}

      {/* Sweep leaves bar (Request C): auto flow, 13s total. */}
      {entered && sweepPhase !== 'idle' && (
        <div className="absolute bottom-28 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-3xl bg-[#fdf8ec] p-4 text-center shadow-2xl sm:bottom-24">
          <p className="font-medium text-amber-900">🧹 Đang quét lá dưới gốc đa Bách Linh</p>
          <p className="mt-1 text-sm text-stone-600">{sweepPhase === 'preparing' ? 'Chuẩn bị: hai tay cầm cán chổi tre, chổi chạm sân gạch…' : sweepPhase === 'sweeping' ? 'Đang đưa chổi ngang gom lá — từng nhát chổi đều đặn gom lá về một cụm.' : sweepPhase === 'gathering' ? 'Gom lá — đống lá đa đang thu dần gọn gàng vào giỏ.' : 'Xong rồi — sân sạch, một phút giây an yên.'}{sweepPaused ? ' (đang tạm dừng)' : ''}</p>
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
      {/* Bath ritual bar (Request E): 24s total */}
      {entered && bathPhase !== 'idle' && bathPhase !== 'done' && (
        <div className="absolute bottom-28 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-3xl bg-[#fdf8ec] p-4 text-center shadow-2xl sm:bottom-24">
          <p className="font-medium text-amber-900">🪷 Đang tắm Phật — lễ đài Lâm Tỳ Ni</p>
          <p className="mt-1 text-sm text-stone-600">{bathPhase === 'pray' ? 'Chắp tay — cung kính trước tôn tượng Thái tử Tất Đạt Đa đản sinh.' : bathPhase === 'scoop' ? 'Múc nước thơm — gáo chạm mặt nước hoa sen, nâng lên nhẹ nhàng.' : bathPhase === 'pour' ? `Gáo ${bathPourRound}/3 — rưới nước thơm tắm tôn tượng Thái tử, nguyện thân tâm thanh tịnh.` : 'Hoàn tất — đặt gáo về kệ, chắp tay hồi hướng.'}</p>
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
              <button type="button" onClick={() => { setBathBlessingOpen(false); bathState.phase = 'idle'; if (controls.mode === 'bath') controls.mode = 'follow'; bathPrevRef.current = 'idle'; setBathPhase('idle'); }} className="rounded-full bg-stone-200 px-5 py-3">Đóng</button>
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
            <button type="button" onClick={() => { setVesakOpen(false); if (bathState.phase === 'done') { bathState.phase = 'idle'; bathPrevRef.current = 'idle'; setBathPhase('idle'); if (controls.mode === 'bath') controls.mode = 'follow'; } }} className="mt-4 w-full rounded-full bg-amber-800 py-3 font-medium text-white">Đã hiểu</button>
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

      {/* Water vegetables progress bar & card */}
      {entered && waterStream && (
        <div className="absolute bottom-28 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-3xl bg-[#fdf8ec] p-4 text-center shadow-2xl sm:bottom-24">
          <p className="font-medium text-amber-900">🌱 Đang nghiêng gáo tưới rau Vườn Lộc Uyển…</p>
          <p className="mt-1 text-xs text-stone-600">
            Từng gáo nước mát lành thấm dần xuống các luống rau xanh.
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-emerald-700 transition-all duration-100"
              style={{ width: `${Math.round(waterProgress * 100)}%` }}
            />
          </div>
        </div>
      )}
      {waterCardOpen && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/25 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-[#fdf8ec] p-5 shadow-2xl">
            <h2 className="font-serif text-xl font-semibold text-amber-900">Đã tưới xong một lượt</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">Đất đã sẫm lại, lá rau xanh mát. Chăm vườn cũng giống chăm một việc chung: không cần tưới thật nhiều một lần, chỉ cần đều đặn, đúng chỗ, và để ý xem cây đang cần gì. Một lượt là đủ cho hôm nay.</p>
            <button type="button" onClick={() => setWaterCardOpen(false)} className="mt-4 w-full rounded-full bg-amber-800 py-3 font-medium text-white">Đã hiểu</button>
          </div>
        </div>
      )}
      {entered && carryingWater && !waterStream && (
        <div className="pointer-events-none absolute bottom-32 left-1/2 z-30 -translate-x-1/2">
          <p className="rounded-full bg-black/65 px-4 py-2 text-sm text-amber-50 shadow">
            🪣 Đang cầm gáo nước gỗ — hãy bước tới luống rau Vườn Lộc Uyển để tưới.
          </p>
        </div>
      )}

      {/* Main Hall slow-walk banner & explanation modal */}
      {entered && inHall && !seatedSeat && hallRitual === 'none' && (
        <div className="pointer-events-auto absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-200/50 bg-stone-900/75 px-4 py-1.5 text-xs text-amber-100 shadow-lg backdrop-blur top-[calc(env(safe-area-inset-top)+56px)] md:top-16">
          <span>🙏 Trong Chính điện: Đang đi chậm rãi, nhẹ bước</span>
          <button
            type="button"
            onClick={() => setHallWhyOpen(true)}
            className="rounded-full bg-amber-700/80 px-2.5 py-0.5 text-[11px] font-medium text-white hover:bg-amber-600"
          >
            Vì sao?
          </button>
        </div>
      )}
      {hallWhyOpen && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-[#fdf8ec] p-5 shadow-2xl">
            <h2 className="font-serif text-xl font-semibold text-amber-900">
              Vì sao vào Chính điện cần đi chậm?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">
              Tại các ngôi chùa truyền thống Việt Nam, Chính điện (Tam Bảo) là không gian tôn nghiêm nhất — nơi thờ Phật và là chỗ mọi người đang tĩnh tâm lễ bái, tụng kinh hoặc ngồi thiền.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">
              Khi bước qua ngưỡng cửa vào Chính điện, người Phật tử tự giác <b>“đi nhẹ bước êm, nói khẽ mỉm cười”</b>:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-stone-700">
              <li>Giữ không gian thanh tịnh, không gây tiếng động làm ảnh hưởng đến những người đang lễ Phật và tọa thiền xung quanh.</li>
              <li>Thể hiện lòng cung kính trước Tam Bảo qua từng bước chân khoan thai, chánh niệm.</li>
              <li>Giúp chính tâm mình chậm lại, buông bớt sự vội vã ngoài đời trước khi chắp tay lễ Phật.</li>
            </ul>
            <button
              type="button"
              onClick={() => setHallWhyOpen(false)}
              className="mt-4 w-full rounded-full bg-amber-800 py-3 font-medium text-white"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      {/* 2 Chú Tiểu (Tâm An & Tâm Minh) interactive dialogue modal */}
      {activeMonk && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 p-4 sm:items-center">
          <div className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-amber-900/20 bg-[#fdf8ec] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
                  {monksState[activeMonk].title}
                </p>
                <h2 className="font-serif text-xl font-semibold text-amber-900">
                  🙏 {monksState[activeMonk].name}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeMonkModal}
                className="rounded-full bg-stone-200 px-3 py-1 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Dialogue content based on selected topic */}
            <div className="mt-3 rounded-2xl border border-amber-900/15 bg-white p-4 text-sm leading-relaxed text-stone-700 shadow-inner">
              {monkTopic === 'welcome' && (
                <>
                  <p className="font-medium text-amber-900">
                    “A Di Đà Phật! Chú tiểu {activeMonk === 'taman' ? 'Tâm An' : 'Tâm Minh'} xin chắp tay kính chào Phật tử {name || 'Khách'}!”
                  </p>
                  <p className="mt-2">
                    {activeMonk === 'taman'
                      ? 'Sáng nay gió mát, lá sen bên Tâm Liên Hồ thơm dịu lắm ạ. Chú đang đi kinh hành quanh sân Tây, trông coi Gác Chuông và lễ đài Tắm Phật Vườn Lâm Tỳ Ni. Phật tử có điều gì muốn hỏi chú tiểu không ạ?'
                      : 'Chú vừa quét xong mấy chiếc lá đa bên gốc đa Bách Linh và thăm luống rau xanh ở Vườn Lộc Uyển. Phật tử đi dạo chùa có thấy lòng nhẹ nhàng hơn chút nào chưa ạ?'}
                  </p>
                </>
              )}

              {monkTopic === 'etiquette' && (
                <>
                  <p className="font-medium text-amber-900">
                    🌿 Nét đẹp & quy tắc khi đi chùa ngoài đời thực:
                  </p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs sm:text-sm">
                    <li>
                      <b>Qua cổng Tam Quan:</b> Ở chùa thật, khách thập phương thường đi vào bằng cửa bên phải (cửa Giả) và đi ra bằng cửa bên trái (cửa Không), nhường cửa chính giữa (Trung đạo) cho bậc cao tăng và các nghi lễ trọng đại.
                    </li>
                    <li>
                      <b>Bước qua bậu cửa gỗ:</b> Khi bước vào Chính điện, ông bà ta dặn bước hẳn qua thanh bậu cửa gỗ dưới chân chứ không giẫm lên, vừa giữ vẻ trang nghiêm vừa tránh trượt chân.
                    </li>
                    <li>
                      <b>Thắp hương vừa đủ:</b> Khi lễ chùa thật, chỉ cần dâng 1 nén tâm hương (hoặc 3 nén) ở lư hương đồng ngoài sân trước để giữ không khí trong Chính điện thoáng sạch, an toàn.
                    </li>
                    <li>
                      <b>Trang phục & bước chân:</b> Mặc đồ lam hoặc quần áo kín đáo, lịch sự; khi vào Chính điện thì đi chậm, nói khẽ để giữ sự tĩnh lặng chung.
                    </li>
                  </ul>
                </>
              )}

              {monkTopic === 'daily' && (
                <>
                  <p className="font-medium text-amber-900">
                    🔔 Một ngày tu học ở chùa của chú tiểu:
                  </p>
                  <p className="mt-1.5 text-xs sm:text-sm">
                    Nhiều người tưởng ở chùa cả ngày chỉ ngồi im, nhưng thật ra ngày của chú tiểu vui và đều đặn lắm ạ:
                  </p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs sm:text-sm">
                    <li><b>4h00 sáng (Công phu khuya):</b> Thức dậy khi tiếng đại hồng chung ngân vang giữa sương sớm, cùng đại chúng tụng kinh cầu quốc thái dân an.</li>
                    <li><b>Buổi sáng (Chấp tác):</b> Quét lá đa rụng ngoài sân gạch, múc nước giếng tưới rau ở Vườn Lộc Uyển, lau dọn bàn thờ và học chữ, học giáo lý.</li>
                    <li><b>Buổi chiều & tối:</b> Học oai nghi người tu, đi kinh hành chậm rãi quanh hồ sen và tĩnh tọa lắng tâm trước giờ chỉ tịnh.</li>
                  </ul>
                </>
              )}

              {monkTopic === 'blessing' && (
                <>
                  <p className="font-medium text-amber-900">
                    🪷 Lời nhắn nhủ bình an hôm nay từ {monksState[activeMonk].name}:
                  </p>
                  <p className="mt-2 italic text-stone-800">
                    {[
                      '“Đi chùa không nhất thiết phải cầu xin thật nhiều điều lớn lao. Chỉ cần khi bước ra khỏi cổng chùa, lòng mình bớt đi một chút nóng giận, biết nói lời dịu dàng hơn với cha mẹ và người thương — đó đã là phước lành lớn nhất rồi ạ.”',
                      '“Giống như quét lá đa ngoài sân chùa: hôm nay quét sạch, mai lá lại rơi, nhưng khi quét mình cứ vui vẻ với từng nhát chổi. Việc học, việc làm ngoài đời cũng vậy — cứ làm trọn vẹn từng việc nhỏ trước mắt, đừng để lo âu ngày mai làm mỏi mệt hôm nay.”',
                      '“Mỗi khi thấy lòng bất an hay áp lực, Phật tử hãy thử dừng lại vài giây, thở vào thật sâu như đang đứng bên bờ Tâm Liên Hồ, rồi thở ra thật chậm. Tâm lắng trong thì chuyện rối đến mấy cũng sẽ tìm được lối mở.”',
                      '“Hai vị Phật gần gũi nhất trong mỗi gia đình chính là Cha và Mẹ. Hôm nay về nhà, Phật tử nhớ hỏi thăm hoặc mỉm cười thật ấm áp với người thân của mình nhé ạ!”',
                    ][monkBlessingIdx % 4]}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setMonkBlessingIdx((i) => i + 1)}
                      className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-200"
                    >
                      🔄 Nghe lời nhắn khác
                    </button>
                  </div>
                </>
              )}

              {monkTopic === 'wayfinding' && (
                <>
                  <p className="font-medium text-amber-900">
                    🗺 Chú tiểu chỉ đường thăm Chùa Hải An:
                  </p>
                  <p className="mt-1 text-xs text-stone-600">
                    Chọn nơi muốn ghé thăm, chú tiểu sẽ chỉ lối để nhân vật tự bước đến đó:
                  </p>
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    {([
                      ['burner', '🪔 Lư hương đồng'],
                      ['hall', '🏯 Vào Chính điện (16 tọa cụ)'],
                      ['westChant', '🧘 Niệm Phật Đường Tây (8 tọa cụ)'],
                      ['stupaChant', '📿 Đài Niệm Kinh Bảo Tháp (6 tọa cụ)'],
                      ['merit', '🏆 Đài Bia Vàng Công Đức'],
                      ['stupa', '🏯 Bảo Tháp Báo Ân 7 tầng'],
                      ['wishing', '🎋 Thẻ ước nguyện Bồ Đề'],
                      ['pond', '🪷 Tâm Liên Hồ'],
                      ['lumbini', '🙏 Vườn Lâm Tỳ Ni'],
                      ['banyan', '🌳 Cây đa Bách Linh'],
                      ['garden', '🥬 Vườn Lộc Uyển'],
                      ['bell', '🔔 Gác Chuông'],
                      ['tea', '🍵 Nhà Trà · Hiên đọc'],
                      ['hsk', '⛵ Đi thuyền → Đảo HSK'],
                    ] as const).map(([zId, zLabel]) => (
                      <button
                        key={zId}
                        type="button"
                        onClick={() => {
                          closeMonkModal();
                          goToZone(zId);
                        }}
                        className="rounded-xl border border-amber-800/20 bg-amber-50/80 px-3 py-2 text-left text-xs font-medium text-amber-900 hover:bg-amber-100"
                      >
                        {zLabel}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Topic selector buttons */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMonkTopic('etiquette')}
                className={`rounded-xl px-3 py-2.5 text-xs font-medium transition ${
                  monkTopic === 'etiquette'
                    ? 'bg-amber-800 text-white'
                    : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                }`}
              >
                🌿 Quy tắc đi chùa thật
              </button>
              <button
                type="button"
                onClick={() => setMonkTopic('daily')}
                className={`rounded-xl px-3 py-2.5 text-xs font-medium transition ${
                  monkTopic === 'daily'
                    ? 'bg-amber-800 text-white'
                    : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                }`}
              >
                🔔 Một ngày của chú tiểu
              </button>
              <button
                type="button"
                onClick={() => setMonkTopic('blessing')}
                className={`rounded-xl px-3 py-2.5 text-xs font-medium transition ${
                  monkTopic === 'blessing'
                    ? 'bg-amber-800 text-white'
                    : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                }`}
              >
                🪷 Xin lời nhắn bình an
              </button>
              <button
                type="button"
                onClick={() => setMonkTopic('wayfinding')}
                className={`rounded-xl px-3 py-2.5 text-xs font-medium transition ${
                  monkTopic === 'wayfinding'
                    ? 'bg-amber-800 text-white'
                    : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                }`}
              >
                🗺 Nhờ chú tiểu chỉ đường
              </button>
            </div>

            <button
              type="button"
              onClick={closeMonkModal}
              className="mt-3 w-full rounded-full bg-stone-200 py-2.5 text-sm font-medium text-stone-700"
            >
              Chắp tay chào chú tiểu
            </button>
          </div>
        </div>
      )}

      {/* Bell indicator */}
      {bellPlaying && (
        <div className="pointer-events-none absolute bottom-32 left-1/2 z-30 -translate-x-1/2">
          <p className="rounded-full bg-black/60 px-4 py-2 text-sm text-amber-50">🔔 Đang thỉnh chuông — hãy để âm ngân hết.</p>
        </div>
      )}

      {/* =====================================================================
          BOAT RIDE OVER SÔNG BÁT NHÃ & ĐẢO HSK PORTAL (https://hoc-hsk.vercel.app/)
         ===================================================================== */}
      {entered && (boatPhase === 'sailing_to_hsk' || boatPhase === 'sailing_back') && (
        <div className="absolute bottom-28 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-3xl border border-amber-900/20 bg-[#fdf8ec]/95 p-4 text-center shadow-2xl sm:bottom-24">
          <p className="font-serif text-base font-semibold text-amber-900">
            {boatPhase === 'sailing_to_hsk'
              ? '⛵ Đang chèo thuyền qua Sông Bát Nhã sang Hòn Đảo HSK…'
              : '⛵ Đang chèo thuyền từ Đảo HSK trở về Bến Thuyền Chùa Hải An…'}
          </p>
          <p className="mt-1 text-xs text-stone-600">
            {boatPhase === 'sailing_to_hsk'
              ? 'Thuyền gỗ lướt nhẹ giữa làn nước ngọc và những đóa hoa đăng, hướng về Lầu Văn Hiến Đảo HSK.'
              : 'Ngắm nhìn Đại Hùng Bảo Điện 3 tầng, Cổng Tam Quan Gác và Bảo Tháp 7 tầng từ giữa dòng sông.'}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-amber-800 transition-all duration-100"
              style={{ width: `${Math.round(boatProgress * 100)}%` }}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <a
              href={HSK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-full bg-amber-800 py-2.5 text-xs font-medium text-white shadow hover:bg-amber-900"
            >
              🌐 Mở ngay Học HSK (hoc-hsk.vercel.app)
            </a>
            <button
              type="button"
              onClick={cancelBoat}
              className="rounded-full bg-stone-200 px-4 py-2.5 text-xs font-medium text-stone-700"
            >
              Về bến ngay
            </button>
          </div>
        </div>
      )}

      {entered && boatPhase === 'at_hsk' && !hskModalOpen && (
        <div className="absolute bottom-28 left-1/2 z-20 flex -translate-x-1/2 flex-wrap justify-center gap-2 sm:bottom-24">
          <button
            type="button"
            onClick={() => setHskModalOpen(true)}
            className="rounded-full bg-amber-800 px-5 py-3 text-sm font-medium text-white shadow-xl"
          >
            🏝️ Mở cổng Học Viện Đảo HSK
          </button>
          <a
            href={HSK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-emerald-800 px-5 py-3 text-sm font-medium text-white shadow-xl"
          >
            🌐 Vào hoc-hsk.vercel.app
          </a>
          <button
            type="button"
            onClick={sailBackFromHSK}
            className="rounded-full bg-white/90 px-5 py-3 text-sm font-medium text-amber-900 shadow-xl"
          >
            ⛵ Chèo thuyền về lại Bến Chùa
          </button>
        </div>
      )}

      {hskModalOpen && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-amber-900/20 bg-[#fdf8ec] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  🏝️ Bến Trí Tuệ · Sông Bát Nhã
                </p>
                <h2 className="font-serif text-2xl font-semibold text-amber-900">
                  Hòn Đảo HSK · Học Viện Hán Ngữ
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setHskModalOpen(false)}
                className="rounded-full bg-stone-200 px-3 py-1 text-sm"
              >
                ✕
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">
              Chào mừng <b>{name || 'Phật tử'}</b> đã qua dòng <b>Sông Bát Nhã</b> đặt chân tới <b>Hòn Đảo HSK</b>!
              Giữa rừng hoa đào nở rộ và Lầu Văn Hiến 2 tầng, đây là không gian kết nối tinh thần hiếu học,
              rèn luyện Hán ngữ và ôn thi HSK mỗi ngày với tâm thế an nhiên, bền bỉ.
            </p>
            <div className="mt-3 rounded-2xl border border-amber-800/20 bg-amber-50/90 p-3.5 text-xs leading-relaxed text-amber-950">
              <p className="font-semibold">✨ Cổng học tập trực tuyến:</p>
              <p className="mt-1 break-all font-mono text-amber-800 underline">{HSK_URL}</p>
              <p className="mt-1 text-stone-600">
                Luyện từ vựng, ngữ pháp, đề thi HSK các cấp với giao diện trực quan, dễ nhớ.
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              <a
                href={HSK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-800 py-3.5 text-center text-sm font-semibold text-white shadow-lg transition hover:bg-amber-900"
              >
                🌐 Truy cập ngay Học HSK (hoc-hsk.vercel.app) ↗
              </a>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHskModalOpen(false);
                    setLanternWish('Cầu học tập tinh tấn, trí tuệ sáng suốt, thi đỗ HSK điểm cao');
                    setLanternModalOpen(true);
                  }}
                  className="rounded-full bg-amber-100 py-2.5 text-xs font-medium text-amber-900 hover:bg-amber-200"
                >
                  🪷 Thả Hoa Đăng cầu thi đỗ
                </button>
                {boatPhase === 'at_hsk' ? (
                  <button
                    type="button"
                    onClick={sailBackFromHSK}
                    className="rounded-full bg-stone-200 py-2.5 text-xs font-medium text-stone-800 hover:bg-stone-300"
                  >
                    ⛵ Đi thuyền về Chùa
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setHskModalOpen(false);
                      startBoatToHSK();
                    }}
                    className="rounded-full bg-stone-200 py-2.5 text-xs font-medium text-stone-800 hover:bg-stone-300"
                  >
                    ⛵ Lên thuyền chèo ra Đảo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          1. XIN XÂM / GIEO QUẺ TỪ BI ĐẦU NĂM (Ống xâm Quán Thế Âm)
         ===================================================================== */}
      {fortuneOpen && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-amber-900/20 bg-[#fdf8ec] p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
                  🎋 Nét đẹp văn hóa chùa Việt
                </p>
                <h2 className="font-serif text-xl font-semibold text-amber-900">
                  Gieo Quẻ Từ Bi · Pháp Ngữ Đầu Năm
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setFortuneOpen(false)}
                className="rounded-full bg-stone-200 px-3 py-1 text-sm"
              >
                ✕
              </button>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
              Khác với bói toán mê tín, gieo quẻ Từ Bi tại chùa là dịp lắng tâm đón nhận một lời kệ nhắc nhở mình sống thiện lành, hiếu thảo và nỗ lực trong học tập, công việc.
            </p>

            {fortuneShaking || fortuneStickIdx === null ? (
              <div className="my-6 flex flex-col items-center justify-center rounded-2xl border border-amber-800/20 bg-white p-6 text-center">
                <p className="animate-bounce text-4xl">🎋</p>
                <p className="mt-2 font-serif text-base font-medium text-amber-900">
                  Đang thành tâm lắc ống xâm tre trước Phật đài…
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Hãy hít thở nhẹ nhàng và khởi một niệm lành.
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-amber-800/25 bg-white p-4 shadow-inner">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Quẻ số {FORTUNE_STICKS[fortuneStickIdx].num}
                </p>
                <h3 className="mt-0.5 font-serif text-lg font-bold text-amber-900">
                  {FORTUNE_STICKS[fortuneStickIdx].rank}
                </h3>
                <pre className="mt-2.5 whitespace-pre-wrap rounded-xl bg-amber-50/90 p-3 font-serif text-sm italic leading-relaxed text-amber-950">
                  {FORTUNE_STICKS[fortuneStickIdx].verse}
                </pre>
                <p className="mt-3 text-xs leading-relaxed text-stone-700">
                  <b>Ý nghĩa lời kệ:</b> {FORTUNE_STICKS[fortuneStickIdx].meaning}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-emerald-900">
                  <b>🌱 Thực tập hôm nay:</b> {FORTUNE_STICKS[fortuneStickIdx].practice}
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={drawFortuneStick}
                disabled={fortuneShaking}
                className="rounded-full bg-amber-100 px-4 py-2.5 text-xs font-medium text-amber-900 hover:bg-amber-200 disabled:opacity-50"
              >
                🔄 Gieo lại quẻ khác
              </button>
              <button
                type="button"
                onClick={() => setFortuneOpen(false)}
                className="rounded-full bg-stone-200 px-4 py-2.5 text-xs font-medium text-stone-700"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. TREO THẺ GỖ ƯỚC NGUYỆN BỒ ĐỀ (Cạnh Cây đa Bách Linh)
         ===================================================================== */}
      {plaqueOpen && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-amber-900/20 bg-[#fdf8ec] p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
                  🌳 Dưới bóng Cây đa Bách Linh
                </p>
                <h2 className="font-serif text-xl font-semibold text-amber-900">
                  Treo Thẻ Gỗ Ước Nguyện Bồ Đề
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPlaqueOpen(false)}
                className="rounded-full bg-stone-200 px-3 py-1 text-sm"
              >
                ✕
              </button>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
              Tại nhiều ngôi chùa Việt Nam, Phật tử và sĩ tử thường ghi lời cầu bình an cho cha mẹ hoặc ước nguyện học tập, thi cử đỗ đạt lên thẻ gỗ đỏ thếp vàng treo dưới cội đa / cội Bồ Đề.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                'Cầu học tập tinh tấn · Thi đỗ HSK điểm cao',
                'Cầu cha mẹ và gia đình bình an, mạnh khỏe',
                'Cầu tâm bình khí hòa, công việc hanh thông',
                'Cầu thiện duyên hội tụ, vạn sự cát tường',
              ].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setPlaqueCategory(cat);
                    setPlaqueWish(cat);
                  }}
                  className={`rounded-xl px-3 py-2 text-left text-xs transition ${
                    plaqueCategory === cat ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-xs font-medium text-stone-700" htmlFor="plaque-wish">
              Viết lời ước nguyện lên thẻ gỗ Bồ Đề
            </label>
            <textarea
              id="plaque-wish"
              value={plaqueWish}
              maxLength={180}
              rows={3}
              onChange={(e) => setPlaqueWish(e.target.value)}
              placeholder="Ví dụ: Nguyện cầu cha mẹ mạnh khỏe, kỳ thi HSK sắp tới đạt kết quả tốt…"
              className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-700"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={confirmHangPlaque}
                className="flex-1 rounded-full bg-amber-800 py-3 text-sm font-medium text-white shadow hover:bg-amber-900"
              >
                🎋 Treo thẻ lên giá gỗ
              </button>
              <button
                type="button"
                onClick={() => setPlaqueOpen(false)}
                className="rounded-full bg-stone-200 px-5 py-3 text-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. THẢ ĐÈN HOA ĐĂNG CẦU AN (Tâm Liên Hồ & Sông Bát Nhã)
         ===================================================================== */}
      {lanternModalOpen && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-amber-900/20 bg-[#fdf8ec] p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
                  🪷 Ánh sáng Từ Bi & Trí Tuệ
                </p>
                <h2 className="font-serif text-xl font-semibold text-amber-900">
                  Thắp Đèn Hoa Đăng Cầu Nguyện
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setLanternModalOpen(false)}
                className="rounded-full bg-stone-200 px-3 py-1 text-sm"
              >
                ✕
              </button>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
              Trong văn hóa Phật giáo Việt Nam, mỗi ngọn đèn Hoa Đăng được thắp lên và thả xuống dòng nước tượng trưng cho ánh sáng trí tuệ soi tỏ vô minh, gửi gắm tâm niệm bình an và hiếu kính.
            </p>
            <textarea
              value={lanternWish}
              maxLength={180}
              rows={3}
              onChange={(e) => setLanternWish(e.target.value)}
              placeholder="Gửi lời nguyện theo ngọn đèn Hoa Đăng…"
              className="mt-3 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-700"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={confirmReleaseLantern}
                className="flex-1 rounded-full bg-amber-800 py-3 text-sm font-medium text-white shadow hover:bg-amber-900"
              >
                🪷 Thả đèn Hoa Đăng xuống nước
              </button>
              <button
                type="button"
                onClick={() => setLanternModalOpen(false)}
                className="rounded-full bg-stone-200 px-5 py-3 text-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          4. BẢO THÁP BÁO ÂN 7 TẦNG & KINH HÀNH NHIỄU THÁP
         ===================================================================== */}
      {stupaModalOpen && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-amber-900/20 bg-[#fdf8ec] p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
                  🏯 Kiến trúc Phật giáo truyền thống
                </p>
                <h2 className="font-serif text-xl font-semibold text-amber-900">
                  Bảo Tháp Báo Ân 7 Tầng · Tứ Trọng Ân
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setStupaModalOpen(false)}
                className="rounded-full bg-stone-200 px-3 py-1 text-sm"
              >
                ✕
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">
              <b>Bảo Tháp Báo Ân</b> cao 7 tầng mái đao bát giác biểu trưng cho <b>Thất Giác Chi</b> (7 yếu tố đưa đến giác ngộ: Niệm, Trạch pháp, Tinh tấn, Hỷ, Khinh an, Định, Xả) và nhắc nhở người con Phật ghi nhớ <b>Tứ Trọng Ân</b> (4 ân lớn trong đời):
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-stone-700 sm:text-sm">
              <li><b>Ân Cha Mẹ sinh thành dưỡng dục:</b> Công ơn nuôi nấng, dạy dỗ từ thuở ấu thơ.</li>
              <li><b>Ân Thầy Tổ dạy dỗ:</b> Những người truyền trao tri thức, đạo lý làm người.</li>
              <li><b>Ân Quốc gia & Xã hội:</b> Sự bình yên của đất nước và công sức của biết bao người xung quanh.</li>
              <li><b>Ân Tam Bảo & Chúng sinh:</b> Ánh sáng từ bi dẫn đường cho tâm hồn hướng thiện.</li>
            </ul>
            <p className="mt-2.5 text-xs leading-relaxed text-stone-600">
              Tại chùa thật, Phật tử thường chắp tay đi kinh hành chậm rãi quanh chân tháp theo chiều kim đồng hồ (<b>Nhiễu tháp</b>) để lắng tâm và hồi hướng công đức cho cha mẹ, gia đình.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={startStupaCircumambulation}
                className="w-full rounded-full bg-amber-800 py-3 text-sm font-medium text-white shadow hover:bg-amber-900"
              >
                🚶 Đi kinh hành nhiễu Bảo Tháp 1 vòng (theo chiều kim đồng hồ)
              </button>
              <button
                type="button"
                onClick={() => setStupaModalOpen(false)}
                className="w-full rounded-full bg-stone-200 py-2.5 text-sm text-stone-700"
              >
                Đã hiểu
              </button>
            </div>
          </div>
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

      {/* =====================================================================
          5. BẢNG VÀNG CÔNG ĐỨC & HỆ THỐNG 8 PHẨM VỊ CHÙA HẢI AN
         ===================================================================== */}
      {meritOpen && (() => {
        const leaderboard = buildMeritLeaderboard(
          name || 'Khách',
          meritState,
          Array.from(multiplayer.players.values()).map((rp) => ({
            id: rp.id,
            name: rp.name,
            state: rp.target.state,
          }))
        );
        const myIndex = leaderboard.findIndex((r) => r.isSelf);
        const progressPct = nextRank
          ? Math.min(
              100,
              Math.max(
                4,
                Math.round(
                  ((meritState.points - currentRank.minPoints) /
                    Math.max(1, nextRank.minPoints - currentRank.minPoints)) *
                    100
                )
              )
            )
          : 100;

        return (
          <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4">
            <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl border border-amber-900/25 bg-[#fdf8ec] p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                    🏆 Đài Bia Vàng Công Đức · Chùa Hải An
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMeritOpen(false)}
                  className="rounded-full bg-stone-200 px-3 py-1 text-sm font-medium"
                >
                  ✕
                </button>
              </div>

              {/* Player's current rank & merit summary card */}
              <div className="mt-3 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-900 via-amber-800 to-amber-950 p-4 text-amber-50 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-amber-200">
                      Phật tử: <b>{name || 'Khách'}</b> {myIndex >= 0 ? `· Hạng #${myIndex + 1} trên Bảng Vàng` : ''}
                    </p>
                    <p className="mt-0.5 font-serif text-xl font-bold text-amber-300">
                      {currentRank.badge} Phẩm vị Cấp {currentRank.level}/8: {currentRank.title}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/30 px-3.5 py-2 text-right">
                    <p className="text-[11px] uppercase tracking-wider text-amber-200">Tổng Công Đức</p>
                    <p className="font-serif text-2xl font-bold text-amber-300">{meritState.points}</p>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-amber-100/90">{currentRank.meaning}</p>
                {nextRank ? (
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-amber-200">
                      <span>Tiến trình lên Cấp {nextRank.level}: {nextRank.badge} {nextRank.title}</span>
                      <span>Còn thiếu {Math.max(0, nextRank.minPoints - meritState.points)} Công Đức ({meritState.points}/{nextRank.minPoints})</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/35">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-amber-300">
                    ✨ Bạn đã đạt phẩm vị viên mãn cao nhất trong Chùa Hải An!
                  </p>
                )}
              </div>

              {/* 3 Tabs */}
              <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-amber-100/80 p-1">
                {([
                  ['leaderboard', '🏆 Bảng Xếp Hạng'],
                  ['ranks', '🪷 8 Phẩm Vị Chùa'],
                  ['history', '📜 Cách Tích Công Đức'],
                ] as const).map(([tabKey, tabLabel]) => (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => setMeritTab(tabKey)}
                    className={`rounded-xl py-2 text-xs font-semibold transition ${
                      meritTab === tabKey
                        ? 'bg-amber-800 text-white shadow'
                        : 'text-amber-900 hover:bg-amber-200/70'
                    }`}
                  >
                    {tabLabel}
                  </button>
                ))}
              </div>

              {/* Tab 1: Leaderboard */}
              {meritTab === 'leaderboard' && (
                <div className="mt-3 space-y-2">
                  <div className="max-h-[42dvh] space-y-1.5 overflow-y-auto pr-1">
                    {leaderboard.map((entry, idx) => {
                      const pos = idx + 1;
                      return (
                        <div
                          key={entry.id}
                          className={`flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-sm transition ${
                            entry.isSelf
                              ? 'border-amber-700 bg-amber-100/90 ring-2 ring-amber-700/30'
                              : pos <= 3
                                ? 'border-amber-400/70 bg-amber-50/80'
                                : 'border-stone-200 bg-white'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                pos === 1
                                  ? 'bg-yellow-400 text-amber-950 shadow'
                                  : pos === 2
                                    ? 'bg-stone-300 text-stone-900'
                                    : pos === 3
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-stone-100 text-stone-600'
                              }`}
                            >
                              {pos <= 3 ? ['🥇', '🥈', '🥉'][pos - 1] : `#${pos}`}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="truncate font-semibold text-amber-950">
                                  {entry.name}
                                </span>
                                {entry.isSelf && (
                                  <span className="rounded-full bg-amber-800 px-2 py-0.5 text-[10px] font-semibold text-white">
                                    Bạn
                                  </span>
                                )}
                                {entry.isOnline && !entry.isSelf && (
                                  <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-medium text-white">
                                    Đang ở chùa
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-xs text-stone-600">
                                {entry.rank.badge} <b className="text-amber-900">{entry.rank.title}</b> · {entry.specialty}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="font-serif text-base font-bold text-amber-900">
                              {entry.points}
                            </span>
                            <span className="block text-[10px] text-stone-500">Công Đức</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 2: 8 Ranks */}
              {meritTab === 'ranks' && (
                <div className="mt-3 max-h-[45dvh] space-y-2 overflow-y-auto pr-1">
                  {MERIT_RANKS.map((rk) => {
                    const unlocked = meritState.points >= rk.minPoints;
                    const isCurrent = rk.level === currentRank.level;
                    return (
                      <div
                        key={rk.level}
                        className={`rounded-2xl border p-3 ${
                          isCurrent
                            ? 'border-amber-700 bg-amber-100/90 ring-2 ring-amber-700/30'
                            : unlocked
                              ? 'border-amber-300 bg-white'
                              : 'border-stone-200 bg-stone-100/70 opacity-75'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-serif text-base font-bold text-amber-900">
                            {rk.badge} Cấp {rk.level}: {rk.title}
                          </span>
                          <span className="rounded-full bg-amber-800/10 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                            Từ {rk.minPoints} Công Đức
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-stone-600">{rk.meaning}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tab 3: How to earn merit & recent history */}
              {meritTab === 'history' && (
                <div className="mt-3 max-h-[45dvh] space-y-3 overflow-y-auto pr-1">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                      Các Phật sự tích lũy Công Đức tại chùa:
                    </p>
                    <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {(Object.keys(MERIT_ACTIONS) as MeritActionKey[]).map((actId) => {
                        const act = MERIT_ACTIONS[actId];
                        const count = meritState.counts[actId] || 0;
                        return (
                          <div
                            key={actId}
                            className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs"
                          >
                            <div>
                              <span className="font-medium text-stone-800">
                                {act.icon} {act.label}
                              </span>
                              {count > 0 && (
                                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                                  Đã làm {count} lần
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 font-bold text-amber-800">
                              +{act.points}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {meritState.history.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                        Nhật ký Công Đức gần đây của bạn:
                      </p>
                      <div className="mt-1.5 space-y-1">
                        {meritState.history.slice(0, 10).map((h, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-xl bg-white px-3 py-1.5 text-xs text-stone-700"
                          >
                            <span>
                              {MERIT_ACTIONS[h.key]?.icon || '🪷'} {h.label}
                            </span>
                            <span className="text-stone-500">
                              <b className="text-amber-800">+{h.points}</b> · {h.date}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMeritOpen(false);
                    setSeatsModalOpen(true);
                  }}
                  className="flex-1 rounded-full bg-amber-800 py-3 text-xs font-semibold text-white shadow hover:bg-amber-900 sm:text-sm"
                >
                  🧘 Tìm chỗ ngồi Tọa Thiền & Niệm Kinh (+30 Công Đức)
                </button>
                <button
                  type="button"
                  onClick={() => setMeritOpen(false)}
                  className="rounded-full bg-stone-200 px-5 py-3 text-xs font-medium text-stone-700 sm:text-sm"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =====================================================================
          6. CHỌN CHỖ NGỒI TỌA THIỀN & NIỆM KINH (38 VỊ TRÍ TOÀN CHÙA)
         ===================================================================== */}
      {seatsModalOpen && (() => {
        const seatOccupiedBy = (s: Seat): string | null => {
          for (const rp of Array.from(multiplayer.players.values())) {
            if (
              (rp.target.state === 'sitting' || rp.target.state === 'praying') &&
              Math.hypot(rp.target.x - s.x, rp.target.z - s.z) < 0.8
            ) {
              return rp.name || 'Phật tử';
            }
          }
          return null;
        };
        const filteredSeats = SEATS.filter((s) => {
          if (seatsFilter === 'all') return true;
          if (seatsFilter === 'hall') return s.area === 'hall';
          if (seatsFilter === 'westChant') return s.area === 'westChant';
          if (seatsFilter === 'stupaChant') return s.area === 'stupaChant';
          return s.area === 'banyan' || s.area === 'corridor' || s.area === 'lake' || s.area === 'tea';
        });

        return (
          <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4">
            <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl border border-amber-900/25 bg-[#fdf8ec] p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                    🧘 Không gian Tọa Thiền & Tụng Kinh mở rộng
                  </p>
                  <h2 className="font-serif text-2xl font-bold text-amber-900">
                    {SEATS.length} Chỗ Ngồi Niệm Kinh Trong Chùa Hải An
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSeatsModalOpen(false)}
                  className="rounded-full bg-stone-200 px-3 py-1 text-sm font-medium"
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">
                Chọn bất kỳ bồ đoàn hoặc ghế đá nào bên dưới để nhân vật tự bước đến ngồi xếp bằng kiết già và mở bảng Niệm Phật / Tụng Kinh cùng đại chúng:
              </p>

              {/* Zone filter pills */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {([
                  ['all', `Tất cả (${SEATS.length})`],
                  ['hall', '🏯 Chính Điện (16)'],
                  ['westChant', '🧘 Niệm Phật Đường Tây (8)'],
                  ['stupaChant', '📿 Đài Niệm Kinh Bảo Tháp (6)'],
                  ['outdoor', '🌳 Gốc Đa · Hồ Sen · Hành Lang (8)'],
                ] as const).map(([fKey, fLabel]) => (
                  <button
                    key={fKey}
                    type="button"
                    onClick={() => setSeatsFilter(fKey)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      seatsFilter === fKey
                        ? 'bg-amber-800 text-white shadow'
                        : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                    }`}
                  >
                    {fLabel}
                  </button>
                ))}
              </div>

              {/* Seat list */}
              <div className="mt-3 grid max-h-[48dvh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {filteredSeats.map((s) => {
                  const occName = seatOccupiedBy(s);
                  const isMine = seatedSeat?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      className={`flex flex-col justify-between rounded-2xl border p-3 text-xs transition ${
                        isMine
                          ? 'border-amber-700 bg-amber-100/90 ring-2 ring-amber-700/30'
                          : occName
                            ? 'border-stone-200 bg-stone-100/70 opacity-75'
                            : 'border-amber-800/20 bg-white hover:border-amber-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-amber-950">
                            {s.area === 'hall' || s.area === 'westChant' || s.area === 'stupaChant' ? '🪷 ' : '🪑 '}
                            {s.label}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              isMine
                                ? 'bg-amber-800 text-white'
                                : occName
                                  ? 'bg-stone-300 text-stone-700'
                                  : 'bg-emerald-100 text-emerald-900'
                            }`}
                          >
                            {isMine ? 'Đang ngồi' : occName ? `Có ${occName}` : 'Còn trống'}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-stone-500">
                          {s.area === 'hall'
                            ? 'Đại Hùng Bảo Điện · Có bàn kinh & mõ gỗ'
                            : s.area === 'westChant'
                              ? 'Niệm Phật Đường Tây 2 tầng · Tụng kinh A Di Đà'
                              : s.area === 'stupaChant'
                                ? 'Đài Niệm Kinh hướng Bảo Tháp 7 tầng'
                                : 'Không gian sân chùa thoáng đãng'}
                        </p>
                      </div>
                      <div className="mt-2.5 flex gap-1.5">
                        <button
                          type="button"
                          disabled={Boolean(occName && !isMine)}
                          onClick={() => {
                            setSeatsModalOpen(false);
                            if (!isMine) sitAtSeat(s);
                          }}
                          className="flex-1 rounded-full bg-amber-800 py-2 text-xs font-medium text-white shadow hover:bg-amber-900 disabled:bg-stone-300 disabled:text-stone-500"
                        >
                          {isMine ? 'Đang ngồi tại đây' : 'Đến ngồi niệm kinh'}
                        </button>
                        {isMine && (
                          <button
                            type="button"
                            onClick={() => {
                              setSeatsModalOpen(false);
                              setChantOpen(true);
                            }}
                            className="rounded-full bg-emerald-800 px-3 py-2 text-xs font-medium text-white"
                          >
                            📿 Mở Kinh
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSeatsModalOpen(false);
                    setChantOpen(true);
                  }}
                  className="flex-1 rounded-full bg-amber-100 py-3 text-xs font-semibold text-amber-950 hover:bg-amber-200 sm:text-sm"
                >
                  📿 Mở ngay bảng Niệm Phật & Tụng Kinh
                </button>
                <button
                  type="button"
                  onClick={() => setSeatsModalOpen(false)}
                  className="rounded-full bg-stone-200 px-5 py-3 text-xs font-medium text-stone-700 sm:text-sm"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
            <svg viewBox="0 0 736 608" className="mt-3 w-full rounded-2xl bg-[#e8e0cc]">
              {/* Map formula: x=(wx+46)*8, y=(wz+44)*8 for bounds x -46..46, z -44..32 */}
              {/* Tường bao khuôn viên chùa (Compound enclosure wall: x -44..44, z -36..13) */}
              <rect x="16" y="64" width="704" height="392" rx="8" fill="#dfd5be" stroke="#8a6842" strokeWidth="4" />
              {/* Hall + Twin Bell/Drum Wing Pavilions */}
              <rect x="272" y="144" width="192" height="162" fill="#e8d9b8" stroke="#7a5c3a" />
              <text x="368" y="226" textAnchor="middle" fontSize="12.5" fontWeight="bold" fill="#7a1f1f">Đại Hùng Bảo Điện (16)</text>
              {/* Niệm Phật Đường Tây (-15.5, -16.5) -> x=244, y=220 */}
              <rect x="210" y="192" width="68" height="56" rx="4" fill="#d9b37c" stroke="#7a1f1f" strokeWidth="2" />
              <text x="244" y="223" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#4a1c14">Niệm Phật Đường</text>
              {/* Đài Bia Vàng Công Đức (8.8, -1.2) -> x=438, y=342 */}
              <rect x="424" y="330" width="28" height="22" rx="3" fill="#d4af37" stroke="#7a1f1f" strokeWidth="1.5" />
              <text x="438" y="364" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#7a1f1f">Bia Công Đức</text>
              {/* Tam quan + courtyard */}
              <rect x="328" y="448" width="80" height="16" fill="#a8432a" />
              <text x="368" y="482" textAnchor="middle" fontSize="11">Cổng tam quan</text>
              {/* Tâm Liên Hồ (-16, 3) */}
              <circle cx="240" cy="376" r="32" fill="#7aa8c8" />
              <text x="240" y="380" textAnchor="middle" fontSize="10" fill="#fff">Tâm Liên Hồ</text>
              {/* Cây đa Bách Linh (22, 8) */}
              <circle cx="544" cy="416" r="26" fill="#3f7a2e" />
              <text x="544" y="420" textAnchor="middle" fontSize="9.5" fill="#fff">Đa Bách Linh</text>
              {/* Bảo Tháp Báo Ân 7 tầng (35, -2.5) */}
              <circle cx="648" cy="332" r="20" fill="#a83b24" stroke="#d4af37" strokeWidth="2.5" />
              <text x="648" y="335" textAnchor="middle" fontSize="9" fill="#fff">Bảo Tháp 7T</text>
              {/* Đài Niệm Kinh Bảo Tháp (35, 6.8) -> x=648, y=406 */}
              <rect x="618" y="388" width="60" height="36" rx="4" fill="#d9b37c" stroke="#7a1f1f" strokeWidth="1.5" />
              <text x="648" y="409" textAnchor="middle" fontSize="8" fill="#4a1c14">Đài Niệm Kinh (6)</text>
              {/* Vườn Lộc Uyển (23.4..31, -25..-11.8) */}
              <rect x="555" y="152" width="62" height="106" fill="#7a9a5a" />
              <text x="586" y="206" textAnchor="middle" fontSize="10" fill="#fff">Vườn Lộc Uyển</text>
              {/* Nhà trà (33..40, -21.75..-15.25) */}
              <rect x="632" y="178" width="56" height="52" fill="#e8d9b8" stroke="#7a5c3a" />
              <text x="660" y="208" textAnchor="middle" fontSize="10">Nhà trà</text>
              {/* Gác chuông (-22, -9) */}
              <circle cx="192" cy="280" r="14" fill="#c9a227" />
              <text x="192" y="304" textAnchor="middle" fontSize="10">Gác chuông</text>
              {/* Vườn Lâm Tỳ Ni (-28, -24) */}
              <circle cx="144" cy="160" r="18" fill="#c98a9e" stroke="#7a5c3a" />
              <text x="168" y="164" textAnchor="start" fontSize="10" fill="#7a5c3a">Vườn Lâm Tỳ Ni</text>
              {/* Sông Bát Nhã, Bến Thuyền & Đảo HSK ở phía Nam (y 518..604) */}
              <rect x="16" y="528" width="704" height="44" rx="6" fill="#468faf" />
              <text x="210" y="554" textAnchor="middle" fontSize="11" fill="#fff">Sông Bát Nhã · Bến Thuyền Độ Sinh</text>
              <rect x="348" y="510" width="40" height="24" rx="4" fill="#7a4b2a" />
              <ellipse cx="368" cy="586" rx="96" ry="18" fill="#5f8d4e" stroke="#d4af37" strokeWidth="2" />
              <text x="368" y="590" textAnchor="middle" fontSize="10.5" fontWeight="bold" fill="#fff">🏝️ Đảo HSK (hoc-hsk.vercel.app)</text>
              {/* Player marker */}
              <circle cx={Math.max(24, Math.min(712, (playerPos.x + 46) * 8))} cy={Math.max(24, Math.min(592, (playerPos.z + 44) * 8))} r="10" fill="#dc2626" stroke="#fff" strokeWidth="2" />
              <text x={Math.max(60, Math.min(676, (playerPos.x + 46) * 8))} y={Math.max(18, Math.min(574, (playerPos.z + 44) * 8 - 16))} textAnchor="middle" fontSize="11" fill="#dc2626">Bạn đang ở đây</text>
            </svg>
            <div className="mt-3 grid gap-2">
              {([
                ['merit', '🏆 Đài Bia Vàng Công Đức', 'Xem bảng xếp hạng Công Đức · 8 phẩm vị tu tập trong chùa'],
                ['hall', '🏯 Đại Hùng Bảo Điện 3 tầng & Tả/Hữu Lâu', '16 bồ đoàn & bàn kinh · Quỳ lễ · Ngồi tĩnh tâm · Xin quẻ Từ Bi'],
                ['westChant', '🧘 Niệm Phật Đường Tây (Lầu Tụng Kinh 2 tầng)', '8 bồ đoàn hoa sen & bàn kinh · Tôn tượng A Di Đà · Mõ đại'],
                ['stupaChant', '📿 Đài Niệm Kinh Bảo Tháp', '6 bồ đoàn tọa thiền & tụng kinh hướng Bảo Tháp Báo Ân'],
                ['hsk', '⛵ Đi thuyền qua Sông Bát Nhã → Đảo HSK', 'Lên thuyền gỗ · Sang Đảo HSK · Mở hoc-hsk.vercel.app'],
                ['stupa', '🏯 Bảo Tháp Báo Ân 7 tầng', 'Chiêm bái tháp bát giác 7 tầng · Kinh hành nhiễu tháp · Tứ Trọng Ân'],
                ['wishing', '🎋 Giá treo thẻ ước nguyện Bồ Đề', 'Viết & treo thẻ gỗ cầu an, cầu thi đỗ HSK dưới tán đa'],
                ['burner', '🪔 Đỉnh đồng Lư hương', 'Dâng hương cầu nguyện'],
                ['chant', '📿 Đình Niệm Phật sân Tây', 'Niệm Phật · Hồi hướng'],
                ['pond', '🪷 Tâm Liên Hồ (Hồ sen)', 'Phóng sinh cá chép từ tay · Thả đèn Hoa Đăng · 3 chỗ ngồi ngắm hồ'],
                ['banyan', '🌳 Cây đa Bách Linh', '3 chỗ ngồi dưới tán đa · Quét lá đa'],
                ['garden', '🥬 Vườn Lộc Uyển', 'Múc nước vào gáo · Cầm gáo tưới rau'],
                ['tea', '🍵 Nhà trà', 'Ngồi nhà trà · Hiên đọc'],
                ['bell', '🔔 Gác chuông', 'Thỉnh đại hồng chung'],
                ['lumbini', '🪷 Vườn Lâm Tỳ Ni – Tắm Phật', 'Tắm Phật Thái tử đản sinh · Tìm hiểu lễ Phật đản'],
                ['gate', '⛩ Cổng Tam Quan Gác 2 tầng & Quảng Trường', 'Quảng trường đá hoa sen · Cờ phướn ngũ sắc · Biển Chùa Hải An'],
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
