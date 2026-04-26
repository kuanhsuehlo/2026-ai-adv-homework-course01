const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/authMiddleware');
const {
  CHECKOUT_URL,
  MERCHANT_ID,
  generateCheckMacValue,
  generateMerchantTradeNo,
  queryTradeInfo,
} = require('../utils/ecpay');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// ── API router（掛載於 /api/ecpay）────────────────────────────────────────────
const apiRouter = express.Router();

apiRouter.post('/create-payment', authMiddleware, (req, res) => {
  const { orderId } = req.body;
  const userId = req.user.userId;

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId);
  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '訂單不存在' });
  }
  if (order.status !== 'pending') {
    return res.status(400).json({ data: null, error: 'INVALID_STATUS', message: '訂單狀態不是 pending' });
  }

  const merchantTradeNo = generateMerchantTradeNo();
  db.prepare('UPDATE orders SET ecpay_merchant_trade_no = ? WHERE id = ?').run(merchantTradeNo, order.id);

  const items = db.prepare('SELECT product_name FROM order_items WHERE order_id = ?').all(order.id);
  const itemName = items.map(i => i.product_name).join('#').slice(0, 200);

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const tradeDate = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const params = {
    MerchantID: MERCHANT_ID,
    MerchantTradeNo: merchantTradeNo,
    MerchantTradeDate: tradeDate,
    PaymentType: 'aio',
    TotalAmount: order.total_amount,
    TradeDesc: '花卉電商訂單',
    ItemName: itemName,
    ReturnURL: `${BASE_URL}/ecpay/notify`,
    OrderResultURL: `${BASE_URL}/ecpay/result`,
    ChoosePayment: 'ALL',
    EncryptType: 1,
    // staging 環境自動模擬付款成功，免真實銀行帳號
    ...(process.env.ECPAY_ENV !== 'production' && { SimulatePaid: 1 }),
  };
  params.CheckMacValue = generateCheckMacValue(params);

  res.json({ data: { formUrl: CHECKOUT_URL, params }, error: null, message: '付款表單已建立' });
});

// 主動查詢付款狀態（給 ATM/超商等非即時付款方式使用）
apiRouter.post('/check-payment', authMiddleware, async (req, res) => {
  const { orderId } = req.body;
  const userId = req.user.userId;

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId);
  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '訂單不存在' });
  }
  if (!order.ecpay_merchant_trade_no) {
    return res.status(400).json({ data: null, error: 'NO_TRADE', message: '此訂單尚未發起付款' });
  }
  if (order.status !== 'pending') {
    return res.json({ data: { status: order.status }, error: null, message: '訂單狀態已確認' });
  }

  try {
    const tradeInfo = await queryTradeInfo(order.ecpay_merchant_trade_no);
    if (tradeInfo.TradeStatus === '1') {
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('paid', order.id);
      return res.json({ data: { status: 'paid' }, error: null, message: '付款成功' });
    }
    return res.json({ data: { status: 'pending' }, error: null, message: '尚未收到付款，請完成 ATM/超商繳費後再查詢' });
  } catch (err) {
    console.error('[ECPay] check-payment QueryTradeInfo 失敗:', err.message);
    return res.status(500).json({ data: null, error: 'QUERY_FAILED', message: '查詢失敗，請稍後再試' });
  }
});

// ── Callback router（掛載於 /ecpay）──────────────────────────────────────────
const callbackRouter = express.Router();

// OrderResultURL：綠界付款後瀏覽器跳轉（Form POST）
// RtnCode=1：信用卡即時付款成功
// RtnCode=2/10100073 等：ATM/超商取號成功，消費者尚未繳費，保持 pending
callbackRouter.post('/result', async (req, res) => {
  const { MerchantTradeNo, RtnCode } = req.body;

  if (!MerchantTradeNo) {
    return res.redirect('/?payment=invalid');
  }

  const order = db.prepare('SELECT * FROM orders WHERE ecpay_merchant_trade_no = ?').get(MerchantTradeNo);
  if (!order) {
    return res.redirect('/?payment=invalid');
  }

  // 冪等保護：若已處理過，直接跳轉
  if (order.status !== 'pending') {
    const result = order.status === 'paid' ? 'success' : 'failed';
    return res.redirect(`/orders/${order.id}?payment=${result}`);
  }

  // RtnCode=1：即時付款成功（信用卡／WebATM 成功），呼叫 QueryTradeInfo 確認
  if (RtnCode === '1') {
    try {
      const tradeInfo = await queryTradeInfo(MerchantTradeNo);
      const newStatus = tradeInfo.TradeStatus === '1' ? 'paid' : 'failed';
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, order.id);
      const result = newStatus === 'paid' ? 'success' : 'failed';
      return res.redirect(`/orders/${order.id}?payment=${result}`);
    } catch (err) {
      console.error('[ECPay] QueryTradeInfo 失敗:', err.message);
      return res.redirect(`/orders/${order.id}?payment=failed`);
    }
  }

  // RtnCode=2：ATM 虛擬帳號已產生（待繳費）
  // RtnCode=10100073：超商代碼已產生（待繳費）
  // → 訂單保持 pending，提示用戶繳費後查詢
  const DEFERRED_CODES = new Set(['2', '10100073']);
  if (DEFERRED_CODES.has(RtnCode)) {
    return res.redirect(`/orders/${order.id}?payment=atm_pending`);
  }

  // 其他 RtnCode：付款失敗或用戶取消
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('failed', order.id);
  return res.redirect(`/orders/${order.id}?payment=failed`);
});

// ReturnURL：Server-to-Server 回呼（本地端不會收到，防禦性處理）
callbackRouter.post('/notify', (req, res) => {
  res.type('text').send('1|OK');
});

module.exports = { apiRouter, callbackRouter };
