// script.js

const WORD_LIST_FILENAME = "sozluk.txt";
let currentWordLength = 5;
const MAX_TRIES = 6;
const VALID_GAME_LENGTHS = [4, 5, 6, 7, 8, 9];

let dictionary = [];
let validWordsOfLength = [];
let targetWord = "";
let currentRow = 0;
let currentCol = 0;
let gameOver = false;
let gameWon = false;
let isProcessing = false;
let selectedGameLength = 0;

// DOM Elementleri
let initialSetupScreen, lengthOptionsContainer, startSelectedLengthGameBtn, gameArea,
    gridContainer, keyboardContainer, messagePopup, endGameModal, modalTitle,
    modalMessage, modalCorrectWord, modalNewGameBtn, modalCloseBtn,
    wordLengthDisplay, totalWordsDisplay;

const keyboardLayout = [
    "ERTYUIOPĞÜ",
    "ASDFGHJKLŞİ",
    ["ENTER", "ZCVBNMÖÇ", "BACKSPACE"]
];

function turkishLower(s) { if (!s) return ""; return s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase(); }
function turkishUpper(s) { if (!s) return ""; return s.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase(); }
function getTodayDateString() { const today = new Date(); return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`; }

function saveGameState(gameState) {
    try {
        const key = `wordleGameState_${getTodayDateString()}_len${currentWordLength}`;
        localStorage.setItem(key, JSON.stringify(gameState));
        console.log("Oyun durumu kaydedildi:", key, gameState);
    } catch (e) { console.error("localStorage'a kaydetme hatası:", e); if (messagePopup) showMessage("Oyun durumu kaydedilemedi.", 3000, true); }
}
function loadGameState() {
    try {
        if (!selectedGameLength) return null;
        const key = `wordleGameState_${getTodayDateString()}_len${selectedGameLength}`;
        const savedStateString = localStorage.getItem(key);
        return savedStateString ? JSON.parse(savedStateString) : null;
    } catch (e) { console.error("localStorage'dan okuma/parse etme hatası:", e); return null; }
}
function clearOldGameStates() {
    const todayStr = getTodayDateString();
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("wordleGameState_") && !key.startsWith(`wordleGameState_${todayStr}`)) {
            localStorage.removeItem(key);
            console.log("Eski oyun durumu silindi:", key);
        }
    }
}

async function loadDictionary() {
    console.log("loadDictionary çağrıldı.");
    if (totalWordsDisplay) totalWordsDisplay.textContent = `Sözlük (${WORD_LIST_FILENAME}) yükleniyor...`;
    if (startSelectedLengthGameBtn) startSelectedLengthGameBtn.disabled = true;

    try {
        const response = await fetch(WORD_LIST_FILENAME);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} - Dosya: ${WORD_LIST_FILENAME}`);
        const text = await response.text();
        dictionary = text.split(/\r?\n/)
                         .map(word => turkishLower(word.trim()))
                         .filter(word => {
                             const len = word.length;
                             const isValidChar = /^[a-zçğıöşü]+$/i.test(word.replace(/[İI]/gi, 'i'));
                             return isValidChar && VALID_GAME_LENGTHS.includes(len);
                         });
        if (dictionary.length > 0) {
            console.log("Sözlük yüklendi:", dictionary.length, "kelime.");
            if (totalWordsDisplay) totalWordsDisplay.textContent = `Sözlükte ${dictionary.length} kelime var. Uzunluk seçin.`;
            populateLengthOptions();
        } else {
            throw new Error("Sözlük boş veya geçerli kelime bulunamadı.");
        }
    } catch (error) {
        console.error("Sözlük yüklenirken KAPSAMLI HATA:", error);
        if (totalWordsDisplay) totalWordsDisplay.textContent = `Hata: ${WORD_LIST_FILENAME} yüklenemedi.`;
        if (startSelectedLengthGameBtn) startSelectedLengthGameBtn.disabled = true;
    }
}

