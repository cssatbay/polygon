// Вписывает экран 1194×834 в окно с сохранением пропорций
(function () {
  var W = 1194, H = 834, stage = document.getElementById('stage');
  function fit() {
    var s = Math.min(window.innerWidth / W, window.innerHeight / H);
    stage.style.transform = 'translate(' + (window.innerWidth - W * s) / 2 + 'px,' + (window.innerHeight - H * s) / 2 + 'px) scale(' + s + ')';
    stage.style.borderRadius = s >= 0.999 ? '18px' : '0';
  }
  window.addEventListener('resize', fit);
  fit();
})();
