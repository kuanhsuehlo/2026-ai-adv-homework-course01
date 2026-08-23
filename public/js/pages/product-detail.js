const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    const productId = document.getElementById('app').dataset.productId;
    const product = ref(null);
    const related = ref([]);
    const loading = ref(true);
    const notFound = ref(false);
    const quantity = ref(1);
    const adding = ref(false);
    const fallbackImage = 'https://images.unsplash.com/photo-1457089328109-e5d9bd499191?w=600';

    function decrease() {
      if (quantity.value > 1) quantity.value--;
    }

    function increase() {
      if (product.value && quantity.value < product.value.stock) quantity.value++;
    }

    function goToProduct(id) {
      window.location.href = '/products/' + id;
    }

    async function addToCart() {
      if (!product.value || adding.value) return;
      adding.value = true;
      try {
        await apiFetch('/api/cart', {
          method: 'POST',
          body: JSON.stringify({ productId: product.value.id, quantity: quantity.value })
        });
        Notification.show('已加入購物袋', 'success');
        var badge = document.getElementById('cart-badge');
        if (badge) {
          var count = parseInt(badge.textContent || '0') + 1;
          badge.textContent = count;
          badge.style.display = 'flex';
        }
      } catch (e) {
        Notification.show('加入購物袋失敗', 'error');
      } finally {
        adding.value = false;
      }
    }

    async function loadRelated() {
      try {
        const res = await apiFetch('/api/products?page=1&limit=4');
        related.value = res.data.products
          .filter(function (p) { return p.id !== productId; })
          .slice(0, 3);
      } catch (e) {
        related.value = [];
      }
    }

    onMounted(async function () {
      try {
        const res = await apiFetch('/api/products/' + productId);
        product.value = res.data;
      } catch (e) {
        notFound.value = true;
      } finally {
        loading.value = false;
      }
      loadRelated();
    });

    return {
      product, related, loading, notFound, quantity, adding, fallbackImage,
      decrease, increase, goToProduct, addToCart
    };
  }
}).mount('#app');
