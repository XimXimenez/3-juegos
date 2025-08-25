document.addEventListener('DOMContentLoaded', () => {
    // Constantes del juego
    const ROWS = 6;
    const COLS = 8;
    const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const SUITS = ['C', 'D', 'P', 'T']; // Clubs, Diamonds, Hearts, Spades
    
    // Elementos DOM
    const gameBoard = document.getElementById('game-board');
    const scoreElement = document.getElementById('score');
    const energyElement = document.getElementById('energy');
    const energyContainer = document.getElementById('energy-container');
    const previewContainer = document.getElementById('preview-container');
    const nextPiecePreview = document.getElementById('next-piece-preview');
    const rotateButton = document.getElementById('rotate-button');
    const refillButton = document.getElementById('refill-button');
    const pauseButton = document.getElementById('pause-button');
    const endButton = document.getElementById('end-button');
    const welcomeModal = document.getElementById('welcome-modal');
    const endGameModal = document.getElementById('end-game-modal');
    const finalScoreElement = document.getElementById('final-score');
    const endGameTitleElement = document.getElementById('end-game-title');
    
    // Títulos de modo
    const titleConstructor = document.getElementById('title-constructor');
    const titleEspejo = document.getElementById('title-espejo');
    const titleCascada = document.getElementById('title-cascada');
    const playConstructorBtn = document.getElementById('play-constructor');
    const playEspejoBtn = document.getElementById('play-espejo');
    const playCascadaBtn = document.getElementById('play-cascada');

    // Estado del juego
    let gameMode = '';
    let board = [];
    let score = 0;
    let energy = 3;
    let gameRunning = false;
    let gamePaused = false;
    
    // Estado específico por modo
    let constructorPieces = [];
    let currentPiece = null;
    let nextPiece = null;
    let pieceRotation = 0;
    let previewPosition = { row: 0, col: 0 };
    
    let espejoHighlighted = [];
    let espejoRefillsLeft = 2;
    let discardPile = [];
    
    let cascadaInterval = null;
    let fallingCard = null;
    let fallingColumn = 4;
    let cascadaDeck = [];

    // Funciones auxiliares
    function createDeck() {
        const deck = [];
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                deck.push({ rank, suit });
            }
        }
        return deck;
    }

    function shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function createPiece(type) {
        const deck = createDeck();
        const shuffled = shuffle(deck);
        
        if (type === 'trio') {
            return {
                type: 'trio',
                cards: shuffled.slice(0, 3),
                shape: [[0], [1], [2]] // Vertical por defecto
            };
        } else {
            return {
                type: 'quad',
                cards: shuffled.slice(0, 4),
                shape: [[0, 1], [2, 3]] // 2x2
            };
        }
    }

    function rotatePiece(piece) {
        if (piece.type === 'trio') {
            if (piece.shape.length === 3) { // Vertical -> Horizontal
                piece.shape = [[0, 1, 2]];
            } else { // Horizontal -> Vertical
                piece.shape = [[0], [1], [2]];
            }
        }
        // Los cuadrados no necesitan rotación
    }

    function clearBoard() {
        board = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
    }

    function getPotentialGroupSize(r, c, suit) {
        // Temporarily place card
        const originalCard = board[r][c];
        board[r][c] = { suit: suit, rank: 'temp' };

        const group = findConnectedGroup(r, c, new Set());

        // Revert board change
        board[r][c] = originalCard;

        return group.length;
    }

    function fillBoardForEspejo() {
        clearBoard();
        const deck = shuffle(createDeck());

        const positions = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                positions.push({ r, c });
            }
        }
        shuffle(positions);

        for (const pos of positions) {
            const { r, c } = pos;

            const validSuits = [];
            const groupSizes = [];

            for (const suit of SUITS) {
                const groupSize = getPotentialGroupSize(r, c, suit);
                if (groupSize < 3) {
                    validSuits.push(suit);
                }
                groupSizes.push({ suit, size: groupSize });
            }

            let bestSuit;
            if (validSuits.length > 0) {
                // If there are suits that don't form a group, pick one randomly.
                bestSuit = validSuits[Math.floor(Math.random() * validSuits.length)];
            } else {
                // If all suits form a group, pick the one that forms the smallest group.
                groupSizes.sort((a, b) => a.size - b.size);
                const minSize = groupSizes[0].size;
                const bestOptions = groupSizes.filter(item => item.size === minSize);
                bestSuit = bestOptions[Math.floor(Math.random() * bestOptions.length)].suit;
            }

            // Place the card for real.
            const cardFromDeck = deck.pop();
            board[r][c] = { suit: bestSuit, rank: cardFromDeck.rank };
        }
    }

    function fillBoardRandom() {
        const deck = shuffle(createDeck());
        let cardIndex = 0;
        
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (cardIndex < deck.length) {
                    board[r][c] = deck[cardIndex++];
                }
            }
        }
        
        // Eliminar grupos iniciales
        setTimeout(() => {
            eliminateGroups();
            renderBoard();
        }, 100);
    }

    function renderBoard() {
        gameBoard.innerHTML = '';
        
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const slot = document.createElement('div');
                slot.classList.add('card-slot');
                slot.dataset.row = r;
                slot.dataset.col = c;
                
                // Agregar clases especiales según el modo
                if (gameMode === 'espejo' && isHighlighted(r, c)) {
                    slot.classList.add('highlight');
                }
                
                const card = board[r][c];
                if (card) {
                    const img = document.createElement('img');
                    img.src = `images/${card.rank}${card.suit}.png`;
                    img.alt = `${card.rank} of ${card.suit}`;
                    img.classList.add('card-image');
                    slot.appendChild(img);
                }
                
                // Event listeners según el modo
                if (gameMode === 'espejo') {
                    slot.addEventListener('click', () => handleEspejoClick(r, c));
                }
                
                gameBoard.appendChild(slot);
            }
        }
    }

    function isHighlighted(row, col) {
        return espejoHighlighted.some(pos => pos.row === row && pos.col === col);
    }

    function canPlacePieceAt(startRow, startCol) {
        if (!currentPiece) return false;
        
        const shape = currentPiece.shape;
        const pieceHeight = shape.length;
        const pieceWidth = Math.max(...shape.map(row => row.length));
        
        if (startRow + pieceHeight > ROWS || startCol + pieceWidth > COLS) {
            return false;
        }
        
        for (let r = 0; r < pieceHeight; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (board[startRow + r][startCol + c] !== null) {
                    return false;
                }
            }
        }
        
        return true;
    }

    function findConnectedGroup(startRow, startCol, visited = new Set()) {
        const card = board[startRow][startCol];
        if (!card) return [];
        
        const key = `${startRow},${startCol}`;
        if (visited.has(key)) return [];
        
        visited.add(key);
        const group = [{ row: startRow, col: startCol, card }];
        
        // Verificar vecinos (4 direcciones)
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of directions) {
            const newRow = startRow + dr;
            const newCol = startCol + dc;
            
            if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS) {
                const neighborCard = board[newRow][newCol];
                if (neighborCard && neighborCard.suit === card.suit) {
                    const newKey = `${newRow},${newCol}`;
                    if (!visited.has(newKey)) {
                        group.push(...findConnectedGroup(newRow, newCol, visited));
                    }
                }
            }
        }
        
        return group;
    }

    function eliminateGroups() {
        const visited = new Set();
        const groupsToEliminate = [];
        let totalEliminated = 0;
        
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const key = `${r},${c}`;
                if (board[r][c] && !visited.has(key)) {
                    const group = findConnectedGroup(r, c, visited);
                    if (group.length >= 3) {
                        groupsToEliminate.push(group);
                        totalEliminated += group.length;
                    }
                }
            }
        }
        
        // Eliminar grupos y actualizar puntuación
        for (const group of groupsToEliminate) {
            for (const cell of group) {
                if (gameMode === 'espejo' && cell.card) {
                    discardPile.push(cell.card);
                }
                board[cell.row][cell.col] = null;
            }
            
            // Puntuación: 3 cartas = 3 puntos, 4 cartas = 6 puntos, 5 cartas = 10 puntos, etc.
            const groupScore = group.length * (group.length - 1) / 2 + group.length;
            score += groupScore;
            
            // Restaurar energía en modo espejo
            if (gameMode === 'espejo') {
                energy += group.length - 1; // 3 cartas = +2, 4 cartas = +3, etc.
            }
        }
        
        // Aplicar gravedad si hay eliminaciones
        if (totalEliminated > 0) {
            applyGravity();
            updateUI();
            
            // Verificar chain reactions
            setTimeout(() => {
                if (eliminateGroups()) {
                    renderBoard();
                }
            }, 300);
            
            return true;
        }
        
        return false;
    }

    function applyGravity() {
        for (let c = 0; c < COLS; c++) {
            // Recolectar cartas no nulas desde abajo hacia arriba
            const column = [];
            for (let r = ROWS - 1; r >= 0; r--) {
                if (board[r][c] !== null) {
                    column.push(board[r][c]);
                    board[r][c] = null;
                }
            }
            
            // Colocar cartas desde abajo
            for (let i = 0; i < column.length; i++) {
                board[ROWS - 1 - i][c] = column[i];
            }
        }
    }

    function updateUI() {
        scoreElement.textContent = score;
        energyElement.textContent = energy;
    }

    // Modo Constructor
    function initConstructor() {
        gameMode = 'constructor';
        clearBoard();
        score = 0;
        gameRunning = true;
        
        // UI
        gameBoard.classList.remove('espejo-mode');
        energyContainer.style.display = 'none';
        previewContainer.style.display = 'block';
        rotateButton.style.display = 'inline-block';
        refillButton.style.display = 'none';
        endButton.style.display = 'inline-block';
        
        // Generar piezas
        currentPiece = createPiece('trio');
        nextPiece = createPiece('quad');
        pieceRotation = 0;
        
        renderPiecePreview();
        renderBoard();
        updateUI();

        // Listeners para el preview flotante
        gameBoard.addEventListener('mousemove', handleBoardMouseMove);
        gameBoard.addEventListener('mouseleave', handleBoardMouseLeave);
        gameBoard.addEventListener('click', handleConstructorClick);
    }

    function renderPiecePreview() {
        if (!currentPiece) {
            previewContainer.style.display = 'none';
            return;
        }

        nextPiecePreview.innerHTML = '';
        const shape = currentPiece.shape;
        const cardWidth = 80;
        const cardHeight = 120;

        const pieceWidth = Math.max(...shape.map(row => row.length));
        const pieceHeight = shape.length;

        nextPiecePreview.style.gridTemplateColumns = `repeat(${pieceWidth}, ${cardWidth}px)`;
        nextPiecePreview.style.gridTemplateRows = `repeat(${pieceHeight}, ${cardHeight}px)`;

        // Crear un mapa de la pieza para facilitar la renderización
        const pieceMap = Array(pieceHeight).fill(0).map(() => Array(pieceWidth).fill(null));
        let cardIdx = 0;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                pieceMap[r][c] = currentPiece.cards[cardIdx++];
            }
        }

        for (let r = 0; r < pieceHeight; r++) {
            for (let c = 0; c < pieceWidth; c++) {
                const card = pieceMap[r][c];
                if (card) {
                    const img = document.createElement('img');
                    img.src = `images/${card.rank}${card.suit}.png`;
                    img.alt = `${card.rank} of ${card.suit}`;
                    img.style.width = `${cardWidth}px`;
                    img.style.height = `${cardHeight}px`;
                    img.style.objectFit = 'contain';
                    img.classList.add('card-image');
                    nextPiecePreview.appendChild(img);
                } else {
                    // Espacio vacío para piezas no rectangulares (aunque las actuales lo son)
                    const emptySlot = document.createElement('div');
                    nextPiecePreview.appendChild(emptySlot);
                }
            }
        }
    }

    function getGridCoordinates(e) {
        const firstSlot = gameBoard.querySelector('.card-slot');
        if (!firstSlot) return null;

        const firstSlotRect = firstSlot.getBoundingClientRect();
        const gridStartX = firstSlotRect.left;
        const gridStartY = firstSlotRect.top;

        // To get width + gap, we find the distance between two adjacent slots
        const secondSlot = gameBoard.querySelector('.card-slot:nth-child(2)');
        const slotWidthPlusGap = secondSlot ? secondSlot.getBoundingClientRect().left - gridStartX : firstSlotRect.width;

        // To get height + gap, we find the distance between a slot and the one below it
        const slotInNextRow = gameBoard.querySelector(`.card-slot:nth-child(${COLS + 1})`);
        const slotHeightPlusGap = slotInNextRow ? slotInNextRow.getBoundingClientRect().top - gridStartY : firstSlotRect.height;

        const x = e.clientX - gridStartX;
        const y = e.clientY - gridStartY;

        const col = Math.floor(x / slotWidthPlusGap);
        const row = Math.floor(y / slotHeightPlusGap);

        return { col, row, gridStartX, gridStartY, slotWidthPlusGap, slotHeightPlusGap };
    }

    function handleConstructorClick(e) {
        if (!gameRunning || !currentPiece || gameMode !== 'constructor') return;

        const coords = getGridCoordinates(e);
        if (!coords) return;

        const { row, col } = coords;

        if (canPlacePieceAt(row, col)) {
            placePiece(row, col);
        }
    }

    function placePiece(startRow, startCol) {
        const shape = currentPiece.shape;
        
        // Colocar la pieza
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                const cardIndex = shape[r][c];
                const card = currentPiece.cards[cardIndex];
                board[startRow + r][startCol + c] = card;
            }
        }
        
        // Avanzar a la siguiente pieza
        currentPiece = nextPiece;
        nextPiece = createPiece(Math.random() < 0.5 ? 'trio' : 'quad');
        pieceRotation = 0;
        
        renderPiecePreview();
        renderBoard();
        
        // Eliminar grupos
        setTimeout(() => {
            eliminateGroups();
            renderBoard();
            
            // Verificar game over
            if (!canPlaceAnyPiece()) {
                endGame();
            }
        }, 100);
    }

    function canPlaceAnyPiece() {
        if (!currentPiece) return false;
        
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (canPlacePieceAt(r, c)) {
                    return true;
                }
            }
        }
        return false;
    }

    function handleRotate() {
        if (currentPiece && gameRunning) {
            rotatePiece(currentPiece);
            renderPiecePreview();
            renderBoard();
        }
    }

    function handleBoardMouseMove(e) {
        if (!currentPiece || !gameRunning) return;

        const coords = getGridCoordinates(e);
        if (!coords) return;

        const { col, row, gridStartX, gridStartY, slotWidthPlusGap, slotHeightPlusGap } = coords;

        // Snap the preview to the calculated cell's top-left corner
        const snapX = gridStartX + col * slotWidthPlusGap;
        const snapY = gridStartY + row * slotHeightPlusGap;

        previewContainer.style.display = 'block';
        previewContainer.style.left = `${snapX}px`;
        previewContainer.style.top = `${snapY}px`;
    }

    function handleBoardMouseLeave() {
        if (!gameRunning) return;
        previewContainer.style.display = 'none';
    }

    // Modo Espejo
    function initEspejo() {
        gameMode = 'espejo';
        fillBoardForEspejo();
        score = 0;
        energy = 3;
        gameRunning = true;
        espejoHighlighted = [];
        espejoRefillsLeft = 2;
        discardPile = [];
        
        // UI
        gameBoard.classList.add('espejo-mode');
        energyContainer.style.display = 'block';
        previewContainer.style.display = 'none';
        rotateButton.style.display = 'none';
        refillButton.style.display = 'inline-block';
        refillButton.disabled = false;
        refillButton.textContent = `Rellenar (${espejoRefillsLeft})`;
        endButton.style.display = 'inline-block';
        
        updateUI();
        renderBoard();
    }

    function handleEspejoClick(row, col) {
        if (!gameRunning || energy <= 0) return;
        
        const card = board[row][col];
        if (!card) return;
        
        // Encontrar la posición espejo
        let mirrorCol;
        if (col < 4) {
            mirrorCol = col + 4;
        } else {
            mirrorCol = col - 4;
        }
        
        const mirrorCard = board[row][mirrorCol];
        if (!mirrorCard) return;
        
        // Realizar intercambio
        board[row][col] = mirrorCard;
        board[row][mirrorCol] = card;
        
        energy -= 1;
        
        renderBoard();
        updateUI();
        
        // Eliminar grupos
        setTimeout(() => {
            eliminateGroups();
            renderBoard();
            
            // Verificar game over
            if (energy <= 0) {
                endGame();
            }
        }, 100);
    }

    function handleRefill() {
        if (!gameRunning || gameMode !== 'espejo' || espejoRefillsLeft <= 0 || discardPile.length === 0) {
            return;
        }

        espejoRefillsLeft--;

        const emptySlots = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (!board[r][c]) {
                    emptySlots.push({ r, c });
                }
            }
        }

        const shuffledPile = shuffle(discardPile);
        let filledCount = 0;

        for (const slot of emptySlots) {
            if (shuffledPile.length === 0) break;

            const { r, c } = slot;
            let bestCard = null;
            let bestCardIndex = -1;

            // Find a card from the discard pile that doesn't create a group
            for (let i = 0; i < shuffledPile.length; i++) {
                const potentialCard = shuffledPile[i];
                const groupSize = getPotentialGroupSize(r, c, potentialCard.suit);
                if (groupSize < 3) {
                    bestCard = potentialCard;
                    bestCardIndex = i;
                    break;
                }
            }

            // If all cards create a group, just pick one (the last one)
            if (!bestCard) {
                bestCard = shuffledPile[shuffledPile.length - 1];
                bestCardIndex = shuffledPile.length - 1;
            }

            board[r][c] = bestCard;
            shuffledPile.splice(bestCardIndex, 1); // Remove card from pile
            filledCount++;
        }

        // Update the discard pile with the remaining unused cards
        discardPile = shuffledPile;

        // Update button state
        refillButton.textContent = `Rellenar (${espejoRefillsLeft})`;
        if (espejoRefillsLeft <= 0) {
            refillButton.disabled = true;
        }

        renderBoard();
        updateUI();
    }

    // Modo Cascada
    function initCascada() {
        gameMode = 'cascada';
        clearBoard();
        score = 0;
        gameRunning = true;
        fallingColumn = 4;
        cascadaDeck = shuffle(createDeck());
        
        // UI
        gameBoard.classList.remove('espejo-mode');
        energyContainer.style.display = 'none';
        previewContainer.style.display = 'none';
        rotateButton.style.display = 'none';
        refillButton.style.display = 'none';
        pauseButton.style.display = 'inline-block';
        endButton.style.display = 'inline-block';
        
        updateUI();
        renderBoard();
        
        // Iniciar caída de cartas
        startCascada();
    }

    function startCascada() {
        cascadaInterval = setInterval(() => {
            if (gameRunning && !gamePaused && cascadaDeck.length > 0) {
                dropNextCard();
            } else if (cascadaDeck.length === 0) {
                endGame();
            }
        }, 2500);
    }

    function dropNextCard() {
        if (cascadaDeck.length === 0) return;
        
        const card = cascadaDeck.shift();
        
        // Encontrar la posición más baja disponible en la columna
        let targetRow = -1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r][fallingColumn] === null) {
                targetRow = r;
                break;
            }
        }
        
        if (targetRow === -1) {
            // Columna llena, game over
            endGame();
            return;
        }
        
        // Colocar la carta
        board[targetRow][fallingColumn] = card;
        
        renderBoard();
        
        // Eliminar grupos
        setTimeout(() => {
            eliminateGroups();
            renderBoard();
        }, 100);
    }

    function handleCascadaKeyboard(event) {
        if (!gameRunning || gameMode !== 'cascada') return;
        
        if (event.key === 'ArrowLeft' && fallingColumn > 0) {
            fallingColumn--;
        } else if (event.key === 'ArrowRight' && fallingColumn < COLS - 1) {
            fallingColumn++;
        }
    }

    // Gestión del juego
    function endGame() {
        gameRunning = false;
        gamePaused = false;

        if (gameMode === 'espejo') {
            gameBoard.classList.remove('espejo-mode');
        }

        if (gameMode === 'constructor') {
            gameBoard.removeEventListener('mousemove', handleBoardMouseMove);
            gameBoard.removeEventListener('mouseleave', handleBoardMouseLeave);
            previewContainer.style.display = 'none';
        }
        
        if (cascadaInterval) {
            clearInterval(cascadaInterval);
            cascadaInterval = null;
        }
        
        // Ocultar controles específicos
        rotateButton.style.display = 'none';
        refillButton.style.display = 'none';
        pauseButton.style.display = 'none';
        endButton.style.display = 'none';
        
        // Mostrar modal de fin
        const modeTitles = {
            'constructor': 'Constructor',
            'espejo': 'Espejo',
            'cascada': 'Cascada'
        };
        endGameTitleElement.textContent = modeTitles[gameMode] || 'Juego Terminado';
        finalScoreElement.textContent = score;
        endGameModal.style.display = 'flex';
    }

    function togglePause() {
        if (gameMode === 'cascada' && gameRunning) {
            gamePaused = !gamePaused;
            pauseButton.textContent = gamePaused ? 'Reanudar' : 'Pausa';
        }
    }

    // Event Listeners
    titleConstructor.addEventListener('click', () => {
        welcomeModal.style.display = 'none';
        initConstructor();
    });

    titleEspejo.addEventListener('click', () => {
        welcomeModal.style.display = 'none';
        initEspejo();
    });

    titleCascada.addEventListener('click', () => {
        welcomeModal.style.display = 'none';
        initCascada();
    });

    playConstructorBtn.addEventListener('click', () => {
        endGameModal.style.display = 'none';
        initConstructor();
    });

    playEspejoBtn.addEventListener('click', () => {
        endGameModal.style.display = 'none';
        initEspejo();
    });

    playCascadaBtn.addEventListener('click', () => {
        endGameModal.style.display = 'none';
        initCascada();
    });

    rotateButton.addEventListener('click', handleRotate);
    refillButton.addEventListener('click', handleRefill);
    pauseButton.addEventListener('click', togglePause);
    endButton.addEventListener('click', endGame);

    // Keyboard listeners
    document.addEventListener('keydown', handleCascadaKeyboard);

    // Inicialización
    updateUI();
});