function populateLengthOptions() {
    if (!lengthOptionsContainer) return;
    lengthOptionsContainer.innerHTML = '';
    VALID_GAME_LENGTHS.forEach(len => {
        if (dictionary.some(word => word.length === len)) {
            const btn = document.createElement('button');
            btn.textContent = `${len} Harf`;
            btn.dataset.length = len;
            btn.addEventListener('click', () => selectGameLength(len));
            lengthOptionsContainer.appendChild(btn);
        }
    });
}

function selectGameLength(length) {
    selectedGameLength = length;
    document.querySelectorAll('.length-options button').forEach(btn => {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.length) === length) {
            btn.classList.add('selected');
        }
    });
    console.log("Seçilen kelime uzunluğu:", selectedGameLength);
    if (startSelectedLengthGameBtn) {
        startSelectedLengthGameBtn.disabled = !(dictionary.length > 0 && selectedGameLength > 0);
    }
}

function selectWordOfTheDay(previousTargetWord = null) {
    if (!currentWordLength) {
        console.error("selectWordOfTheDay: Kelime uzunluğu ayarlanmamış!");
        return "";
    }
    validWordsOfLength = dictionary.filter(word => word.length === currentWordLength);

    if (validWordsOfLength.length === 0) {
        if (messagePopup) showMessage(`Bu uzunlukta (${currentWordLength}) kelime bulunamadı!`, 5000, true);
        if (wordLengthDisplay) wordLengthDisplay.textContent = `${currentWordLength} Harfli Kelime (HATA!)`;
        if (totalWordsDisplay) totalWordsDisplay.textContent = `Sözlük: ${dictionary.length} | Bu Uzunlukta: 0`;
        gameOver = true;
        return "";
    }

    if (wordLengthDisplay) wordLengthDisplay.textContent = `${currentWordLength} Harfli Kelime`;
    if (totalWordsDisplay) totalWordsDisplay.textContent = `Sözlük: ${dictionary.length} | Bu Uzunlukta: ${validWordsOfLength.length}`;

    const now = new Date();
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    let newTargetWord;
    let attempts = 0;
    do {
        const index = (dayOfYear + now.getFullYear() + attempts + currentWordLength) % validWordsOfLength.length;
        newTargetWord = validWordsOfLength[index];
        attempts++;
    } while (newTargetWord === previousTargetWord && validWordsOfLength.length > 1 && attempts < validWordsOfLength.length * 2);
    return newTargetWord;
}

function createGrid() {
    if (!gridContainer) { console.error("createGrid: gridContainer bulunamadı!"); return; }
    gridContainer.innerHTML = "";
    gridContainer.style.gridTemplateRows = `repeat(${MAX_TRIES}, auto)`;
    for (let r = 0; r < MAX_TRIES; r++) {
        const rowDiv = document.createElement("div");
        rowDiv.classList.add("grid-row");
        rowDiv.style.gridTemplateColumns = `repeat(${currentWordLength}, 1fr)`;
        for (let c = 0; c < currentWordLength; c++) {
            const tile = document.createElement("div");
            tile.classList.add("tile");
            tile.id = `tile-${r}-${c}`;
            rowDiv.appendChild(tile);
        }
        gridContainer.appendChild(rowDiv);
    }
    console.log("Grid oluşturuldu. Uzunluk:", currentWordLength);
}

function createKeyboard() {
    if (!keyboardContainer) { console.error("createKeyboard: keyboardContainer bulunamadı!"); return; }
    keyboardContainer.innerHTML = "";
    keyboardLayout.forEach(rowCharsOrArray => {
        const rowDiv = document.createElement("div");
        rowDiv.classList.add("keyboard-row");
        let charsToProcess = [];
        if (typeof rowCharsOrArray === 'string') {
            charsToProcess = rowCharsOrArray.split('');
        } else if (Array.isArray(rowCharsOrArray)) {
            rowCharsOrArray.forEach(keyOrString => {
                if (keyOrString.length > 1 && keyOrString !== "ENTER" && keyOrString !== "BACKSPACE") {
                    charsToProcess.push(...keyOrString.split(''));
                } else {
                    charsToProcess.push(keyOrString);
                }
            });
        }
        charsToProcess.forEach(key => {
            const keyButton = document.createElement("button");
            keyButton.classList.add("key");
            const keyText = (key === "BACKSPACE") ? '⌫' : key;
            keyButton.textContent = turkishUpper(keyText);
            keyButton.dataset.key = turkishUpper(key);
            if (key === "ENTER" || key === "BACKSPACE") { keyButton.classList.add("large"); }
            keyButton.addEventListener("click", () => handleKeyPress(turkishUpper(key)));
            rowDiv.appendChild(keyButton);
        });
        keyboardContainer.appendChild(rowDiv);
    });
    console.log("Klavye oluşturuldu.");
}

