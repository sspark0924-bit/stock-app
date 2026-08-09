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

  code = code.trim();

  // 1. 종목명인 경우 네이버 검색으로 6자리 코드 찾기
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

  // 2. 야후 파이낸스 Query API 호출
  const symbols = [`${code}.KS`, `${code}.KQ`];

  for (const symbol of symbols) {
    try {
      const yahooUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
      const response = await fetch(yahooUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const result = data?.chart?.result?.[0];
        if (result && result.meta && result.meta.regularMarketPrice) {
          const price = Math.round(result.meta.regularMarketPrice);
          const name = result.meta.shortName || result.meta.symbol;
          return res.status(200).json({
            success: true,
            code,
            name,
            price
          });
        }
      }
    } catch (e) {
      console.log(`Symbol ${symbol} fetch failed:`, e.message);
    }
  }

  // 3. 네이버 증권 대체 경로 (Naver Mobile Web API)
  try {
    const naverUrl = `https://m.stock.naver.com/api/stock/${code}/basic`;
    const response = await fetch(naverUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Referer': `https://m.stock.naver.com/item/main.naver?symbol=${code}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.nowValue) {
        const price = parseInt(data.nowValue.replace(/,/g, ''), 10);
        const name = data.stockName || '종목';
        return res.status(200).json({
          success: true,
          code,
          name,
          price
        });
      }
    }
  } catch (e) {
    console.log('Naver fallback failed:', e.message);
  }

  return res.status(500).json({
    success: false,
    error: '시세 데이터를 불러올 수 없습니다.'
  });
}
