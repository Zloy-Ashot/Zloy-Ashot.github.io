function $(){
    "use strict";
    if(typeof arguments[0] === 'string')
        if((/<[a-z]+>/).test(arguments[0])){
            return document.createElement(arguments[0].match(/[a-z]+/)[0]);
        }else{
            return document.querySelector(arguments[0]);
        }
}

// It is wrong! Don`t do this.
Element.prototype.find = Element.prototype.querySelector;
Element.prototype.findAll = Element.prototype.querySelectorAll;
Element.prototype.on = window.on = function(eventNames, callback){
    "use strict";
    var HTElement = this;
    eventNames.split(' ').forEach(function(eventName){
        HTElement.addEventListener(`${eventName}`, callback);
    });
};
Element.prototype.trigger = window.trigger = function(eventName){
    "use strict";
    var e = document.createEvent('HTMLEvents');
    e.initEvent(eventName);
    this.dispatchEvent(e);
};


class EventEmitter{
    constructor(){
        this.on = this.addEventListener;
        this.emmit = this.dispatchEvent;

        this.events = {};
    }
    addEventListener(eventName, callback){
        if(!this.events[eventName])
            this.events[eventName] = [];
        this.events[eventName].push(callback);
    }
    dispatchEvent(eventName, eventData){
        var eventEmitter = this;
        eventData = eventData || {};

        if(eventName in this.events)
            this.events[eventName].forEach(function(eventCallback){
                // this - event callback
                eventCallback.call(eventEmitter, eventData);
            });
    }
    removeEventListener(eventName, callback){
        if(!eventName in this.events)
            return false;

        var eventEmitter = this;

        this.events[eventName].forEach(function(targetCallback, eventNumber){
            if(targetCallback === callback)
                delete eventEmitter.events[eventNumber];
        });
    }
}

