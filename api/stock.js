export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { code } = req.query;
  if (!code || code.length !== 6) {
    return res.status(400).json({ success: false, error: '올바른 6자리 종목코드가 필요합니다.' });
  }

  // 1차 시도: 야후 파이낸스 API (코스피 .KS / 코스닥 .KQ 순차 시도)
  const symbols = [`${code}.KS`, `${code}.KQ`];

  for (const symbol of symbols) {
    try {
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
      const response = await fetch(yahooUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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

  // 2차 시도: 네이버 증권 대체 엔드포인트
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
        const price = parseInt(item.closePrice.replace(/,/g, ''), 10);
        const name = item.stockName || '종목';
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

  // 모든 호출 실패 시 예외 처리
  return res.status(500).json({
    success: false,
    error: '실시간 시세를 불러올 수 없습니다. 종목코드를 확인해 주세요.'
  });
}
