import { useState, useRef, useEffect } from 'react';
import type { Answer, Comment, QuestionPage } from './types';

const URL = import.meta.env.VITE_API_URL;

function App() {
  const [code, setCode] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // 使用 Ref 存储答案，避免闭包问题
  const answersRef = useRef<Answer[]>([]);
  const commentsRef = useRef<Comment[]>([]);

  // 自动滚动日志
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // 处理单个页面的问题逻辑
  const processPage = (page: QuestionPage) => {
    addLog(`📄 页面: ${page.display_title.substring(0, 10)}...`);

    page.mst_questions.forEach((q) => {
      let answer: Answer = {
        mst_question_id: q.id,
        mst_menu_id: q.mst_menu_id,
        answered_option_no: "",
      };

      // 逻辑：不管是单选、多选还是文本，都往 answers 里放
      if (q.form_type === 1 || q.form_type === 2) {
        if (q.options && q.options.length > 0) {
          // 默认选第一个选项
          answer.answered_option_no = q.options[0].no;
          addLog(`  ✅ Q${q.no} [选择]: ${q.options[0].content}`);
        }
        answersRef.current.push(answer);
      } else if (q.form_type === 3) {
        // 文本题：answer 放空字符串占位
        answersRef.current.push(answer);

        // 如果必填，在 comments 里加内容
        if (q.is_required) {
          const text = "特にありません";
          commentsRef.current.push({
            mst_question_id: q.id,
            mst_menu_id: q.mst_menu_id,
            answered_text: text,
          });
          addLog(`  📝 Q${q.no} [文本]: ${text}`);
        } else {
          addLog(`  ⏭️ Q${q.no} [选填]: 跳过`);
        }
      }
    });
  };

  // 调用 Cloudflare Worker
  const callApi = async (endpoint: 'start' | 'next', payload: any) => {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, payload }),
    });
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    return await res.json();
  };

  const startSurvey = async () => {
    if (!code || !price) return alert("请输入招待番号和金额");

    setLoading(true);
    setLogs([]);
    setQrCode(null);
    answersRef.current = [];
    commentsRef.current = [];

    try {
      addLog("🚀 开始请求...");

      // 1. Start
      const startRes = await callApi('start', { invitation_code: code, total_price: price });
      let data = startRes.data;

      if (data.status === -1) {
        finishSurvey(data);
        return;
      }

      if (data.mst_question_page) processPage(data.mst_question_page);

      // 2. Loop Next
      while (true) {
        // 延迟 800ms，防止过快
        await new Promise(r => setTimeout(r, 800));

        const nextPayload = {
          invitation_code: code,
          total_price: price,
          answers: answersRef.current,
          comments: commentsRef.current
        };

        addLog(`🔄 提交本页答案...`);
        const nextRes = await callApi('next', nextPayload);
        data = nextRes.data;

        if (data.status === -1) {
          finishSurvey(data);
          break;
        } else if (data.status === 1) {
          addLog(`📊 进度: ${data.progress}%`);
          if (data.mst_question_page) processPage(data.mst_question_page);
        } else {
          throw new Error(`未知状态: ${data.status}`);
        }
      }

    } catch (e: any) {
      addLog(`❌ 错误: ${e.message}`);
      alert("发生错误，请查看日志");
    } finally {
      setLoading(false);
    }
  };

  const finishSurvey = (data: any) => {
    addLog("🎉 问卷完成！");
    if (data.qr && data.qr.qr_image_base64) {
      setQrCode(data.qr.qr_image_base64);
    } else {
      addLog("⚠️ 未找到二维码数据");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8 px-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 p-4 text-center">
          <h1 className="text-white text-xl font-bold tracking-wider">スシロー 自動回答</h1>
          <p className="text-red-100 text-xs mt-1">Sushiro Automation</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">

          {/* Inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">招待番号 (数字のみ)</label>
              <input
                type="tel"
                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-lg tracking-widest"
                placeholder="1234567890123456"
                value={code}
                onChange={e => setCode(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">合計金額</label>
              <input
                type="tel"
                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-lg"
                placeholder="2000"
                value={price}
                onChange={e => setPrice(e.target.value)}
              />
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={startSurvey}
            disabled={loading}
            className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-md transition-all
              ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-95'}
            `}
          >
            {loading ? '処理中...' : 'クーポンを受け取る'}
          </button>

          {/* QR Code Result */}
          {qrCode && (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex flex-col items-center animate-fade-in">
              <p className="text-green-800 font-bold mb-2">クーポンGET!</p>
              <img src={`data:image/png;base64,${qrCode}`} alt="QR Code" className="w-48 h-48 object-contain" />
              <p className="text-xs text-gray-500 mt-2">スクリーンショットを保存してください</p>
            </div>
          )}

          {/* Logs */}
          <div className="bg-gray-900 rounded-lg p-3 h-48 overflow-y-auto text-xs font-mono text-green-400 shadow-inner" id="log-container">
            {logs.length === 0 && <span className="text-gray-600">待機中...</span>}
            {logs.map((log, i) => (
              <div key={i} className="mb-1 border-b border-gray-800 pb-1 last:border-0">{log}</div>
            ))}
            <div ref={logEndRef} />
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;