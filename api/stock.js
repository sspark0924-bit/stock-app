export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: '종목코드가 필요합니다.' });
  }

  try {
    const response = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'
      }
    });

    if (!response.ok) throw new Error('네이버 시세 응답 실패');

    const data = await response.json();
    const price = parseInt(data.nowValue.replace(/,/g, ''), 10);
    const name = data.stockName;

    return res.status(200).json({ success: true, code, name, price });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}