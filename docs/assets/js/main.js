(function () {
  'use strict';

  document.addEventListener("DOMContentLoaded", () => {
    // A box that scrolls sideways (a wide table, a long code line) has to be
    // reachable by keyboard too, not just by dragging it.
    document.querySelectorAll('pre, table').forEach(el => {
      if (el.scrollWidth > el.clientWidth) {
        el.tabIndex = 0
        el.setAttribute('role', 'group')
        el.setAttribute('aria-label', el.tagName === 'TABLE' ? 'Table, scrolls sideways' : 'Code, scrolls sideways')
      }
    })
  })
})();
