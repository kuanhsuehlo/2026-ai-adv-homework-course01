const crypto = require('crypto');

const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;
const HASH_KEY = process.env.ECPAY_HASH_KEY;
const HASH_IV = process.env.ECPAY_HASH_IV;
const IS_STAGING = process.env.ECPAY_ENV !== 'production';

const BASE_DOMAIN = IS_STAGING
  ? 'https://payment-stage.ecpay.com.tw'
  : 'https://payment.ecpay.com.tw';

const CHECKOUT_URL = `${BASE_DOMAIN}/Cashier/AioCheckOut/V5`;
const QUERY_URL = `${BASE_DOMAIN}/Cashier/QueryTradeInfo/V5`;

function ecpayUrlEncode(source) {
  let encoded = encodeURIComponent(source)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27');
  encoded = encoded.toLowerCase();
  const replacements = { '%2d': '-', '%5f': '_', '%2e': '.', '%21': '!', '%2a': '*', '%28': '(', '%29': ')' };
  for (const [old, char] of Object.entries(replacements)) {
    encoded = encoded.split(old).join(char);
  }
  return encoded;
}

function generateCheckMacValue(params) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'CheckMacValue')
  );
  const sorted = Object.keys(filtered)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const paramStr = sorted.map(k => `${k}=${filtered[k]}`).join('&');
  const raw = `HashKey=${HASH_KEY}&${paramStr}&HashIV=${HASH_IV}`;
  const encoded = ecpayUrlEncode(raw);
  return crypto.createHash('sha256').update(encoded, 'utf8').digest('hex').toUpperCase();
}

function generateMerchantTradeNo() {
  const ts = Math.floor(Date.now() / 1000).toString();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FLW${ts}${rand}`.slice(0, 20);
}

async function queryTradeInfo(merchantTradeNo) {
  const params = {
    MerchantID: MERCHANT_ID,
    MerchantTradeNo: merchantTradeNo,
    TimeStamp: Math.floor(Date.now() / 1000).toString(),
  };
  params.CheckMacValue = generateCheckMacValue(params);

  const response = await fetch(QUERY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const text = await response.text();
  return Object.fromEntries(new URLSearchParams(text));
}

module.exports = { CHECKOUT_URL, MERCHANT_ID, generateCheckMacValue, generateMerchantTradeNo, queryTradeInfo };
