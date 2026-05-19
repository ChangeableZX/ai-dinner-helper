'use client';

import { useState, useEffect, type ReactNode } from 'react';

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('admin_authed') === 'yes') {
      setAuthed(true);
    }
    setChecked(true);
  }, []);

  function handleSubmit() {
    if (!ADMIN_PASSWORD) {
      setError('管理员密码未配置（NEXT_PUBLIC_ADMIN_PASSWORD）');
      return;
    }
    if (input === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_authed', 'yes');
      setAuthed(true);
      setError('');
    } else {
      setError('密码错误');
    }
  }

  if (!checked) return null;

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">📊</div>
            <h2 className="text-xl font-semibold">饭饭 · 数据后台</h2>
            <p className="text-sm text-gray-500 mt-1">需要密码访问</p>
          </div>

          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="输入密码"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-3 focus:outline-none focus:border-[#FF6B47] text-sm"
            autoFocus
          />

          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          <button
            onClick={handleSubmit}
            className="w-full bg-[#FF6B47] text-white py-3 rounded-xl font-medium hover:bg-[#e85a38] transition-colors"
          >
            进入
          </button>

          <p className="text-xs text-gray-400 text-center mt-4">这是项目 demo 的内部演示后台</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
