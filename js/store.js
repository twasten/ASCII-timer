const Store = {
  prefix: 'phosphor.',
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (e) { /* private mode / storage full: run without persistence */ }
  },
};