class Game extends EventEmitter{
    constructor(HTFieldWrap) {
        "use strict";
        super();
        var game = this;

        for (var i in game)
            if (game[i] === 'function')
                game[i] = game[i].bind(game);

        if (typeof HTFieldWrap === 'string')
            HTFieldWrap = $(HTFieldWrap);

        game.HT = {};
        game.HT.fieldWrap = HTFieldWrap;
        game.HT.fieldBox = HTFieldWrap.find('.game-field-box');
        game.HT.scoreBox = HTFieldWrap.find('.game-field__score-box');
        game.HT.scoreBest = HTFieldWrap.find('#best-score');
        game.HT.scoreCurrent = HTFieldWrap.find('#current-score');
        game.HT.field = HTFieldWrap.find('#cells-box');
        game.HT.particlesBox = HTFieldWrap.find('#particles-box');
        game.HT.particleBoxes = game.HT.particlesBox.findAll('.game-field__new-particle-container');
        game.HT.cells = [];

        game.data = {};
        game.data.newParticlesCount = 3;
        window.on('resize', function(e){
            var cellStyles = getComputedStyle($('.cell'));
            game.data.cellSizePX = cellStyles.width.replace('px', '')*1;
            game.data.cellMarginPX = cellStyles.margin.replace('px', '')*1;
            game.data.scaledCellSizePX = 33.19;
        });
        game.on('initdone', function(){
            window.trigger('resize');
        });

        // Initialize game field
        var HTCell = $('<div>');
        HTCell.classList.add('cell');
        HTCell.classList.add('empty');
        game.data.fieldSize = 10;
        for (var i = 0; i < (game.data.fieldSize**2); ++i) {
            if(Math.round(i/game.data.fieldSize-0.5)*game.data.fieldSize === i){
                game.HT.cells.push([]);
            }
            game.HT.cells[Math.round(i/game.data.fieldSize-0.5)].push(game.HT.field.appendChild(HTCell.cloneNode()));
        }


        // Generate
        game.generateNewParticles();

        //listeners
        window.oncontextmenu = function(){return false;};
        game.HT.fieldWrap.on('mousemove', function(e){
            if(!game.newParticle) return;
            if(!e.buttons) return;
            if(e.button !== 0) return;
            game.newParticleMove(e);
        });
        game.HT.fieldWrap.on('mouseup', function(e){
            if(!game.newParticle) return;
            if(game.data.isParticleCanDrop)
                game.newParticlePlace(e, game.newParticle.HTContainer);
            else
                game.newParticleReturn(e, game.newParticle);

        });
        game.on('particleplace', function(){
            game.data.newParticlesCount--;
            if(!game.data.newParticlesCount){
                game.data.newParticlesCount = 3;
                game.generateNewParticles();
            }
            if(!game.isNewParticlesCanPlace){
                game.emmit('gameover');
            }
        });
        game.emmit('initdone');
    }
    generateNewParticles(){
        "use strict";
        var game = this;
        game.HT.particleBoxes.forEach(function (particleBox) {
            var part = ParticlesGenerator.random();
            part.style.marginLeft = '0';
            particleBox.innerHTML = '';
            particleBox.appendChild(part);
            part.find('.new-particle-container').on('mousedown', function(e){
                if(!e.buttons) return;
                if(e.button !== 0) return;
                if(!e.target.classList.contains('cell')) return;
                game.newParticleMoveStart(e, this)
            })
        });
        if(!game.isNewParticlesCanPlace){
            game.emmit('gameover');
        }
    }
    tryToClearRowsAndCols(x, y, particleMap){
        "use strict";
        var game = this;

        function clearRowWithDelay(x, y){
            for(var i = 0; i < game.data.fieldSize; ++i) {
                game.HT.cells[y][i].children[0].classList.add('remove');

                // do not use this.on(), because it will multiple increase score
                game.HT.cells[y][i].children[0].on('transitionend', function(e){
                    if(e.propertyName !== 'height') return;
                    if(!this.parentElement) return;
                    game.HT.scoreCurrent.innerHTML = +game.HT.scoreCurrent.innerHTML+1;
                    this.parentElement.innerHTML = '';
                });
            }
        }
        function clearColWithDelay(x, y){
            for(var i = 0; i < game.data.fieldSize; ++i) {
                game.HT.cells[i][x].children[0].classList.add('remove');
                // do not use this.on(), because it will multiple increase score
                game.HT.cells[i][x].children[0].on('transitionend', function(e){
                    if(e.propertyName !== 'height') return;
                    if(!this.parentElement) return;
                    game.HT.scoreCurrent.innerHTML = +game.HT.scoreCurrent.innerHTML+1;
                    this.parentElement.innerHTML = '';
                });
            }
        }

        particleMap.forEach(function(row, py){
            row.forEach(function(cell, px){
                if(!cell) return;
                var isRowFilled = true;
                var isColFilled = true;
                for(var i = 0; i < game.data.fieldSize; ++i) {
                    isRowFilled &= !!game.HT.cells[py+y][i].children.length;
                }
                for(var i = 0; i < game.data.fieldSize; ++i) {
                    isColFilled &= !!game.HT.cells[i][px + x].children.length;
                }
                if(isRowFilled)
                    clearRowWithDelay(px + x, py + y);
                if(isColFilled)
                    clearColWithDelay(px + x, py + y);
            });
        });
    }
    get isNewParticlesCanPlace(){
        "use strict";
        //debugger;
        var game = this,
            particlesCanBePlaced = [],
            isGameOver = false;
        game.HT.particlesBox.findAll('.new-particle-container').forEach(function(HTParticleContainer){
            if(HTParticleContainer.style.display === 'none')return;
            var particleMap = ParticlesGenerator.particlesMap[HTParticleContainer.dataset.particleMap],
                particleWidth = particleMap[0].length,
                particleHeight = particleMap.length,
                mayPlaceWidth = game.data.fieldSize - particleWidth,
                mayPlaceHeight = game.data.fieldSize - particleHeight;

            var particleCanPlace = false;
            for(var y = 0; (y < mayPlaceHeight) && !particleCanPlace; ++y)
                for(var x = 0; (x < mayPlaceWidth) && !particleCanPlace; ++x){
                    particleCanPlace = game.tryToPlaceParticle(x, y, particleMap);
                }

            particlesCanBePlaced.push(particleCanPlace);
        });

        particlesCanBePlaced.forEach(function (canBePlaced) {
            isGameOver |= canBePlaced;
        });
        return isGameOver;
    }
    tryToPlaceParticle(x, y, map){
        "use strict";
        var game = this,
            particleCanBePlaced = true;
        map.forEach(function(row, px){
            row.forEach(function(cell, py){
                var cloneMap = map;
                if (cell && particleCanBePlaced)
                    particleCanBePlaced = !game.HT.cells[y + py][x + px].children.length;
            });
        });
        return particleCanBePlaced;
    }
    newParticleMoveStart(e, container){
        "use strict";
        var mouseOffsetX = e.target.offsetLeft - e.currentTarget.offsetLeft+e.offsetX,
            mouseOffsetY = e.target.offsetTop+e.offsetY;
        var game = this,
            particleBoxX = container.parentElement.parentElement.parentElement.offsetLeft,
            particleBoxY = container.parentElement.parentElement.parentElement.offsetTop,
            particleBoxWidth = container.find('.cell').clientWidth*container.dataset.width,
            particleBoxHeight = container.find('.cell').clientHeight*container.dataset.height,
            particleContainerX = container.offsetLeft + particleBoxX,
            particleContainerY = container.parentElement.offsetTop + particleBoxY,
            newContainer = container.cloneNode(true),
            newContainerWidth = container.dataset.width * (game.data.cellSizePX+game.data.cellMarginPX*2),
            newContainerHeight = container.dataset.height * (game.data.cellSizePX+game.data.cellMarginPX*2),
            newContainerX = particleContainerX - (mouseOffsetX*newContainerWidth/particleBoxWidth - mouseOffsetX),
            newContainerY = particleContainerY - (mouseOffsetY*newContainerHeight/particleBoxHeight - mouseOffsetY);

        newContainer.style.width = particleBoxWidth+'px';
        newContainer.style.height = particleBoxHeight+'px';
        newContainer.style.position = 'absolute';
        newContainer.style.left = `${particleContainerX}px`;
        newContainer.style.top = `${particleContainerY}px`;

        game.HT.fieldBox.appendChild(newContainer);
        setTimeout(()=>{
            newContainer.style.width = newContainerWidth;
            newContainer.style.height = newContainerHeight;
            newContainer.style.left = newContainerX;
            newContainer.style.top = newContainerY;
        }, 1);

        game.newParticle = {
            HTContainer: newContainer,
            HTReturnElement: container.parentElement
        };

        container.style.display = 'none';
    }
    newParticleReturn(e, container){
        "use strict";
        var game = this;
        if(!game.newParticle.HTContainer) return;
        var newParticleWidth = game.data.scaledCellSizePX * container.HTContainer.dataset.width,
            newParticleHeight = game.data.scaledCellSizePX * container.HTContainer.dataset.height,
            newParticlePosX = container.HTReturnElement.parentElement.parentElement.offsetLeft + container.HTReturnElement.clientWidth/2 - newParticleWidth/2,
            newParticlePosY = container.HTReturnElement.offsetTop+container.HTReturnElement.parentElement.parentElement.offsetTop
            ;

        container.HTContainer.style.width = newParticleWidth;
        container.HTContainer.style.height = newParticleHeight;
        container.HTContainer.style.left = newParticlePosX;
        container.HTContainer.style.top = newParticlePosY;
        container.HTContainer.on('transitionend',function(e){
            container.HTReturnElement.find('.new-particle-container').style.display = 'block';
            if(container.HTContainer){
                container.HTContainer.remove();
                delete container.HTContainer;
            }
        });
    }
    newParticlePlace(e, container){
        "use strict";
        var game = this;

        var HTFilledCell = $('<div>');
        HTFilledCell.style.backgroundColor = container.dataset.color;

        HTFilledCell.classList.add('filled');

        game.HT.field.findAll('.cell.hovered').forEach(function(HTCell){
            HTCell.appendChild(HTFilledCell.cloneNode());
            game.HT.scoreCurrent.innerHTML = (+game.HT.scoreCurrent.innerHTML)+1;
        });
        var coords = game.newParticleTranslateCoords(container);
        container.remove();
        delete game.newParticle;
        game.clearHighlight();
        game.emmit('particleplace');
        game.tryToClearRowsAndCols(coords.x, coords.y, ParticlesGenerator.particlesMap[container.dataset.particleMap])
    }