function handleKeyPress(key) {
    if (gameOver || isProcessing) return;
    const pressedKey = turkishUpper(key);

    if (pressedKey === "ENTER") {
        submitGuess();
    } else if (pressedKey === "BACKSPACE" || pressedKey === '⌫') {
        deleteLetter();
    } else if (pressedKey.length === 1 && /^[A-ZÇĞİÖŞÜ]$/.test(pressedKey)) {
        addLetterToGrid(pressedKey);
    }
}

function addLetterToGrid(letter) {
    if (currentCol < currentWordLength) {
        const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
        if (tile) {
            tile.textContent = letter;
            tile.classList.add("filled", "pop");
            tile.addEventListener('animationend', () => tile.classList.remove('pop'), { once: true });
            currentCol++;
        }
    }
}

function deleteLetter() {
    if (currentCol > 0) {
        currentCol--;
        const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
        if (tile) {
            tile.textContent = "";
            tile.classList.remove("filled");
        }
    }
}

async function submitGuess() {
    if (currentCol !== currentWordLength) {
        showMessage("Kelime yeterince uzun değil!", 2000, true);
        shakeCurrentRow();
        return;
    }

    isProcessing = true;
    let currentGuess = "";
    for (let i = 0; i < currentWordLength; i++) {
        const tile = document.getElementById(`tile-${currentRow}-${i}`);
        currentGuess += turkishLower(tile.textContent);
    }

    if (!validWordsOfLength.includes(currentGuess) && !dictionary.includes(currentGuess)) {
        showMessage("Kelime sözlükte yok!", 2000, true);
        shakeCurrentRow();
        isProcessing = false;
        return;
    }

    const feedback = evaluateGuess(currentGuess, targetWord);
    await applyFeedbackToGrid(currentRow, feedback, currentGuess);
    updateKeyboardColors(currentGuess, feedback);

    const guessesForSave = getGuessesWithFeedback();

    if (currentGuess === targetWord) {
        gameWon = true;
        gameOver = true;
        setTimeout(() => showEndGameModal(true, guessesForSave), 50);
    } else if (currentRow === MAX_TRIES - 1) {
        gameOver = true;
        setTimeout(() => showEndGameModal(false, guessesForSave), 50);
    } else {
        currentRow++;
        currentCol = 0;
    }

    saveGameState({
        targetWord: targetWord,
        guesses: guessesForSave,
        currentRow: gameOver ? currentRow : currentRow,
        won: gameWon,
        lost: gameOver && !gameWon,
        date: getTodayDateString(),
        length: currentWordLength
    });
    isProcessing = false;
}

function shakeCurrentRow() {
    if (!gridContainer || !gridContainer.children[currentRow]) return;
    const rowDiv = gridContainer.children[currentRow];
    rowDiv.classList.add('shake');
    rowDiv.addEventListener('animationend', () => {
        rowDiv.classList.remove('shake');
    }, { once: true });
}

function evaluateGuess(guess, target) {
    const feedback = Array(target.length).fill(null);
    const targetChars = target.split('');
    const guessChars = guess.split('');
    const targetCharCounts = {};

    for (const char of targetChars) {
        targetCharCounts[char] = (targetCharCounts[char] || 0) + 1;
    }

    for (let i = 0; i < guessChars.length; i++) {
        if (guessChars[i] === targetChars[i]) {
            feedback[i] = 'correct';
            targetCharCounts[guessChars[i]]--;
        }
    }

    for (let i = 0; i < guessChars.length; i++) {
        if (feedback[i] === null) {
            if (targetChars.includes(guessChars[i]) && targetCharCounts[guessChars[i]] > 0) {
                feedback[i] = 'present';
                targetCharCounts[guessChars[i]]--;
            } else {
                feedback[i] = 'absent';
            }
        }
    }
    return feedback;
}

