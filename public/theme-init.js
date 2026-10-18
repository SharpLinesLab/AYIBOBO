// Apply the saved theme before first paint to avoid a flash. Loaded as a plain blocking script in
// <head> (not inline) so the Content-Security-Policy can forbid inline scripts.
try {
  var t = localStorage.getItem('asf:theme');
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
} catch (e) {}