    newParticleMove(e){
        "use strict";
        window.getSelection().removeAllRanges();
        var game = this,
            HTMovableParticle = game.newParticle.HTContainer;
        if(!HTMovableParticle) return;
        HTMovableParticle.style.left = parseFloat(HTMovableParticle.style.left) + e.movementX+'px';
        HTMovableParticle.style.top = parseFloat(HTMovableParticle.style.top) + e.movementY+'px';
        var particleCoords = game.newParticleTranslateCoords(HTMovableParticle);

        game.data.isParticleCanDrop = game.highlightCells(HTMovableParticle, particleCoords);
    }
    newParticleTranslateCoords(particle){
        "use strict";
        var game = this;
        var viewCoords = {
            x: particle.style.left.replace('px', '')*1,
            y: particle.style.top.replace('px', '')*1
        };
        viewCoords.y -= game.HT.scoreBox.clientHeight;

        viewCoords.x = Math.round(viewCoords.x/(game.data.cellSizePX+game.data.cellMarginPX*2));
        viewCoords.y = Math.round(viewCoords.y/(game.data.cellSizePX+game.data.cellMarginPX*2));

        return viewCoords;
    }
    clearHighlight(){
        "use strict";
        var game = this;
        game.HT.cells.forEach(function(row){
            row.forEach(function(HTCell){
                HTCell.classList.remove('hovered');
            });
        });
    }
    highlightCells(particle, coords){
        "use strict";
        var game = this;

        //clear
        game.clearHighlight();

        var highlightMap = ParticlesGenerator.particlesMap[particle.dataset.particleMap];

        if(coords.x >= game.data.fieldSize - highlightMap[0].length+1) return false;
        if(coords.y >= game.data.fieldSize - highlightMap.length+1) return false;
        if(coords.x < 0) return false;
        if(coords.y < 0) return false;

        var highLightMustBeCleared = false;
        highlightMap.forEach(function(row, rowNum){
            row.forEach(function(hover, colNum){
                var HTCell = game.HT.cells[coords.y+rowNum][coords.x+colNum];
                if (hover)
                    if(!HTCell.children.length) {
                            HTCell.classList.add('hovered');
                    }else{
                        highLightMustBeCleared = true;
                    }
            });
        });
        if(highLightMustBeCleared)
            game.clearHighlight();

        return !highLightMustBeCleared;
    }
}

