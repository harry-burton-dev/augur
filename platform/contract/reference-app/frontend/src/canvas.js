/*
 * The reference app's canvas (spec 6.11): one script, loaded in the shell's canvas page. It draws its own
 * pixels, and says over the port the app gave it what its origin is and whether it could reach the network.
 */
(function () {
  'use strict';
  var port = window.augurCanvas;
  var canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 40;
  canvas.getContext('2d').fillRect(0, 0, 120, 40);
  document.body.appendChild(canvas);
  port.onmessage = function (e) {
    var said = 'heard ' + e.data + '; origin ' + window.origin;
    fetch('/api/reference/v1/echo').then(
      function () {
        port.postMessage(said + '; fetch reached the network');
      },
      function () {
        port.postMessage(said + '; fetch refused');
      },
    );
  };
})();
