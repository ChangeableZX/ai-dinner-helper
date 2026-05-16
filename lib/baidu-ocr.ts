/**
 * 百度智能云通用文字识别（标准版）
 *
 * 流程：用 API Key + Secret Key 换取 access_token → 调用 OCR API
 * 免费额度：1000 次/天（对 demo 项目完全够用）
 * 文档：https://cloud.baidu.com/doc/OCR/s/zk3h7xz52
 *
 * 设计决策：
 * 选择 OCR + 文本 LLM 而非多模态 LLM，原因：
 * - 订单截图是结构化文字图像，OCR 是这类场景的成熟方案
 * - 中文识别准确率 OCR 已经磨炼 20 年，优于通用视觉模型
 * - 成本只有多模态的 1/10，速度快 2-3 倍
 * - 多模态能力保留给 V2 的"拍冰箱实物识别"场景
 */

let cachedToken: { token: string; expireAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // token 有效期 30 天，内存缓存复用，过期前 1 分钟刷新
  if (cachedToken && cachedToken.expireAt > Date.now()) {
    return cachedToken.token;
  }

  const apiKey = process.env.BAIDU_OCR_API_KEY;
  const secretKey = process.env.BAIDU_OCR_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error('BAIDU_OCR_API_KEY 或 BAIDU_OCR_SECRET_KEY 未配置');
  }

  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
  const res = await fetch(url, { method: 'POST' });
  const data = await res.json();

  if (!data.access_token) {
    throw new Error(`百度 OCR token 获取失败: ${JSON.stringify(data)}`);
  }

  cachedToken = {
    token: data.access_token,
    expireAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}

/**
 * 识别图片中的所有文字
 * @param imageBase64 图片的 base64 字符串（可带 data:image/jpeg;base64, 前缀）
 * @returns 识别出的文字行数组
 */
export async function recognizeText(imageBase64: string): Promise<string[]> {
  const token = await getAccessToken();

  // 百度 OCR 要求纯 base64，去掉 data URL 前缀
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const url = `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${token}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `image=${encodeURIComponent(cleanBase64)}`,
  });

  const data = await res.json();

  if (data.error_code) {
    throw new Error(`百度 OCR 识别失败 (${data.error_code}): ${data.error_msg}`);
  }

  return (data.words_result || []).map((item: { words: string }) => item.words);
}