class ParticlesGenerator{
    static random(){
        "use strict";
        try {
            return ParticlesGenerator.HTParticles[Math.round(Math.random() * (ParticlesGenerator.HTParticles.length-1))].cloneNode(true);
        }catch(e){
            debugger;
        }
    }

    static _genParticleHTMLView(particleMap, particleNum, particleCSS){
        "use strict";
        var particleHeight = particleMap.length,
            particleWidth = particleMap[0].length,
            isParticleVertical = particleHeight>particleWidth,
            HTParticleBox = $('<div>'),
            //HTParticleSizer = $('<img>'),
            HTParticleContainer = $('<div>'),
            HTParticleCell = $('<div>'),
            HTParticleCellEmpty = $('<div>'),
            particleColor = `rgb(${Math.round(Math.random()*255)},${Math.round(Math.random()*255)},${Math.round(Math.random()*255)})`;


        particleCSS.innerHTML += `.new-particle-container[data-particle-num="${particleNum}"] .cell::after{background-color: ${particleColor}}\n`;

        HTParticleBox.classList.add('new-particle-box');
        //HTParticleBox.appendChild(HTParticleSizer);
        HTParticleBox.appendChild(HTParticleContainer);
        HTParticleBox.style.height = `${100*(particleHeight/5)}%`;
        HTParticleBox.style.marginTop = `${50-50*(particleHeight/5)}%`;

        //HTParticleSizer.src = `sizers/${particleWidth}x${particleHeight}.png`;
        //HTParticleSizer.classList.add('new-particle-box-sizer');
        //HTParticleSizer.style[isParticleVertical?'height': 'width'] = '100%';

        HTParticleContainer.classList.add('new-particle-container');
        HTParticleContainer.dataset.particleNum = particleNum;
        HTParticleContainer.style.width = `${100*(particleWidth/5)}%`;
        HTParticleContainer.dataset.width = particleWidth;
        HTParticleContainer.dataset.height = particleHeight;
        HTParticleContainer.dataset.particleMap = particleNum;
        HTParticleContainer.dataset.color = particleColor;

        HTParticleCell.classList.add('cell');
        HTParticleCell.style.width = `${100/particleWidth}%`;
        HTParticleCell.style.height = `${100/particleHeight}%`;

        HTParticleCellEmpty.classList.add('cell');
        HTParticleCellEmpty.classList.add('space');
        HTParticleCellEmpty.style.width = `${100/particleWidth}%`;
        HTParticleCellEmpty.style.height = `${100/particleHeight}%`;

        particleMap.forEach(function(particleRow){
            particleRow.forEach(function(cellState){
                var HTCell = null;
                if(cellState)
                    HTCell = HTParticleCell;
                else
                    HTCell = HTParticleCellEmpty;

                HTParticleContainer.appendChild(HTCell.cloneNode());
            });
        });
        //HTParticleContainer.appendChild(HTClear.cloneNode());


        return HTParticleBox;
    }

