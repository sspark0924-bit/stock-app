export default async function handler(req, res) {
  // CORS 헤더 설정 (모든 브라우저 접근 허용)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { code } = req.query;
  if (!code || code.length !== 6) {
    return res.status(400).json({ success: false, error: '올바른 6자리 종목코드가 필요합니다.' });
  }

  try {
    // 네이버 모바일 API 호출 시 보안 차단을 우회하기 위한 헤더 설정
    const response = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Referer': `https://m.stock.naver.com/item/main.naver?symbol=${code}`,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    if (!response.ok) {
      throw new Error(`네이버 응답 에러 (상태코드: ${response.status})`);
    }

    const data = await response.json();

    if (!data || !data.nowValue) {
      throw new Error('시세 데이터 수신 실패 (응답 데이터 없음)');
    }

    // 쉼표(,) 제거 후 정수형으로 변환
    const price = parseInt(data.nowValue.replace(/,/g, ''), 10);
    const name = data.stockName || '종목명';

    return res.status(200).json({
      success: true,
      code,
      name,
      price
    });

  } catch (error) {
    console.error('Stock Fetch Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '시세 정보를 가져오지 못했습니다.'
    });
  }
}
