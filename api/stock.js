export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let code = req.query.code;

  if (!code) {
    return res.status(400).json({
      success: false,
      error: '종목코드 또는 종목명이 필요합니다.'
    });
  }

  try {
    code = decodeURIComponent(code).trim();
  } catch (e) {
    code = String(code).trim();
  }

  // -----------------------------
  // 종목명 → 종목코드 변환
  // (ac.finance.naver.com 은 더 이상 사용 불가 -> m.stock.naver.com으로 교체)
  // -----------------------------
  if (!/^\d{6}$/.test(code)) {
    try {
      const searchUrl =
        `https://m.stock.naver.com/front-api/search/autoComplete?query=${encodeURIComponent(code)}&target=stock,index,marketindicator,coin,ipo`;

      const searchRes = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });

      if (!searchRes.ok) {
        throw new Error(`검색 API HTTP ${searchRes.status}`);
      }

      const searchData = await searchRes.json();
      const item = searchData?.result?.items?.[0];

      if (!item?.code) {
        return res.status(404).json({
          success: false,
          error: '종목을 찾을 수 없습니다.'
        });
      }

      code = item.code;
    } catch (e) {
      console.error('종목 검색 오류', e);
      return res.status(500).json({
        success: false,
        error: '종목 검색 실패'
      });
    }
  }

  // -----------------------------
  // Yahoo Finance
  // -----------------------------
  try {
    const symbols = [`${code}.KS`, `${code}.KQ`];

    for (const symbol of symbols) {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.warn(`Yahoo ${symbol} 실패: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      const meta = data?.chart?.result?.[0]?.meta;

      if (meta?.regularMarketPrice) {
        return res.status(200).json({
          success: true,
          code,
          name: meta.shortName || symbol,
          price: Math.round(meta.regularMarketPrice)
        });
      }
    }
  } catch (e) {
    console.error('Yahoo 오류', e);
  }

  // -----------------------------
  // 네이버 모바일 API 백업 (HTML 파싱 대신 JSON API 사용)
  // -----------------------------
  try {
    const infoUrl = `https://m.stock.naver.com/front-api/v1/stock/basicInfo?stockCode=${code}`;

    const response = await fetch(infoUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const priceRaw = data?.now ?? data?.closePrice;
      const name = data?.stockName || data?.stockNameEng || code;

      if (priceRaw) {
        const price = parseInt(String(priceRaw).replace(/,/g, ''), 10);
        if (!isNaN(price)) {
          return res.status(200).json({
            success: true,
            code,
            name,
            price
          });
        }
      }
    } else {
      console.warn(`네이버 basicInfo 실패: HTTP ${response.status}`);
    }
  } catch (e) {
    console.error('네이버 오류', e);
  }

  return res.status(500).json({
    success: false,
    error: '실시간 시세를 불러올 수 없습니다.'
  });
}