    static generateParticlesHTMLView(){
        "use strict";
        var particleCSS = $('<style>');
        document.head.appendChild(particleCSS);

        ParticlesGenerator.HTParticles = [];
        ParticlesGenerator.particlesMap.forEach(function(particleMap, particleNum){
            ParticlesGenerator.HTParticles.push(ParticlesGenerator._genParticleHTMLView(particleMap, particleNum, particleCSS));
        });
    }
}

ParticlesGenerator.particlesMap = [
    [
        [1,1,1,1,1]
    ],
    [
        [1,1,1,1]
    ],
    [
        [1,1,1]
    ],
    [
        [1,1]
    ],
    [
        [1],
        [1],
        [1],
        [1],
        [1]
    ],
    [
        [1],
        [1],
        [1],
        [1]
    ],
    [
        [1],
        [1],
        [1]
    ],
    [
        [1],
        [1]
    ],
    [
        [1]
    ],
    [
        [1,1,1],
        [1,1,1],
        [1,1,1]
    ],
    [
        [1,1],
        [1,1]
    ],
    [
        [1,1,1],
        [1,0,0],
        [1,0,0]
    ],
    [
        [1,1,1],
        [0,0,1],
        [0,0,1]
    ],
    [
        [1,0,0],
        [1,0,0],
        [1,1,1]
    ],
    [
        [0,0,1],
        [0,0,1],
        [1,1,1]
    ]
];
ParticlesGenerator.generateParticlesHTMLView();