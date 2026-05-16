'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

const LOADING_MESSAGES = [
  '📸 正在看你的购物清单...',
  '🔍 找找有什么食材...',
  '🥕 哦，看到了一些蔬菜',
  '🥩 还有些肉类...',
  '✨ 马上整理好啦',
];
const LOADING_EMOJIS = ['📸', '🔍', '✨'];

async function compressImage(file: File, maxSize = 1280, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) { height = (height / width) * maxSize; width = maxSize; }
        else { width = (width / height) * maxSize; height = maxSize; }
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

type Phase = 'idle' | 'loading' | 'error';

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingBase64, setPendingBase64] = useState('');

  const [msgIdx, setMsgIdx] = useState(0);
  const [msgVisible, setMsgVisible] = useState(true);
  const [emojiIdx, setEmojiIdx] = useState(0);

  useEffect(() => {
    if (phase !== 'loading') return;
    const emojiTimer = setInterval(
      () => setEmojiIdx((i) => (i + 1) % LOADING_EMOJIS.length),
      1000,
    );
    const msgTimer = setInterval(() => {
      setMsgVisible(false);
      setTimeout(() => {
        setMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
        setMsgVisible(true);
      }, 150);
    }, 1400);
    return () => { clearInterval(emojiTimer); clearInterval(msgTimer); };
  }, [phase]);

  async function recognize(base64: string) {
    setPendingBase64(base64);
    setPhase('loading');
    setMsgIdx(0);
    setEmojiIdx(0);
    setMsgVisible(true);

    try {
      const res = await fetch('/api/recognize-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? '识别失败，请重试');
      sessionStorage.setItem('ocr_pending_result', JSON.stringify({
        items: data.items,
        warnings: data.warnings ?? [],
      }));
      router.push('/inventory/confirm');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '识别失败，请重试');
      setPhase('error');
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      setErrorMsg('请选择图片格式');
      setPhase('error');
      return;
    }

    let base64: string;
    try {
      base64 = await compressImage(file);
    } catch {
      setErrorMsg('图片读取失败，换一张试试');
      setPhase('error');
      return;
    }

    await recognize(base64);
  }

  if (phase === 'loading') {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center gap-6 bg-[#FAF7F2]">
        <div className="text-8xl">{LOADING_EMOJIS[emojiIdx]}</div>
        <p
          className="text-base text-gray-600 text-center px-8 transition-opacity duration-150"
          style={{ opacity: msgVisible ? 1 : 0 }}
        >
          {LOADING_MESSAGES[msgIdx]}
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex items-center gap-3 px-5 pt-12 pb-4">
          <button
            onClick={() => { setPhase('idle'); setErrorMsg(''); }}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-[#2D2D2D]">上传订单截图</h1>
        </div>

        <div className="flex flex-col items-center justify-center flex-1 px-8 text-center gap-6">
          <div className="text-7xl">😵</div>
          <div>
            <p className="text-base font-semibold text-[#2D2D2D] mb-1">识别遇到了问题</p>
            <p className="text-sm text-gray-500">{errorMsg}</p>
          </div>
          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={() => { setPhase('idle'); setErrorMsg(''); }}
              className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium active:scale-95 transition-transform"
            >
              换张图
            </button>
            {pendingBase64 && (
              <button
                onClick={() => recognize(pendingBase64)}
                className="flex-1 py-3 rounded-2xl bg-[#FF6B47] text-white text-sm font-semibold active:scale-95 transition-transform"
              >
                重试
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-[#2D2D2D]">上传订单截图</h1>
      </div>

      <div className="flex-1 px-5 flex flex-col gap-6">
        <div className="text-center pt-8">
          <div className="text-6xl mb-4">📸</div>
          <p className="text-lg font-bold text-[#2D2D2D] mb-1">上传你的买菜订单截图</p>
          <p className="text-sm text-gray-400">我帮你识别食材，自动入库</p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 rounded-3xl py-12 px-6 flex flex-col items-center gap-3 text-center active:scale-[0.98] transition-transform bg-white"
        >
          <span className="text-4xl">🖼️</span>
          <p className="font-semibold text-[#2D2D2D]">点击选择图片</p>
          <p className="text-xs text-gray-400">支持美团 / 盒马 / 京东到家 / 叮咚</p>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-sm text-gray-500 space-y-1.5">
          <p className="font-semibold text-gray-600 mb-2">💡 小贴士</p>
          <p>• 截图包含食材名称即可</p>
          <p>• 不用截全单，部分截图也行</p>
          <p>• 超大图片会自动压缩，无需担心</p>
        </div>
      </div>
    </div>
  );
}
