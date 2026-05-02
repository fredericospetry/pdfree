(function () {
  'use strict';

  var canvas = document.createElement('canvas');
  canvas.id = 'plexus-bg';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;';
  document.body.insertBefore(canvas, document.body.firstChild);

  var ctx = canvas.getContext('2d');
  var W, H, nodes;

  var NODE_COUNT   = 80;
  var SPEED        = 0.38;
  var MAX_DIST     = 155;
  var BG_COLOR     = '#020a02';
  var LINE_COLOR   = [0, 200, 50];
  var GLOW_COLOR   = '#cfffcf';
  var GLOW_CHANCE  = 0.13;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function randomNode() {
    var glow = Math.random() < GLOW_CHANCE;
    return {
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: (Math.random() - 0.5) * SPEED * 2,
      vy: (Math.random() - 0.5) * SPEED * 2,
      r:  glow ? 1.8 + Math.random() * 0.8 : 0.6 + Math.random() * 1.0,
      glow: glow
    };
  }

  function init() {
    resize();
    nodes = [];
    for (var i = 0; i < NODE_COUNT; i++) nodes.push(randomNode());
  }

  function draw() {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, W, H);

    // Lines
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var dx = nodes[i].x - nodes[j].x;
        var dy = nodes[i].y - nodes[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_DIST) {
          var alpha = (1 - dist / MAX_DIST) * 0.55;
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(' + LINE_COLOR[0] + ',' + LINE_COLOR[1] + ',' + LINE_COLOR[2] + ',' + alpha + ')';
          ctx.lineWidth = 0.8;
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // Nodes
    for (var k = 0; k < nodes.length; k++) {
      var n = nodes[k];
      ctx.beginPath();

      if (n.glow) {
        ctx.shadowBlur  = 14;
        ctx.shadowColor = GLOW_COLOR;
      } else {
        ctx.shadowBlur  = 0;
        ctx.shadowColor = 'transparent';
      }

      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = n.glow
        ? GLOW_COLOR
        : 'rgba(' + LINE_COLOR[0] + ',' + LINE_COLOR[1] + ',' + LINE_COLOR[2] + ',0.75)';
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  }

  function update() {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', function () {
    resize();
  });

  init();
  loop();
})();