async function applyFeedbackToGrid(rowIdx, feedback, guessWord) {
    if (!gridContainer || !gridContainer.children[rowIdx]) return;
    const rowTiles = gridContainer.children[rowIdx].children;

    const baseFlipDuration = 500; // CSS'deki animation-duration (ms)
    let delayBetweenTiles = 100;

    if (currentWordLength >= 7) delayBetweenTiles = 75;
    if (currentWordLength >= 9) delayBetweenTiles = 50;

    const animationPromises = [];

    for (let i = 0; i < feedback.length; i++) {
        const tile = rowTiles[i];
        if (!tile) continue;

        const promise = new Promise(resolve => {
            setTimeout(() => {
                tile.classList.add('flip-reveal');
                tile.textContent = turkishUpper(guessWord[i]);

                setTimeout(() => {
                    tile.classList.remove('filled');
                    tile.classList.add(feedback[i]);
                }, baseFlipDuration / 2);

                setTimeout(() => {
                    resolve();
                }, baseFlipDuration);

            }, delayBetweenTiles * i);
        });
        animationPromises.push(promise);
    }
    await Promise.all(animationPromises);
}

function updateKeyboardColors(guess, feedback) {
    for (let i = 0; i < guess.length; i++) {
        const char = turkishUpper(guess[i]);
        const status = feedback[i];
        const keyButton = keyboardContainer.querySelector(`.key[data-key="${char}"]`);

        if (keyButton) {
            const currentStatus = keyButton.dataset.status;
            if (status === 'correct') {
                keyButton.classList.remove('present', 'absent');
                keyButton.classList.add('correct');
                keyButton.dataset.status = 'correct';
            } else if (status === 'present' && currentStatus !== 'correct') {
                keyButton.classList.remove('absent');
                keyButton.classList.add('present');
                keyButton.dataset.status = 'present';
            } else if (status === 'absent' && !currentStatus) {
                keyButton.classList.add('absent');
                keyButton.dataset.status = 'absent';
            }
        }
    }
}

function getGuessesWithFeedback() {
    const guesses = [];
    if (!gridContainer) return guesses;
    for (let r = 0; r < (gameOver ? currentRow + 1 : currentRow) ; r++) {
        if (!gridContainer.children[r]) continue;
        const rowTiles = gridContainer.children[r].children;
        let word = "";
        const feedback = [];
        let rowCompleteAndEvaluated = true;
        for (let c = 0; c < currentWordLength; c++) {
            const tile = rowTiles[c];
            if (tile && tile.textContent) {
                word += turkishLower(tile.textContent);
                if (tile.classList.contains('correct')) feedback.push('correct');
                else if (tile.classList.contains('present')) feedback.push('present');
                else if (tile.classList.contains('absent')) feedback.push('absent');
                else { rowCompleteAndEvaluated = false; break; }
            } else { rowCompleteAndEvaluated = false; break; }
        }
        if (rowCompleteAndEvaluated && word.length === currentWordLength) {
            guesses.push({ word, feedback });
        }
    }
    return guesses;
}

function showMessage(message, duration = 2000, isError = false) {
    if (!messagePopup) { console.warn("showMessage: messagePopup DOM element not found."); return; }
    messagePopup.textContent = message;
    messagePopup.classList.add("show");
    setTimeout(() => {
        if (messagePopup) messagePopup.classList.remove("show");
    }, duration);
}

function showEndGameModal(won, guessesData) {
    if (!endGameModal || !modalTitle || !modalMessage || !modalCorrectWord) return;
    if (won) {
        modalTitle.textContent = "Tebrikler!";
        modalMessage.textContent = `Kelimeyi ${guessesData.length} denemede buldunuz.`;
    } else {
        modalTitle.textContent = "Oyun Bitti!";
        modalMessage.textContent = "Bu sefer olmadı. Denemeye devam!";
    }
    modalCorrectWord.textContent = turkishUpper(targetWord);
    endGameModal.style.display = "flex";
}

