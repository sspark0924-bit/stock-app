export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let { code } = req.query;
  if (!code) {
    return res.status(400).json({ success: false, error: '종목코드 또는 종목명이 필요합니다.' });
  }

  code = decodeURIComponent(code).trim();

  // 1. 종목명 입력 시 네이버 검색 API로 6자리 코드 검색 (예: 카카오 -> 035720)
  if (!/^\d{6}$/.test(code)) {
    try {
      const searchUrl = `https://ac.finance.naver.com/ac?q=${encodeURIComponent(code)}&q_enc=utf-8&st=111&r_format=json&r_enc=utf-8`;
      const searchRes = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      const searchData = await searchRes.json();
      const matchedItem = searchData?.items?.[0]?.[0];

      if (matchedItem) {
        code = matchedItem[1][0];
      } else {
        return res.status(400).json({ success: false, error: `'${req.query.code}' 종목을 찾을 수 없습니다.` });
      }
    } catch (e) {
      return res.status(500).json({ success: false, error: '종목 검색 중 오류가 발생했습니다.' });
    }
  }

  // 2. 야후 파이낸스 차트 API 1차 시도
  const symbols = [`${code}.KS`, `${code}.KQ`];
  for (const symbol of symbols) {
    try {
      const yahooUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
      const response = await fetch(yahooUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const result = data?.chart?.result?.[0];
        if (result && result.meta && result.meta.regularMarketPrice) {
          return res.status(200).json({
            success: true,
            code,
            name: result.meta.shortName || result.meta.symbol,
            price: Math.round(result.meta.regularMarketPrice)
          });
        }
      }
    } catch (e) {}
  }

  // 3. 네이버 증권 Polling API 2차 시도
  try {
    const naverUrl = `https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`;
    const response = await fetch(naverUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        'Referer': 'https://finance.naver.com/'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const item = data?.datas?.[0];
      if (item && item.closePrice) {
        return res.status(200).json({
          success: true,
          code,
          name: item.stockName || '종목명',
          price: parseInt(item.closePrice.replace(/,/g, ''), 10)
        });
      }
    }
  } catch (e) {}

  return res.status(500).json({
    success: false,
    error: '실시간 시세를 불러올 수 없습니다.'
  });
}
