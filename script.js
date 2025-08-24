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
    const pauseButton = document.getElementById('pause-button');
    const endButton = document.getElementById('end-button');
    const welcomeModal = document.getElementById('welcome-modal');
    const endGameModal = document.getElementById('end-game-modal');
    const finalScoreElement = document.getElementById('final-score');
    
    // Botones de modo
    const startConstructorBtn = document.getElementById('start-constructor');
    const startEspejoBtn = document.getElementById('start-espejo');
    const startCascadaBtn = document.getElementById('start-cascada');
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
                if (gameMode === 'constructor' && canPlacePieceAt(r, c)) {
                    slot.classList.add('preview');
                }
                
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
                if (gameMode === 'constructor') {
                    slot.addEventListener('click', () => handleConstructorClick(r, c));
                } else if (gameMode === 'espejo') {
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
        energyContainer.style.display = 'none';
        previewContainer.style.display = 'block';
        rotateButton.style.display = 'inline-block';
        endButton.style.display = 'inline-block';
        
        // Generar piezas
        currentPiece = createPiece('trio');
        nextPiece = createPiece('quad');
        pieceRotation = 0;
        
        renderPiecePreview();
        renderBoard();
        updateUI();
    }

    function renderPiecePreview() {
        if (!nextPiece) return;
        
        nextPiecePreview.innerHTML = '';
        const shape = nextPiece.shape;
        
        nextPiecePreview.style.gridTemplateColumns = `repeat(${Math.max(...shape.map(row => row.length))}, 30px)`;
        nextPiecePreview.style.gridTemplateRows = `repeat(${shape.length}, 42px)`;
        
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                const cardIndex = shape[r][c];
                const card = nextPiece.cards[cardIndex];
                
                const img = document.createElement('img');
                img.src = `images/${card.rank}${card.suit}.png`;
                img.alt = `${card.rank} of ${card.suit}`;
                img.style.width = '30px';
                img.style.height = '42px';
                img.style.objectFit = 'contain';
                
                nextPiecePreview.appendChild(img);
            }
        }
    }

    function handleConstructorClick(row, col) {
        if (!gameRunning || !currentPiece) return;
        
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
            renderBoard();
        }
    }

    // Modo Espejo
    function initEspejo() {
        gameMode = 'espejo';
        fillBoardRandom();
        score = 0;
        energy = 3;
        gameRunning = true;
        espejoHighlighted = [];
        
        // UI
        energyContainer.style.display = 'block';
        previewContainer.style.display = 'none';
        rotateButton.style.display = 'none';
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

    // Modo Cascada
    function initCascada() {
        gameMode = 'cascada';
        clearBoard();
        score = 0;
        gameRunning = true;
        fallingColumn = 4;
        cascadaDeck = shuffle(createDeck());
        
        // UI
        energyContainer.style.display = 'none';
        previewContainer.style.display = 'none';
        rotateButton.style.display = 'none';
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
        
        if (cascadaInterval) {
            clearInterval(cascadaInterval);
            cascadaInterval = null;
        }
        
        // Ocultar controles específicos
        rotateButton.style.display = 'none';
        pauseButton.style.display = 'none';
        endButton.style.display = 'none';
        
        // Mostrar modal de fin
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
    startConstructorBtn.addEventListener('click', () => {
        welcomeModal.style.display = 'none';
        initConstructor();
    });

    startEspejoBtn.addEventListener('click', () => {
        welcomeModal.style.display = 'none';
        initEspejo();
    });

    startCascadaBtn.addEventListener('click', () => {
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
    pauseButton.addEventListener('click', togglePause);
    endButton.addEventListener('click', endGame);

    // Keyboard listeners
    document.addEventListener('keydown', handleCascadaKeyboard);

    // Inicialización
    updateUI();
});