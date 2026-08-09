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

code = decodeURIComponent(code).trim();

// -----------------------------
// 종목명 → 종목코드 변환
// -----------------------------
if (!/^\d{6}$/.test(code)) {
try {
const searchUrl =
`https://ac.finance.naver.com/ac?q=${encodeURIComponent(code)}&q_enc=utf-8&st=111&r_format=json&r_enc=utf-8`;

```
  const searchRes = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });

  const searchData = await searchRes.json();
  const item = searchData?.items?.[0]?.[0];

  if (!item) {
    return res.status(404).json({
      success: false,
      error: '종목을 찾을 수 없습니다.'
    });
  }

  code = item[1][0];

} catch (e) {

  console.error('검색 오류', e);

  return res.status(500).json({
    success: false,
    error: '종목 검색 실패'
  });

}
```

}

// -----------------------------
// Yahoo Finance
// -----------------------------
try {

```
const symbols = [`${code}.KS`, `${code}.KQ`];

for (const symbol of symbols) {

  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    }
  );

  if (!response.ok) continue;

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
```

} catch (e) {

```
console.error('Yahoo 오류', e);
```

}

// -----------------------------
// 네이버 HTML 백업
// -----------------------------
try {

```
const url = `https://finance.naver.com/item/main.naver?code=${code}`;

const response = await fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
});

const html = await response.text();

const priceMatch = html.match(
  /<p class="no_today">[\\s\\S]*?<span class="blind">([\\d,]+)<\\/span>/
);

const nameMatch = html.match(
  /<title>(.*?) : 네이버페이 증권<\\/title>/
);

if (priceMatch) {

  return res.status(200).json({
    success: true,
    code,
    name: nameMatch ? nameMatch[1] : code,
    price: parseInt(priceMatch[1].replace(/,/g, ''), 10)
  });

}
```

} catch (e) {

```
console.error('네이버 오류', e);
```

}

return res.status(500).json({
success: false,
error: '실시간 시세를 불러올 수 없습니다.'
});
}
