export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { code } = req.query;
  if (!code || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ success: false, error: '올바른 6자리 종목코드가 필요합니다.' });
  }

  try {
    // 네이버 모바일 API 호출 (서버 단 수신)
    const response = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Referer': `https://m.stock.naver.com/item/main.naver?symbol=${code}`
      }
    });

    if (!response.ok) {
      throw new Error(`시세 서버 응답 에러 (${response.status})`);
    }

    const data = await response.json();
    if (data && data.nowValue) {
      const price = parseInt(data.nowValue.replace(/,/g, ''), 10);
      const name = data.stockName || '종목명';
      return res.status(200).json({ success: true, code, name, price });
    }

    throw new Error('시세 데이터 파싱 실패');
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || '시세 수신 실패' });
  }
}
