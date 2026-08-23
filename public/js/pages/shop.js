const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const products = ref([]);
    const pagination = ref({ total: 0, page: 1, limit: 9, totalPages: 0 });
    const loading = ref(true);
    const sortBy = ref('latest');
    const fallbackImage = 'https://images.unsplash.com/photo-1457089328109-e5d9bd499191?w=400';

    const sortedProducts = computed(function () {
      if (sortBy.value === 'price') {
        return products.value.slice().sort(function (a, b) { return a.price - b.price; });
      }
      return products.value;
    });

    async function loadProducts(page) {
      page = page || 1;
      loading.value = true;
      try {
        const res = await apiFetch('/api/products?page=' + page + '&limit=9');
        products.value = res.data.products.map(function (p) {
          p._adding = false;
          return p;
        });
        pagination.value = res.data.pagination;
      } catch (e) {
        products.value = [];
      } finally {
        loading.value = false;
      }
    }

    function setSort(key) {
      sortBy.value = key;
    }

    function goToProduct(id) {
      window.location.href = '/products/' + id;
    }

    async function addToCart(product) {
      if (product._adding) return;
      product._adding = true;
      try {
        await apiFetch('/api/cart', {
          method: 'POST',
          body: JSON.stringify({ productId: product.id, quantity: 1 })
        });
        Notification.show('已加入購物袋', 'success');
        // Update cart badge
        var badge = document.getElementById('cart-badge');
        if (badge) {
          var count = parseInt(badge.textContent || '0') + 1;
          badge.textContent = count;
          badge.style.display = 'flex';
        }
      } catch (e) {
        Notification.show('加入購物袋失敗', 'error');
      } finally {
        product._adding = false;
      }
    }

    onMounted(function () {
      loadProducts(1);
    });

    return {
      products, pagination, loading, sortBy, sortedProducts, fallbackImage,
      loadProducts, setSort, goToProduct, addToCart
    };
  }
}).mount('#app');
