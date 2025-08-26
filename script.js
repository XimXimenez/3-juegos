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

    // Elementos del Leaderboard
    const highscoreForm = document.getElementById('highscore-form');
    const playerNameInput = document.getElementById('player-name');
    const saveScoreButton = document.getElementById('save-score-button');
    const viewLeaderboardButton = document.getElementById('view-leaderboard-button');
    const leaderboardModal = document.getElementById('leaderboard-modal');
    const leaderboardConstructorList = document.getElementById('leaderboard-constructor');
    const leaderboardEspejoList = document.getElementById('leaderboard-espejo');
    const leaderboardCascadaList = document.getElementById('leaderboard-cascada');
    const closeLeaderboardButton = document.getElementById('close-leaderboard-button');
    
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
    let fallingCard = null; // This will hold the card data for the falling/preview card
    let fallingColumn = 4;
    let cascadaDeck = [];
    let cascadaTimeoutId = null;
    let fallingCardContainer = null; // The DOM element for the preview/falling card

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
                    slot.classList.add('shadow-highlight');
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
                    slot.addEventListener('mouseover', () => handleEspejoMouseOver(r, c));
                    slot.addEventListener('mouseout', () => handleEspejoMouseOut());
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

                // Condición de match según el modo de juego
                const isMatch = gameMode === 'cascada'
                    ? neighborCard && neighborCard.rank === card.rank
                    : neighborCard && neighborCard.suit === card.suit;

                if (isMatch) {
                    const newKey = `${newRow},${newCol}`;
                    if (!visited.has(newKey)) {
                        group.push(...findConnectedGroup(newRow, newCol, visited));
                    }
                }
            }
        }
        
        return group;
    }

    function eliminateGroups(onCompleteCallback) {
        const visited = new Set();
        const groupsToEliminate = [];
        let totalEliminated = 0;

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const key = `${r},${c}`;
                if (board[r][c] && !visited.has(key)) {
                    const group = findConnectedGroup(r, c, visited);
                    const minGroupSize = gameMode === 'cascada' ? 2 : 3;
                    if (group.length >= minGroupSize) {
                        groupsToEliminate.push(group);
                        totalEliminated += group.length;
                    }
                }
            }
        }

        if (totalEliminated === 0) {
            if (onCompleteCallback) onCompleteCallback();
            return false;
        }

        for (const group of groupsToEliminate) {
            for (const cell of group) {
                if (gameMode === 'espejo' && cell.card) {
                    discardPile.push(cell.card);
                }
                board[cell.row][cell.col] = null;
            }

            const groupScore = group.length * (group.length - 1) / 2 + group.length;
            score += groupScore;

            if (gameMode === 'espejo') {
                energy += group.length - 1;
            }
        }

        applyGravity();
        updateUI();
        renderBoard(); // Render after gravity

        setTimeout(() => {
            // Pass the callback to the recursive call to handle chain reactions
            eliminateGroups(onCompleteCallback);
        }, 300);

        return true;
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
        
        // Aplicar gravedad para que la pieza caiga
        applyGravity();

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

    function handleEspejoMouseOver(row, col) {
        if (!gameRunning || gameMode !== 'espejo') return;

        espejoHighlighted = [];
        const card = board[row][col];

        if (card) {
            // Destacar la carta sobre la que se pasa el cursor
            espejoHighlighted.push({ row, col });

            // Destacar la posición espejo, esté vacía o no
            let mirrorCol;
            if (col < 4) {
                mirrorCol = col + 4;
            } else {
                mirrorCol = col - 4;
            }
            espejoHighlighted.push({ row, col: mirrorCol });
        }

        renderBoard();
    }

    function handleEspejoMouseOut() {
        if (!gameRunning || gameMode !== 'espejo') return;

        espejoHighlighted = [];
        renderBoard();
    }

    function handleEspejoClick(row, col) {
        if (!gameRunning || energy <= 0) return;

        const card = board[row][col];
        if (!card) return; // Solo se puede iniciar desde una carta

        // Encontrar la posición espejo
        let mirrorCol;
        if (col < 4) {
            mirrorCol = col + 4;
        } else {
            mirrorCol = col - 4;
        }

        const mirrorCard = board[row][mirrorCol];

        // Realizar intercambio (funciona incluso si mirrorCard es null)
        board[row][col] = mirrorCard;
        board[row][mirrorCol] = card;

        energy -= 1;

        // Aplicar gravedad para que la carta "caiga" si es necesario
        applyGravity();

        renderBoard();
        updateUI();

        // Eliminar grupos después de la caída
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

    function handleCardLanding() {
        // The transitionend event can fire for multiple properties.
        // We only want to run this logic once per drop.
        if (!fallingCard || !gameRunning) return;

        let targetRow = -1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r][fallingColumn] === null) {
                targetRow = r;
                break;
            }
        }

        if (targetRow === -1) {
            endGame();
            return;
        }

        board[targetRow][fallingColumn] = fallingCard;
        fallingCardContainer.style.display = 'none';
        fallingCard = null; // Important: signal that the card has landed.

        renderBoard();

        eliminateGroups(() => {
            if (gameRunning) {
                cascadaGameStep();
            }
        });
    }

    function spawnNewCard() {
        if (cascadaDeck.length === 0) {
            if (!fallingCard) endGame();
            return false;
        }

        fallingCard = cascadaDeck.shift();

        fallingCardContainer.innerHTML = '';
        const img = document.createElement('img');
        img.src = `images/${fallingCard.rank}${fallingCard.suit}.png`;
        img.alt = `${fallingCard.rank} of ${fallingCard.suit}`;
        img.classList.add('card-image');
        fallingCardContainer.appendChild(img);

        fallingCardContainer.style.transition = 'none';
        fallingCardContainer.style.display = 'block';
        updateFallingCardPreviewPosition();
        return true;
    }

    function dropNextCard() {
        if (!fallingCard || !gameRunning) return;

        let targetRow = -1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r][fallingColumn] === null) {
                targetRow = r;
                break;
            }
        }

        if (targetRow === -1) {
            endGame();
            return;
        }

        const firstSlotRect = gameBoard.querySelector('.card-slot').getBoundingClientRect();
        const gameBoardRect = gameBoard.getBoundingClientRect();
        const cardHeight = firstSlotRect.height;
        const gapY = (gameBoardRect.height - (ROWS * cardHeight)) / (ROWS - 1);
        const top = gameBoard.offsetTop + targetRow * (cardHeight + gapY);

        // A short delay ensures the 'left' position is set before the transition starts
        setTimeout(() => {
            fallingCardContainer.style.transition = 'top 2.0s ease-in, left 0.2s ease-out';
            fallingCardContainer.style.top = `${top}px`;
        }, 50);
    }

    function cascadaGameStep() {
        if (!gameRunning || gamePaused) return;
        if (spawnNewCard()) {
            cascadaTimeoutId = setTimeout(dropNextCard, 2500);
        }
    }

    function initCascada() {
        gameMode = 'cascada';
        clearBoard();
        score = 0;
        gameRunning = true;
        fallingColumn = 4;
        cascadaDeck = shuffle(createDeck());
        
        if (!fallingCardContainer) {
            fallingCardContainer = document.createElement('div');
            fallingCardContainer.className = 'cascada-falling-card';
            document.getElementById('game-container').appendChild(fallingCardContainer);
            fallingCardContainer.addEventListener('transitionend', handleCardLanding);
        }

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
        
        gameBoard.addEventListener('click', handleCascadaClick);

        // Iniciar caída de cartas
        startCascada();
    }

    function updateFallingCardPreviewPosition() {
        if (!fallingCardContainer || !gameBoard.querySelector('.card-slot')) return;

        const firstSlotRect = gameBoard.querySelector('.card-slot').getBoundingClientRect();
        const gameBoardRect = gameBoard.getBoundingClientRect();
        
        const cardWidth = firstSlotRect.width;
        const gap = (gameBoardRect.width - (COLS * cardWidth)) / (COLS - 1);

        const gameContainerRect = document.getElementById('game-container').getBoundingClientRect();
        const gameBoardOffsetLeft = gameBoardRect.left - gameContainerRect.left;
        
        const left = gameBoardOffsetLeft + fallingColumn * (cardWidth + gap);
        const top = gameBoard.offsetTop - firstSlotRect.height - 5;

        fallingCardContainer.style.left = `${left}px`;
        fallingCardContainer.style.top = `${top}px`;
    }

    function handleCascadaClick(event) {
        if (!gameRunning || gameMode !== 'cascada' || gamePaused || !fallingCard) return;

        const coords = getGridCoordinates(event);
        if (!coords) return;

        const { col } = coords;
        fallingColumn = col;
        
        updateFallingCardPreviewPosition();
    }

    function startCascada() {
        cascadaGameStep();
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

        if (gameMode === 'cascada') {
            gameBoard.removeEventListener('click', handleCascadaClick);
            if (fallingCardContainer) {
                fallingCardContainer.style.display = 'none';
            }
            fallingCard = null;
        }
        
        if (cascadaInterval) { // Keep this for safety, though it should be unused
            clearInterval(cascadaInterval);
            cascadaInterval = null;
        }
        if (cascadaTimeoutId) {
            clearTimeout(cascadaTimeoutId);
            cascadaTimeoutId = null;
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

    // --- Lógica del Leaderboard ---

    function getLeaderboard() {
        const leaderboardJSON = localStorage.getItem('leaderboard');
        if (leaderboardJSON) {
            return JSON.parse(leaderboardJSON);
        }
        return { constructor: [], espejo: [], cascada: [] };
    }

    function saveLeaderboard(leaderboard) {
        localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
    }

    function isHighScore(score, mode) {
        if (!mode) return false;
        const leaderboard = getLeaderboard();
        const modeScores = leaderboard[mode] || [];

        if (modeScores.length < 10) {
            return true;
        }

        // Comprobar si el puntaje es mayor que el más bajo en el top 10
        return score > modeScores[modeScores.length - 1].score;
    }

    function addScore(name, score, mode) {
        const leaderboard = getLeaderboard();
        const modeScores = leaderboard[mode] || [];

        modeScores.push({ name, score });
        modeScores.sort((a, b) => b.score - a.score); // Ordenar de mayor a menor

        leaderboard[mode] = modeScores.slice(0, 10); // Mantener solo el top 10

        saveLeaderboard(leaderboard);
    }

    function renderLeaderboard() {
        const leaderboard = getLeaderboard();
        const lists = {
            constructor: leaderboardConstructorList,
            espejo: leaderboardEspejoList,
            cascada: leaderboardCascadaList
        };

        for (const mode in lists) {
            const listElement = lists[mode];
            listElement.innerHTML = '';
            const scores = leaderboard[mode] || [];

            if (scores.length === 0) {
                listElement.innerHTML = '<li>Aún no hay puntajes.</li>';
            } else {
                scores.forEach(entry => {
                    const li = document.createElement('li');
                    const nameSpan = document.createElement('span');
                    const scoreSpan = document.createElement('span');

                    nameSpan.textContent = entry.name;
                    scoreSpan.textContent = entry.score;

                    li.appendChild(nameSpan);
                    li.appendChild(scoreSpan);
                    listElement.appendChild(li);
                });
            }
        }
    }

    function showLeaderboard() {
        renderLeaderboard();
        leaderboardModal.style.display = 'flex';
    }

    function hideLeaderboard() {
        leaderboardModal.style.display = 'none';
    }

    // Modificar endGame para incluir la lógica de leaderboard
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

        rotateButton.style.display = 'none';
        refillButton.style.display = 'none';
        pauseButton.style.display = 'none';
        endButton.style.display = 'none';

        const modeTitles = {
            'constructor': 'Constructor',
            'espejo': 'Espejo',
            'cascada': 'Cascada'
        };
        endGameTitleElement.textContent = modeTitles[gameMode] || 'Juego Terminado';
        finalScoreElement.textContent = score;

        // Resetear y ocultar el formulario de récord
        highscoreForm.style.display = 'none';
        viewLeaderboardButton.style.display = 'none';
        playerNameInput.value = '';
        saveScoreButton.disabled = false;

        if (isHighScore(score, gameMode)) {
            highscoreForm.style.display = 'block';
        }

        endGameModal.style.display = 'flex';
    }

    saveScoreButton.addEventListener('click', () => {
        const name = playerNameInput.value.trim();
        if (name) {
            addScore(name, score, gameMode);
            highscoreForm.style.display = 'none';
            viewLeaderboardButton.style.display = 'inline-block';
            saveScoreButton.disabled = true;
        }
    });

    viewLeaderboardButton.addEventListener('click', () => {
        endGameModal.style.display = 'none';
        showLeaderboard();
    });

    closeLeaderboardButton.addEventListener('click', hideLeaderboard);

    // Botones para jugar de nuevo desde el leaderboard
    document.getElementById('play-constructor-from-leaderboard').addEventListener('click', () => {
        hideLeaderboard();
        initConstructor();
    });
    document.getElementById('play-espejo-from-leaderboard').addEventListener('click', () => {
        hideLeaderboard();
        initEspejo();
    });
    document.getElementById('play-cascada-from-leaderboard').addEventListener('click', () => {
        hideLeaderboard();
        initCascada();
    });


    // Inicialización
    updateUI();
});