async function initializeGame() {
    console.log("initializeGame çağrıldı. Seçilen Uzunluk:", selectedGameLength);
    if (!selectedGameLength || !VALID_GAME_LENGTHS.includes(selectedGameLength)) {
        console.error("initializeGame: Geçerli bir kelime uzunluğu seçilmedi.");
        if (messagePopup) showMessage("Lütfen geçerli bir kelime uzunluğu seçin.", 3000, true);
        if (initialSetupScreen) initialSetupScreen.style.display = 'flex';
        if (gameArea) gameArea.style.display = 'none';
        return;
    }
    currentWordLength = selectedGameLength;

    gameOver = false; gameWon = false;
    currentRow = 0; currentCol = 0;
    isProcessing = false;
    clearOldGameStates();

    if (dictionary.length === 0) {
        console.error("initializeGame: Sözlük yüklenemedi veya boş.");
        showMessage("Oyun başlatılamadı: Sözlük hatası.", 3000, true);
        if (initialSetupScreen) initialSetupScreen.style.display = 'flex';
        if (gameArea) gameArea.style.display = 'none';
        if (startSelectedLengthGameBtn) startSelectedLengthGameBtn.disabled = true;
        return;
    }

    validWordsOfLength = dictionary.filter(word => word.length === currentWordLength);
    if (validWordsOfLength.length === 0 && currentWordLength > 0) {
        console.error(`initializeGame: Seçilen uzunlukta (${currentWordLength}) kelime bulunamadı.`);
        showMessage(`Seçilen uzunlukta (${currentWordLength}) kelime bulunamadı. Farklı bir uzunluk deneyin.`, 4000, true);
        if (initialSetupScreen) initialSetupScreen.style.display = 'flex';
        if (gameArea) gameArea.style.display = 'none';
        return;
    }

    const savedGameState = loadGameState();
    let restoreSuccess = false;

    if (savedGameState && savedGameState.targetWord && savedGameState.guesses &&
        savedGameState.date === getTodayDateString() && savedGameState.length === currentWordLength) {
        console.log(`Bugüne ait ${currentWordLength} harfli kaydedilmiş oyun durumu yükleniyor:`, savedGameState);
        targetWord = turkishLower(savedGameState.targetWord);

        if (wordLengthDisplay) wordLengthDisplay.textContent = `${currentWordLength} Harfli Kelime`;
        if (totalWordsDisplay) totalWordsDisplay.textContent = `Sözlük: ${dictionary.length} | Bu Uzunlukta: ${validWordsOfLength.length}`;

        createGrid(); createKeyboard();

        savedGameState.guesses.forEach((guessData, r) => {
            if (gridContainer && gridContainer.children[r]) {
                const rowTiles = gridContainer.children[r].children;
                for (let c = 0; c < currentWordLength; c++) {
                    if (rowTiles[c] && guessData.word[c]) {
                        rowTiles[c].textContent = turkishUpper(guessData.word[c]);
                        rowTiles[c].classList.remove('filled');
                        rowTiles[c].classList.add(guessData.feedback[c]);
                        if (guessData.word[c]) rowTiles[c].classList.add('filled');
                    }
                }
            }
            updateKeyboardColors(guessData.word, guessData.feedback);
        });
        currentRow = savedGameState.currentRow;
        currentCol = 0;
        gameOver = savedGameState.won || savedGameState.lost;
        gameWon = savedGameState.won;

        if (gameOver) {
            showEndGameModal(gameWon, savedGameState.guesses);
        }
        restoreSuccess = true;
    }

    if (!restoreSuccess) {
        console.log(`Yeni ${currentWordLength} harfli oyun başlatılıyor.`);
        targetWord = selectWordOfTheDay(null);
        if (!targetWord) {
             console.error("Oyun başlatılamadı: Hedef kelime seçilemedi.");
             if (wordLengthDisplay) wordLengthDisplay.textContent = "Hata!";
             if (totalWordsDisplay) totalWordsDisplay.textContent = `Sözlük: ${dictionary.length} | Hata!`;
             if (initialSetupScreen) initialSetupScreen.style.display = 'flex';
             if (gameArea) gameArea.style.display = 'none';
             return;
        }
        console.log("Günün Kelimesi:", targetWord, "(Uzunluk:", currentWordLength, ")");
        createGrid(); createKeyboard();
        document.querySelectorAll('.key').forEach(key => {
            key.classList.remove('absent', 'present', 'correct');
            delete key.dataset.status;
        });
    }

    if (initialSetupScreen) initialSetupScreen.style.display = 'none';
    if (gameArea) gameArea.style.display = 'flex';
    console.log("Oyun arayüzü kuruldu ve gösteriliyor.");
}

