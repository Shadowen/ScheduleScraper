/////
// Based on
// http://codepen.io/neilcarpenter/pen/oeGwD/
(function() {
    var canvas = $('<canvas></canvas>')
        .css('position', 'fixed')
        .css('top', 0)
        // .css('height', '100vh')
        .attr('height', window.innerHeight)
        .css('left', 0)
        // .css('width', '100vw')
        .attr('width', window.innerWidth)
        .css('background-color', 'rgba(0,0,0,0.9)')
        .css('z-index', 9000)
        .hide()
        .appendTo('body')
        .fadeIn(1000);

    var stripCount = 25;
    var strips = [];
    // Settings {
    var MIN_FONT_SIZE = 1;
    var MAX_FONT_SIZE = 32;
    var letters = ['0', '1'];
    var MAX_CHARS = 50;
    var MIN_CHARS = 10;
    var colours = [{
        r: 206,
        g: 251,
        b: 228
    }, {
        r: 129,
        g: 236,
        b: 114
    }, {
        r: 92,
        g: 214,
        b: 70
    }, {
        r: 84,
        g: 209,
        b: 60
    }, {
        r: 76,
        g: 204,
        b: 50
    }, {
        r: 67,
        g: 199,
        b: 40
    }];
    var MAX_OPACITY = 0.4;
    var MIN_OPACITY = 0.1;
    var MAX_SPEED = 0.5;
    var MIN_SPEED = 0.1;
    // }

    var context = canvas[0].getContext('2d');

    function toRGBA(rgb, a) {
        return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + a + ')';
    }
    var seedStrips = function(y) {
        var strip = {};
        strip.fontSize = Math.floor(Math.random() * (MAX_FONT_SIZE - MIN_FONT_SIZE)) + MIN_FONT_SIZE;
        strip.x = Math.floor(Math.random() * canvas.width())
        strip.y = y ? y : -100;
        strip.dy = (Math.floor(Math.random() * (MAX_SPEED - MIN_SPEED)) + MIN_SPEED) * (strip.fontSize);
        strip.alpha = Math.random() * (MAX_OPACITY - MIN_OPACITY) + MIN_OPACITY;
        var numChars = Math.max(Math.floor(Math.random() * (MAX_CHARS - MIN_CHARS)) - strip.fontSize, 0) + MIN_CHARS;
        strip.chars = [];
        for (var j = 0; j < numChars; j++) {
            strip.chars.push(letters[Math.floor(Math.random() * letters.length)]);
        }
        strips.push(strip);
    };
    for (var i = 0; i < stripCount; i++) {
        seedStrips(Math.floor(Math.random() * canvas.height()));
    };
    (function draw() {
        // Regenerate strips that are out of bounds
        for (var i = 0; i < strips.length; i++) {
            if (strips[i].y > canvas.height() + strips[i].chars.length * strips[i].fontSize) {
                strips.splice(i, 1);
                setTimeout(seedStrips(), Math.floor(Math.random() * 1000));
            }
        }
        // Clear the canvas and set the properties
        context.clearRect(0, 0, canvas.width(), canvas.height());
        context.shadowOffsetX = context.shadowOffsetY = 0;
        context.shadowBlur = 8;
        context.shadowColor = '#94f475';
        // Draw the strips
        for (var j = 0; j < strips.length; j++) {
            var strip = strips[j];
            context.font = strip.fontSize + 'px MatrixCode';
            var y = strip.y;
            for (var k = 0; k < strip.chars.length; k++) {
                switch ((k % 10) / 3) {
                    case 0:
                        context.fillStyle = toRGBA(colours[0], strip.alpha);
                        break;
                    case 1:
                        context.fillStyle = toRGBA(colours[1], strip.alpha);
                        break;
                    case 2:
                        context.fillStyle = toRGBA(colours[2], strip.alpha);
                        break;
                    case 3:
                        context.fillStyle = toRGBA(colours[3], strip.alpha);
                        break;
                    case 4:
                        context.fillStyle = toRGBA(colours[4], strip.alpha);
                        break;
                    case 5:
                        context.fillStyle = toRGBA(colours[5], strip.alpha);
                        break;
                }
                context.fillText(strip.chars[k], strip.x, y);
                y -= strip.fontSize;
            }
            strip.y += strip.dy;
        }
        setTimeout(draw, 1000 / 30);
    })();


    // Draw loading bar and text
    // https://css-tricks.com/css3-progress-bars/
    (function update(container) {
        if (container) {
            update.deferred = $.Deferred();
            // Constructing DOM
            update.container = container;
            update.container
                .css('cursor', 'progress');
            overlay = $('<div></div>')
                .css('position', 'fixed')
                .css('top', '50%')
                .css('left', '50%')
                .css('transform', 'translate(-50%,-50%)')
                .css('color', 'rgba(255,255,255,0.8)')
                .css('font-size', 'large')
                .css('z-index', 9001);
            update.textBox = $('<div></div>')
                .attr('id', 'loading-text')
                .text('Please hold...');
            overlay.append(update.textBox);
            update.progressBarContainer = $('<div></div>')
                .css('position', 'relative')
                .css('height', '20px')
                .css('width', '30vw')
                .css('border-radius', '25px')
                .css('background-color', 'white')
                .css('padding', '10px')
                .css('margin', '10px')
                .css('box-shadow', 'inset 0 -1px 1px rgba(255,255,255,0.3)')
                .css('text-align', 'left');
            update.progressBar = $('<span></span>')
                .css('display', 'block')
                .css('height', '100%')
                .css('width', '0')
                .css('border-top-right-radius', '8px')
                .css('border-bottom-right-radius', '8px')
                .css('border-top-left-radius', '20px')
                .css('border-bottom-left-radius', '20px')
                .css('background-color', 'rgb(43,194,83)')
                .css('background-image', 'linear-gradient(center bottom, rgb(43, 194, 83) 37 % ,rgb(84, 240, 84) 69 %)')
                .css('box-shadow', 'inset 0 2 px 9 px rgba(255, 255, 255, 0.3),inset 0 - 2 px 6 px rgba(0, 0, 0, 0.4))')
                .css('overflow', 'hidden');
            update.progressBarContainer.append(update.progressBar);
            overlay.append(update.progressBarContainer);
            update.container.append(overlay);
            update.close = $('<div></div>').attr('id', 'close')
                .text('stop')
                .css('color', 'rgba(255,0,0,0.8)')
                .css('font-size', 'larger')
                .css('position', 'fixed')
                .css('bottom', 0)
                .css('right', 0)
                .css('padding', '10px')
                .css('cursor', 'not-allowed')
                .css('z-index', 9001);
            update.container.append(update.close);
            // Init function
            update.messages = [
                'Unpacking viruses...', 200,
                'Installing keylogger...', 500,
                'Verifying quantum tunnel...', 800,
                'Hacking course database...', 300,
                'Decrypting encryption...', 500,
                'Deconflicting courses...', 400,
                'Deploying thermonuclear weapons...', 300,
                'Generating miniature black hole...', 700,
                'Destroying evidence...', 900
            ];
            update.progress = 0;
            update.totalProgress = update.messages.reduce(function(prev, cur, idx, array) {
                return prev + (idx % 2 == 1 ? cur : 0);
            }, 0);
            update.index = 0;
        }

        if (update.index >= update.messages.length) {
            update.textBox.text('Done!');
            update.progressBar.animate({
                width: '100%',
                'border-top-right-radius': '20px',
                'border-bottom-right-radius': '20px'
            }, {
                complete: function() {
                    update.deferred.resolve(update.container);
                }
            });
        } else {
            update.textBox.text(update.messages[update.index++]);
            update.progressBar.animate({
                width: update.progress / update.totalProgress * 100 + '%'
            }, {
                duration: 500
            });
            update.progress += update.messages[update.index];
            update.deferred.notify(update.progress);
            setTimeout(update, update.messages[update.index++])
        }
        return update.deferred.promise();
    })($('<div></div>').appendTo('body'))
    .then(function(container) {
        var deferred = $.Deferred();
        container.children().fadeOut(1000);
        canvas.fadeOut(1000);
        setTimeout(deferred.resolve, 1000);
        return deferred;
    }).then(function() {
        $('body').data('f57b7ad2ab284e388323484708a031f7').resolve();
    });
})();
