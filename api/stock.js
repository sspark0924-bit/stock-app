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

  // 1. 종목명인 경우 네이버 검색 API로 6자리 코드 변환
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

  // 2. 네이버 증권 모바일 API 수신
  try {
    const stockUrl = `https://m.stock.naver.com/api/stock/${code}/basic`;
    const response = await fetch(stockUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Referer': `https://m.stock.naver.com/item/main.naver?symbol=${code}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.nowValue) {
        const price = parseInt(data.nowValue.replace(/,/g, ''), 10);
        const name = data.stockName || '종목명';
        return res.status(200).json({
          success: true,
          code,
          name,
          price
        });
      }
    }
    throw new Error('시세 파싱 에러');
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: '네이버 시세 동기화 실패'
    });
  }
}