function closeEndGameModalAndGoToSelection() {
    if (endGameModal) endGameModal.style.display = "none";
    if (initialSetupScreen) initialSetupScreen.style.display = 'flex';
    if (gameArea) gameArea.style.display = 'none';
    selectedGameLength = 0;
    document.querySelectorAll('.length-options button.selected').forEach(btn => btn.classList.remove('selected'));
    if (startSelectedLengthGameBtn) startSelectedLengthGameBtn.disabled = true;

    if (totalWordsDisplay) {
        if (dictionary.length > 0) {
            totalWordsDisplay.textContent = `Sözlükte ${dictionary.length} kelime var. Uzunluk seçin.`;
        } else {
            totalWordsDisplay.textContent = "Sözlük yükleniyor veya yüklenemedi.";
        }
    }
    if (wordLengthDisplay) wordLengthDisplay.textContent = "X Harfli Kelime";
    console.log("Uzunluk seçme ekranına dönüldü.");
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded olayı tetiklendi.");

    initialSetupScreen = document.getElementById('initial-setup-screen');
    lengthOptionsContainer = document.querySelector('.length-options');
    startSelectedLengthGameBtn = document.getElementById('start-selected-length-game-btn');
    gameArea = document.getElementById('game-area');
    gridContainer = document.querySelector(".grid-container");
    keyboardContainer = document.querySelector(".keyboard-container");
    messagePopup = document.getElementById("message-popup");
    endGameModal = document.getElementById("end-game-modal");
    modalTitle = document.getElementById("modal-title");
    modalMessage = document.getElementById("modal-message");
    modalCorrectWord = document.getElementById("modal-correct-word");
    modalNewGameBtn = document.getElementById("modal-new-game-btn");
    modalCloseBtn = document.getElementById("modal-close-btn");
    wordLengthDisplay = document.getElementById("word-length-display");
    totalWordsDisplay = document.getElementById("total-words-display");

    if (startSelectedLengthGameBtn) {
        startSelectedLengthGameBtn.disabled = true;
        startSelectedLengthGameBtn.addEventListener('click', () => {
            if (selectedGameLength > 0 && dictionary.length > 0) {
                console.log("'" + startSelectedLengthGameBtn.textContent + "' butonuna tıklandı. Oyun başlatılıyor...");
                initializeGame();
            } else if (dictionary.length === 0) {
                showMessage("Sözlük henüz yüklenmedi. Lütfen bekleyin.", 2500, true);
            } else {
                showMessage("Lütfen önce bir kelime uzunluğu seçin.", 2500, true);
            }
        });
    }

    if (modalNewGameBtn) {
        modalNewGameBtn.addEventListener('click', closeEndGameModalAndGoToSelection);
    }
    if (modalCloseBtn) {
         modalCloseBtn.addEventListener('click', () => {
            if(endGameModal) endGameModal.style.display = "none";
        });
    }

    if (!window.physicalKeyboardListenerAttached) {
        window.addEventListener("keydown", (e) => {
            if (initialSetupScreen && initialSetupScreen.style.display === "flex") return;
            if (endGameModal && endGameModal.style.display === "flex") return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            let pressedKey = e.key;
            if (pressedKey === "Enter") { handleKeyPress("ENTER"); }
            else if (pressedKey === "Backspace") { handleKeyPress("BACKSPACE"); }
            else if (pressedKey.length === 1 && /^[a-zA-ZçÇğĞıİöÖşŞüÜ]$/.test(pressedKey)) {
                handleKeyPress(turkishUpper(pressedKey));
            }
        });
        window.physicalKeyboardListenerAttached = true;
    }

    loadDictionary();
});