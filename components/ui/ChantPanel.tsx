'use client';

import { useEffect, useRef, useState } from 'react';
import { CHANT_ITEMS, getChant, type ChantItem } from '@/lib/chanting';

export type ChantMode = 'calm' | 'walk';

type Props = {
  muted?: boolean;
  open: boolean;
  onClose: () => void;
  onPlayback: (playing: boolean, mode: ChantMode) => void;
  onFinish: (item: ChantItem) => void;
  onDedicate: () => void;
};

const PROGRESS_KEY = 'thien-vien-chant-progress';

/**
 * Niệm Phật panel only. The former sutra/mantra and "theo tâm nguyện"
 * sections were removed at the user's request — this panel must not
 * grow them back without a verified, licensed source.
 * Audio stays mounted when the panel closes, so "Nghe khi đi dạo"
 * keeps playing while the user walks.
 */
export default function ChantPanel({ muted, open, onClose, onPlayback, onFinish, onDedicate }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [speed, setSpeed] = useState(1);
  const [repeat, setRepeat] = useState(false);
  const [hideText, setHideText] = useState(false);
  const [mode, setMode] = useState<ChantMode>('calm');
  const [savedProgress, setSavedProgress] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bellRef = useRef<HTMLAudioElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = selectedId ? getChant(selectedId) : undefined;
  const playable = selected?.audio ?? null;

  useEffect(() => {
    if (!open) return;
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      try {
        const p = JSON.parse(raw) as { id: string; time: number };
        setSavedProgress(p.id === selectedId && p.time > 5 ? p.time : null);
      } catch {
        setSavedProgress(null);
      }
    }
  }, [open, selectedId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.playbackRate = speed;
  }, [volume, speed]);
  // Global speaker mute applies even mid-chant or mid-bell.
  useEffect(() => {
    if (!muted) return;
    audioRef.current?.pause();
    bellRef.current?.pause();
    setPlaying(false);
    onPlayback(false, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  const stopAudio = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaying(false);
    setProgress(0);
    onPlayback(false, mode);
  };

  const start = (fromSaved = false) => {
    const audio = audioRef.current;
    if (!audio || !playable) return;
    if (fromSaved && savedProgress) audio.currentTime = savedProgress;
    audio.play().then(() => {
      setPlaying(true);
      onPlayback(true, mode);
      bellRef.current?.play().catch(() => {});
    }).catch(() => {});
  };

  const togglePause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      onPlayback(false, mode);
    } else {
      audio.play().then(() => {
        setPlaying(true);
        onPlayback(true, mode);
      }).catch(() => {});
    }
  };

  const onEnded = () => {
    if (repeat) {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      return;
    }
    setPlaying(false);
    onPlayback(false, mode);
    bellRef.current?.play().catch(() => {});
    localStorage.removeItem(PROGRESS_KEY);
    if (selected) onFinish(selected);
  };

  const onTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setProgress(audio.currentTime);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (selected && audio.currentTime > 5 && audio.duration - audio.currentTime > 5) {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify({ id: selected.id, time: audio.currentTime }));
      }
    }, 1000);
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  return (
    <>
    {open && (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto max-h-[78vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-amber-900/20 bg-[#fdf8ec]/95 p-4 text-stone-800 shadow-2xl backdrop-blur sm:bottom-4 sm:rounded-3xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-semibold text-amber-900">Niệm Phật · Cầu an</h2>
          <p className="text-xs text-stone-500">Chỉ niệm danh hiệu, trang nghiêm, không tích điểm.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full bg-stone-200 px-3 py-1 text-sm" aria-label="Đóng bảng niệm Phật (âm thanh vẫn phát nếu đang nghe khi đi dạo)">✕</button>
      </div>

      <div className="mb-3 grid gap-2">
        {CHANT_ITEMS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => { stopAudio(); setSelectedId(c.id); }}
            className={`rounded-2xl border p-3 text-left ${selectedId === c.id ? 'border-amber-700 bg-amber-50' : 'border-stone-200 bg-white'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{c.name}</span>
              <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">Niệm danh hiệu</span>
            </div>
            <p className="mt-1 text-xs text-stone-500">▶ Có bản nghe (giọng tổng hợp, tham khảo)</p>
          </button>
        ))}
      </div>

      {selected && playable && (
        <div className="rounded-2xl border border-amber-900/20 bg-white p-4">
          <h3 className="font-serif text-lg font-semibold text-amber-900">{selected.name}</h3>
          <p className="mt-1 text-sm text-stone-600">{selected.meaning}</p>
          <p className="mt-2 text-xs text-stone-500">{selected.sourceNote}</p>
          <p className="mt-1 text-xs font-medium text-amber-800">⚠ Bản nghe là giọng đọc tổng hợp để nghe tham khảo, không phải bản tụng chuẩn và không phải giọng của một vị tăng ni có thật.</p>

          <div className="mt-3 border-t border-stone-100 pt-3">
            <div className="mb-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setMode('calm')} className={`rounded-full px-3 py-1.5 text-xs ${mode === 'calm' ? 'bg-amber-700 text-white' : 'bg-stone-100'}`}>🧘 Tĩnh tâm (ngồi trước chính điện)</button>
              <button type="button" onClick={() => setMode('walk')} className={`rounded-full px-3 py-1.5 text-xs ${mode === 'walk' ? 'bg-amber-700 text-white' : 'bg-stone-100'}`}>🚶 Nghe khi đi dạo</button>
            </div>
            {!hideText && (
              <p className="rounded-xl bg-amber-50 p-3 text-center font-serif text-lg text-amber-900">{selected.text[0]}</p>
            )}
            <div className="mt-3 flex items-center gap-3">
              <button type="button" onClick={() => start()} className="rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white">Bắt đầu</button>
              <button type="button" onClick={togglePause} disabled={!playing && progress === 0} className="rounded-full bg-stone-200 px-4 py-2 text-sm disabled:opacity-40">{playing ? 'Tạm dừng' : 'Tiếp tục'}</button>
              <button type="button" onClick={stopAudio} className="rounded-full bg-stone-200 px-4 py-2 text-sm">Dừng</button>
              <button type="button" onClick={() => setRepeat(!repeat)} className={`rounded-full px-3 py-2 text-xs ${repeat ? 'bg-amber-700 text-white' : 'bg-stone-100'}`}>Lặp lại: {repeat ? 'Bật' : 'Tắt'}</button>
            </div>
            {savedProgress && !playing && progress === 0 && (
              <button type="button" onClick={() => start(true)} className="mt-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs text-amber-900">
                Tiếp tục từ vị trí trước ({fmt(savedProgress)})
              </button>
            )}
            <div className="mt-3">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.5}
                value={progress}
                onChange={(e) => {
                  const audio = audioRef.current;
                  if (audio) {
                    audio.currentTime = Number(e.target.value);
                    setProgress(audio.currentTime);
                  }
                }}
                className="w-full"
                aria-label="Thanh tiến độ"
              />
              <div className="flex justify-between text-xs text-stone-500">
                <span>{fmt(progress)}</span>
                <span>{fmt(duration)} · {playing ? 'Đang phát' : 'Đã dừng'}</span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-2">Âm lượng
                <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
              </label>
              <label className="flex items-center gap-2">Tốc độ
                <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded border px-1 py-0.5">
                  <option value={0.75}>0.75×</option>
                  <option value={1}>1×</option>
                  <option value={1.25}>1.25×</option>
                  <option value={1.5}>1.5×</option>
                </select>
              </label>
              <button type="button" onClick={() => setHideText(!hideText)} className="rounded-full bg-stone-100 px-3 py-1">{hideText ? 'Hiện chữ' : 'Ẩn chữ, chỉ nghe'}</button>
            </div>
            <button type="button" onClick={onDedicate} className="mt-3 w-full rounded-xl border border-amber-700 py-2 text-sm font-medium text-amber-800">
              Hồi hướng sau khi niệm xong
            </button>
          </div>
        </div>
      )}
    </div>
    )}
    <audio
      ref={audioRef}
      src={playable ?? undefined}
      onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration || 0)}
      onTimeUpdate={onTimeUpdate}
      onEnded={onEnded}
      preload="metadata"
    />
    <audio ref={bellRef} src="/audio/bell.mp3" preload="auto" />
    </>
  );
}
