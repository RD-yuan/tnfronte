const counterButton = document.querySelector('[data-count]');

window.incrementCounter = function incrementCounter() {
  if (!counterButton) return;

  const current = Number(counterButton.getAttribute('data-count') ?? '0');
  const next = current + 1;
  counterButton.setAttribute('data-count', String(next));
  counterButton.textContent = `Increment (${next})`;
};
