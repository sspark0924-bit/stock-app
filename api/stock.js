export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let { code } = req.query;
  if (!code) {
    return res.status(400).json({ success: false, error: '종목코드가 필요합니다.' });
  }

  code = decodeURIComponent(code).trim();

  // 종목명 -> 코드 변환
  if (!/^\d{6}$/.test(code)) {
    try {
      const searchUrl =
        `https://ac.finance.naver.com/ac?q=${encodeURIComponent(code)}&q_enc=utf-8&st=111&r_format=json&r_enc=utf-8`;

      const r = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const j = await r.json();
      const item = j?.items?.[0]?.[0];

      if (!item) {
        return res.status(404).json({ success: false, error: '종목을 찾을 수 없습니다.' });
      }

      code = item[1][0];
    } catch (e) {
      console.error('검색 오류', e);
      return res.status(500).json({ success: false, error: '종목 검색 실패' });
    }
  }

  // -----------------------------
  // 1차 : 네이버 모바일 API
  // -----------------------------
  try {
    const url = `https://m.stock.naver.com/api/stock/${code}/basic`;

    const r = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        Referer: `https://m.stock.naver.com/item/main.naver?symbol=${code}`
      }
    });

    if (r.ok) {
      const j = await r.json();

      const price = parseInt(String(j.nowValue).replace(/,/g, ''), 10);

      if (!isNaN(price)) {
        return res.status(200).json({
          success: true,
          code,
          name: j.stockName,
          price
        });
      }
    }

    console.error('네이버 API 상태:', r.status);
  } catch (e) {
    console.error('네이버 API 오류', e);
  }

  // -----------------------------
  // 2차 : 네이버 HTML 파싱
  // -----------------------------
  try {
    const url = `https://finance.naver.com/item/main.naver?code=${code}`;

    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const html = await r.text();

    const match = html.match(/<p class="no_today">[\s\S]*?<span class="blind">([\d,]+)<\/span>/);

    if (match) {
      const price = parseInt(match[1].replace(/,/g, ''), 10);

      return res.status(200).json({
        success: true,
        code,
        name: code,
        price
      });
    }
  } catch (e) {
    console.error('HTML 파싱 오류', e);
  }

  // -----------------------------
  // 3차 : Yahoo Finance
  // -----------------------------
  for (const symbol of [`${code}.KS`, `${code}.KQ`]) {
    try {
      const url =
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;

      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      if (!r.ok) continue;

      const j = await r.json();
      const meta = j?.chart?.result?.[0]?.meta;

      if (meta?.regularMarketPrice) {
        return res.status(200).json({
          success: true,
          code,
          name: meta.shortName || meta.symbol,
          price: Math.round(meta.regularMarketPrice)
        });
      }
    } catch (e) {
      console.error('Yahoo 오류', e);
    }
  }

  return res.status(500).json({
    success: false,
    error: '실시간 시세를 불러올 수 없습니다.'
  });
}
