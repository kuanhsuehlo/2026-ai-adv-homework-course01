const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    if (!Auth.requireAuth()) return {};

    const el = document.getElementById('app');
    const orderId = el.dataset.orderId;
    const paymentResult = ref(el.dataset.paymentResult || null);

    const order = ref(null);
    const loading = ref(true);
    const paying = ref(false);
    const checking = ref(false);

    const statusMap = {
      pending: { label: '待付款', cls: 'bg-apricot/20 text-apricot' },
      paid: { label: '已付款', cls: 'bg-sage/20 text-sage' },
      failed: { label: '付款失敗', cls: 'bg-red-100 text-red-600' },
    };

    const paymentMessages = {
      success: { text: '付款成功！感謝您的購買。', cls: 'bg-sage/10 text-sage border border-sage/20' },
      failed: { text: '付款失敗，請重試。', cls: 'bg-red-50 text-red-600 border border-red-100' },
      cancel: { text: '付款已取消。', cls: 'bg-apricot/10 text-apricot border border-apricot/20' },
      atm_pending: { text: 'ATM／超商取號成功，請依畫面上的帳號／代碼完成繳費。繳費後點「查詢付款狀態」確認。', cls: 'bg-apricot/10 text-apricot border border-apricot/20' },
    };

    async function handlePayWithEcpay() {
      if (!order.value || paying.value) return;
      paying.value = true;
      try {
        const res = await apiFetch('/api/ecpay/create-payment', {
          method: 'POST',
          body: JSON.stringify({ orderId: order.value.id })
        });
        const { formUrl, params } = res.data;

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = formUrl;
        for (const [key, value] of Object.entries(params)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
      } catch (e) {
        Notification.show('付款處理失敗，請稍後再試', 'error');
        paying.value = false;
      }
    }

    async function handleCheckPayment() {
      if (!order.value || checking.value) return;
      checking.value = true;
      try {
        const res = await apiFetch('/api/ecpay/check-payment', {
          method: 'POST',
          body: JSON.stringify({ orderId: order.value.id })
        });
        if (res.data.status === 'paid') {
          order.value = { ...order.value, status: 'paid' };
          paymentResult.value = 'success';
          Notification.show('付款成功！', 'success');
        } else {
          Notification.show('尚未收到付款，請完成繳費後再查詢', 'info');
        }
      } catch (e) {
        Notification.show('查詢失敗，請稍後再試', 'error');
      } finally {
        checking.value = false;
      }
    }

    onMounted(async function () {
      try {
        const res = await apiFetch('/api/orders/' + orderId);
        order.value = res.data;
      } catch (e) {
        Notification.show('載入訂單失敗', 'error');
      } finally {
        loading.value = false;
      }
    });

    return { order, loading, paying, checking, paymentResult, statusMap, paymentMessages, handlePayWithEcpay, handleCheckPayment };
  }
}).mount('#app');
