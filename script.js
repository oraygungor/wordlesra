// script.js

const WORD_LIST_FILENAME = "sozluk.txt";
const CLASSIC_MAX_TRIES = 6;
const DYNAMIC_MAX_TRIES = 10; // Dinamik mod için daha fazla deneme hakkı
const VALID_GAME_LENGTHS = [4, 5, 6, 7, 8, 9]; // Klasik mod ve dinamik mod tahmin uzunlukları
const DYNAMIC_MODE_MIN_LENGTH = 4;
const DYNAMIC_MODE_MAX_LENGTH = 9;

let currentGameMode = null; // 'classic' veya 'dynamic'
let currentWordLength = 0; // Klasik modda seçilen, dinamik modda hedef kelimenin uzunluğu
let maxTries = CLASSIC_MAX_TRIES;

let dictionary = [];
let validWordsByLength = {}; // { 4: [...], 5: [...] } gibi kelimeleri uzunluklarına göre grupla
let targetWord = "";
let encodedTargetWord = "";
let currentRow = 0;
let currentTiles = []; // Dinamik modda aktif satırdaki tile'lar için
let gameHistory = []; // Dinamik modda tahmin geçmişi için { word: '...', feedback: [], length: X }

let gameOver = false;
let gameWon = false;
let isProcessing = false;
let selectedClassicLength = 0; // Sadece klasik mod için

// DOM Elementleri
let gameModeSelectionScreen, modeClassicBtn, modeDynamicBtn,
    initialSetupScreen, lengthOptionsContainer, startSelectedLengthGameBtn, gameArea,
    gridContainer, keyboardContainer, messagePopup, endGameModal, modalTitle,
    modalMessage, modalCorrectWord, modalNewGameBtn, modalCloseBtn,
    gameTitleDisplay, wordLengthDisplay, totalWordsDisplay;

const keyboardLayout = [
    "ERTYUIOPĞÜ",
    "ASDFGHJKLŞİ",
    ["ENTER", "ZCVBNMÖÇ", "BACKSPACE"]
];

// --- Yardımcı Fonksiyonlar ---
function turkishLower(s) { if (!s) return ""; return s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase(); }
function turkishUpper(s) { if (!s) return ""; return s.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase(); }
function getTodayDateString() { const today = new Date(); return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`; }

function encodeToBase64(str) {
    try { return btoa(unescape(encodeURIComponent(str))); }
    catch (e) { console.error("Base64 encode hatası:", e, "String:", str); return ""; }
}
function decodeFromBase64(encodedStr) {
    try { return decodeURIComponent(escape(atob(encodedStr))); }
    catch (e) { console.error("Base64 decode hatası:", e, "Encoded String:", encodedStr); return ""; }
}

// --- localStorage Fonksiyonları ---
function saveGameState(gameState) {
    try {
        const keyPrefix = `wordleGameState_${getTodayDateString()}`;
        let key;
        if (currentGameMode === 'classic') {
            key = `${keyPrefix}_classic_len${currentWordLength}`;
        } else if (currentGameMode === 'dynamic') {
            key = `${keyPrefix}_dynamic`; // Dinamik modda hedef kelime uzunluğu sabit değil gibi davranırız (ama aslında sabit)
        } else {
            return; // Bilinmeyen mod
        }
        localStorage.setItem(key, JSON.stringify(gameState));
        console.log("Oyun durumu kaydedildi:", key);
    } catch (e) { console.error("localStorage'a kaydetme hatası:", e); if (messagePopup) showMessage("Oyun durumu kaydedilemedi.", 3000, true); }
}

function loadGameState() {
    try {
        const keyPrefix = `wordleGameState_${getTodayDateString()}`;
        let key;
        if (currentGameMode === 'classic') {
            if (!selectedClassicLength) return null;
            key = `${keyPrefix}_classic_len${selectedClassicLength}`;
        } else if (currentGameMode === 'dynamic') {
            key = `${keyPrefix}_dynamic`;
        } else {
            return null;
        }
        const savedStateString = localStorage.getItem(key);
        console.log(`localStorage'dan (${key}) okunan:`, savedStateString);
        return savedStateString ? JSON.parse(savedStateString) : null;
    } catch (e) { console.error("localStorage'dan okuma/parse etme hatası:", e); return null; }
}
function clearOldGameStates() {
    const todayStr = getTodayDateString();
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("wordleGameState_") && !key.startsWith(`wordleGameState_${todayStr}`)) {
            localStorage.removeItem(key);
        }
    }
}

// --- Sözlük Yükleme ve Kurulum ---
async function loadDictionary() {
    if (totalWordsDisplay) totalWordsDisplay.textContent = `Sözlük (${WORD_LIST_FILENAME}) yükleniyor...`;
    // Mod seçimi butonlarını pasif yapabiliriz yükleme sırasında
    if (modeClassicBtn) modeClassicBtn.disabled = true;
    if (modeDynamicBtn) modeDynamicBtn.disabled = true;

    try {
        const response = await fetch(WORD_LIST_FILENAME);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const text = await response.text();
        const allWords = text.split(/\r?\n/)
            .map(word => turkishLower(word.trim()))
            .filter(word => {
                const len = word.length;
                const isValidChar = /^[a-zçğıöşü]+$/i.test(word.replace(/[İI]/gi, 'i'));
                return isValidChar && len >= DYNAMIC_MODE_MIN_LENGTH && len <= DYNAMIC_MODE_MAX_LENGTH;
            });

        if (allWords.length > 0) {
            dictionary = allWords; // Genel sözlük
            VALID_GAME_LENGTHS.forEach(len => {
                validWordsByLength[len] = dictionary.filter(word => word.length === len);
            });
            console.log("Sözlük yüklendi ve gruplandı:", dictionary.length, "kelime.");
            if (totalWordsDisplay) totalWordsDisplay.textContent = `Sözlükte ${dictionary.length} kelime var.`;
            if (modeClassicBtn) modeClassicBtn.disabled = false;
            if (modeDynamicBtn) modeDynamicBtn.disabled = false;
            populateClassicLengthOptions(); // Klasik mod seçeneklerini doldur
        } else {
            throw new Error("Sözlük boş veya geçerli kelime bulunamadı.");
        }
    } catch (error) {
        console.error("Sözlük yüklenirken KAPSAMLI HATA:", error);
        if (totalWordsDisplay) totalWordsDisplay.textContent = `Hata: ${WORD_LIST_FILENAME} yüklenemedi.`;
    }
}

function populateClassicLengthOptions() {
    if (!lengthOptionsContainer) return;
    lengthOptionsContainer.innerHTML = '';
    VALID_GAME_LENGTHS.forEach(len => {
        if (validWordsByLength[len] && validWordsByLength[len].length > 0) {
            const btn = document.createElement('button');
            btn.textContent = `${len} Harf`;
            btn.dataset.length = len;
            btn.addEventListener('click', () => selectClassicGameLength(len));
            lengthOptionsContainer.appendChild(btn);
        }
    });
}

function selectClassicGameLength(length) {
    selectedClassicLength = length;
    document.querySelectorAll('.length-options button').forEach(btn => {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.length) === length) {
            btn.classList.add('selected');
        }
    });
    if (startSelectedLengthGameBtn) {
        startSelectedLengthGameBtn.disabled = !(selectedClassicLength > 0);
    }
}

// --- Oyun Modu ve Hedef Kelime Seçimi ---
function selectGameMode(mode) {
    currentGameMode = mode;
    gameModeSelectionScreen.style.display = 'none';

    if (mode === 'classic') {
        initialSetupScreen.style.display = 'flex';
        gameTitleDisplay.textContent = "Klasik Wordle";
    } else if (mode === 'dynamic') {
        gameTitleDisplay.textContent = "4-9 Oyunu";
        // Dinamik mod için hedef kelime uzunluğunu rastgele seç
        const possibleLengths = VALID_GAME_LENGTHS.filter(l => validWordsByLength[l] && validWordsByLength[l].length > 0);
        if (possibleLengths.length === 0) {
            showMessage("Uygun uzunlukta kelime bulunamadı!", 3000, true);
            resetToModeSelection();
            return;
        }
        currentWordLength = possibleLengths[Math.floor(Math.random() * possibleLengths.length)];
        maxTries = DYNAMIC_MAX_TRIES;
        console.log("Dinamik Mod - Hedef Kelime Uzunluğu Seçildi:", currentWordLength);
        initializeGame(); // Doğrudan oyunu başlat
    }
}

function selectTargetWord() {
    let wordsOfTargetLength;
    if (currentGameMode === 'classic') {
        wordsOfTargetLength = validWordsByLength[currentWordLength];
    } else { // dynamic
        wordsOfTargetLength = validWordsByLength[currentWordLength]; // currentWordLength dinamik mod için rastgele seçildi
    }

    if (!wordsOfTargetLength || wordsOfTargetLength.length === 0) {
        console.error(`Hedef kelime seçilemedi: ${currentWordLength} uzunluğunda kelime yok.`);
        return "";
    }

    const now = new Date();
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    // Basitlik için, her oyun başladığında farklı bir kelime seçelim (özellikle dinamik modda)
    const index = (dayOfYear + now.getFullYear() + now.getHours() + now.getMinutes() + currentWordLength + Math.floor(Math.random() * 1000)) % wordsOfTargetLength.length;
    
    const newTargetWord = wordsOfTargetLength[index];

    if (newTargetWord) {
        targetWord = newTargetWord;
        encodedTargetWord = encodeToBase64(targetWord);
        if (!encodedTargetWord) {
            console.error("Hedef kelime seçildi ancak kodlanamadı:", targetWord);
            showMessage("Oyun kelimesi hazırlanırken bir hata oluştu.", 3000, true);
            return "";
        }
        // console.log(`Hedef Kelime: ${targetWord} (Kodlanmış: ${encodedTargetWord})`);
    } else {
        return "";
    }
    return targetWord;
}


// --- Grid ve Klavye Oluşturma ---
function createGrid() {
    if (!gridContainer) return;
    gridContainer.innerHTML = ""; // Önceki gridi temizle
    gameHistory = []; // Dinamik mod için geçmişi temizle

    if (currentGameMode === 'classic') {
        gridContainer.style.gridTemplateRows = `repeat(${maxTries}, auto)`;
        for (let r = 0; r < maxTries; r++) {
            const rowDiv = document.createElement("div");
            rowDiv.classList.add("grid-row");
            rowDiv.style.display = 'grid'; // Klasik modda grid kullan
            rowDiv.style.gridTemplateColumns = `repeat(${currentWordLength}, 1fr)`;
            for (let c = 0; c < currentWordLength; c++) {
                const tile = document.createElement("div");
                tile.classList.add("tile");
                tile.id = `tile-${r}-${c}`;
                rowDiv.appendChild(tile);
            }
            gridContainer.appendChild(rowDiv);
        }
    } else if (currentGameMode === 'dynamic') {
        // Dinamik modda satırlar tahmin yapıldıkça eklenecek.
        // Başlangıçta aktif bir giriş satırı oluştur.
        createNewDynamicRow();
    }
}

function createNewDynamicRow() {
    if (currentGameMode !== 'dynamic' || !gridContainer) return;

    const rowDiv = document.createElement("div");
    rowDiv.classList.add("grid-row", "dynamic-active-row");
    rowDiv.id = `dynamic-row-${currentRow}`;
    gridContainer.appendChild(rowDiv);
    currentTiles = []; // Aktif tile'ları sıfırla
    // Kullanıcı yazarken tile'lar eklenecek
}

function addTileToDynamicRow(letter) {
    if (currentGameMode !== 'dynamic' || currentTiles.length >= DYNAMIC_MODE_MAX_LENGTH) {
        return; // Maksimum uzunluğa ulaşıldı
    }

    const activeRow = document.getElementById(`dynamic-row-${currentRow}`);
    if (!activeRow) return;

    const tile = document.createElement("div");
    tile.classList.add("tile", "filled", "pop");
    tile.textContent = turkishUpper(letter);
    tile.addEventListener('animationend', () => tile.classList.remove('pop'), { once: true });
    
    activeRow.appendChild(tile);
    currentTiles.push(tile);
}

function removeTileFromDynamicRow() {
    if (currentGameMode !== 'dynamic' || currentTiles.length === 0) return;

    const activeRow = document.getElementById(`dynamic-row-${currentRow}`);
    if (!activeRow) return;

    const lastTile = currentTiles.pop();
    if (lastTile) {
        activeRow.removeChild(lastTile);
    }
}

function createKeyboard() {
    // Klavye oluşturma aynı kalabilir
    if (!keyboardContainer) return;
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
}


// --- Oyun Mantığı Fonksiyonları ---
function handleKeyPress(key) {
    if (initialSetupScreen.style.display !== "none" || gameModeSelectionScreen.style.display !== "none") return;
    if (endGameModal && getComputedStyle(endGameModal).display !== "none") return;
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
    if (currentGameMode === 'classic') {
        if (currentCol < currentWordLength) {
            const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
            if (tile) {
                tile.textContent = letter;
                tile.classList.add("filled", "pop");
                tile.addEventListener('animationend', () => tile.classList.remove('pop'), { once: true });
                currentCol++;
            }
        }
    } else if (currentGameMode === 'dynamic') {
        addTileToDynamicRow(letter);
    }
}

function deleteLetter() {
    if (currentGameMode === 'classic') {
        if (currentCol > 0) {
            currentCol--;
            const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
            if (tile) {
                tile.textContent = "";
                tile.classList.remove("filled");
            }
        }
    } else if (currentGameMode === 'dynamic') {
        removeTileFromDynamicRow();
    }
}

async function submitGuess() {
    let currentGuess = "";
    let guessLength = 0;

    if (currentGameMode === 'classic') {
        if (currentCol !== currentWordLength) {
            showMessage("Kelime yeterince uzun değil!", 2000, true);
            shakeCurrentRowClassic();
            return;
        }
        for (let i = 0; i < currentWordLength; i++) {
            currentGuess += turkishLower(document.getElementById(`tile-${currentRow}-${i}`).textContent);
        }
        guessLength = currentWordLength;
    } else if (currentGameMode === 'dynamic') {
        if (currentTiles.length < DYNAMIC_MODE_MIN_LENGTH) {
            showMessage(`En az ${DYNAMIC_MODE_MIN_LENGTH} harf girmelisiniz!`, 2000, true);
            shakeCurrentRowDynamic();
            return;
        }
        currentTiles.forEach(tile => currentGuess += turkishLower(tile.textContent));
        guessLength = currentTiles.length;
    }

    if (!targetWord || !encodedTargetWord) {
        showMessage("Hedef kelime yüklenemedi. Lütfen sayfayı yenileyin.", 3000, true);
        return;
    }

    isProcessing = true;

    // Tahmin edilen kelime sözlükte var mı? (uzunluğuna göre)
    const wordsForGuessLength = validWordsByLength[guessLength];
    if (!wordsForGuessLength || !wordsForGuessLength.includes(currentGuess)) {
        showMessage("Kelime sözlükte yok!", 2000, true);
        if (currentGameMode === 'classic') shakeCurrentRowClassic();
        else shakeCurrentRowDynamic();
        isProcessing = false;
        return;
    }

    const feedback = evaluateGuess(currentGuess, targetWord); // Her iki mod için de aynı evaluate
    
    if (currentGameMode === 'classic') {
        await applyFeedbackToGridClassic(currentRow, feedback, currentGuess);
    } else if (currentGameMode === 'dynamic') {
        await applyFeedbackToGridDynamic(feedback, currentGuess);
        gameHistory.push({ word: currentGuess, feedback: feedback, length: guessLength });
    }
    
    updateKeyboardColors(currentGuess, feedback); // Klavye renkleri her zaman güncellenir

    let gameJustWon = false;
    let gameJustLost = false;

    // Kazanma koşulu: Tahmin, hedef kelimeyle aynı olmalı (uzunluk dahil)
    if (currentGuess === targetWord) {
        gameWon = true;
        gameOver = true;
        gameJustWon = true;
    } else if (currentRow === maxTries - 1) { // Deneme hakkı bitti
        gameOver = true;
        gameJustLost = true;
    }

    const finalGuessesForModal = currentGameMode === 'classic' ? getClassicGuessesWithFeedback() : gameHistory;

    if (gameJustWon) {
        setTimeout(() => showEndGameModal(true, finalGuessesForModal), 50);
    } else if (gameJustLost) {
        setTimeout(() => showEndGameModal(false, finalGuessesForModal), 50);
    } else {
        // Oyun devam ediyor
        currentRow++;
        if (currentGameMode === 'classic') {
            currentCol = 0;
        } else if (currentGameMode === 'dynamic') {
            // Eski aktif satırın class'ını kaldır, yeni boş satır oluştur
            const oldActiveRow = document.getElementById(`dynamic-row-${currentRow -1}`);
            if (oldActiveRow) oldActiveRow.classList.remove("dynamic-active-row");
            createNewDynamicRow();
        }
    }

    // Oyun durumunu kaydet
    const gameStateToSave = {
        targetWord: targetWord, // Orijinal kelime
        // guesses: currentGameMode === 'classic' ? getClassicGuessesWithFeedback() : gameHistory,
        // currentRow: currentRow, // Bir sonraki satır için
        // won: gameWon,
        // lost: gameOver && !gameWon,
        // date: getTodayDateString(),
        // length: currentWordLength, // Klasik modda, dinamik modda hedef kelimenin uzunluğu
        // dynamicGameHistory: currentGameMode === 'dynamic' ? gameHistory : undefined
    };
    if (currentGameMode === 'classic') {
        gameStateToSave.guesses = getClassicGuessesWithFeedback();
        gameStateToSave.currentRow = currentRow;
        gameStateToSave.length = currentWordLength;
    } else {
        gameStateToSave.dynamicGameHistory = gameHistory;
        gameStateToSave.targetLength = currentWordLength; // Dinamik modda hedef kelimenin uzunluğunu kaydet
        // dinamik modda currentRow'u da kaydedebiliriz ama her satır yeniden oluşuyor.
        // Belki sadece deneme sayısını (gameHistory.length) kaydetmek yeterli.
        gameStateToSave.attempts = gameHistory.length;
    }
    gameStateToSave.won = gameWon;
    gameStateToSave.lost = gameOver && !gameWon;
    gameStateToSave.date = getTodayDateString();

    saveGameState(gameStateToSave);
    isProcessing = false;
}


function shakeCurrentRowClassic() {
    if (!gridContainer || !gridContainer.children[currentRow]) return;
    const rowDiv = gridContainer.children[currentRow];
    rowDiv.classList.add('shake');
    rowDiv.addEventListener('animationend', () => rowDiv.classList.remove('shake'), { once: true });
}
function shakeCurrentRowDynamic() {
    const activeRow = document.getElementById(`dynamic-row-${currentRow}`);
    if (activeRow) {
        activeRow.classList.add('shake');
        activeRow.addEventListener('animationend', () => activeRow.classList.remove('shake'), { once: true });
    }
}

// evaluateGuess hedef kelime ve tahmin arasında çalışır, moddan bağımsız olabilir
function evaluateGuess(guess, target) {
    const guessLen = guess.length;
    const targetLen = target.length;
    const feedback = Array(guessLen).fill('absent'); // Tahmin uzunluğunda geri bildirim
    const targetChars = target.split('');
    const guessChars = guess.split('');
    const targetCharCounts = {};

    for (const char of targetChars) {
        targetCharCounts[char] = (targetCharCounts[char] || 0) + 1;
    }

    // 1. Doğru yerdeki harfler (correct) - Sadece hedef kelimenin sınırları içinde
    for (let i = 0; i < Math.min(guessLen, targetLen); i++) {
        if (guessChars[i] === targetChars[i]) {
            feedback[i] = 'correct';
            if (targetCharCounts[guessChars[i]] > 0) { // Sadece hedefte varsa sayacı azalt
                 targetCharCounts[guessChars[i]]--;
            }
        }
    }

    // 2. Yanlış yerdeki harfler (present)
    for (let i = 0; i < guessLen; i++) {
        if (feedback[i] === 'absent') { // Henüz correct değilse
            // Harf hedef kelimede var mı VE bu harf için hedefte hala kontenjan var mı?
            if (targetChars.includes(guessChars[i]) && targetCharCounts[guessChars[i]] > 0) {
                 // Eğer bu pozisyon hedef kelimenin dışında kalıyorsa, yine de 'present' olabilir.
                feedback[i] = 'present';
                targetCharCounts[guessChars[i]]--;
            }
            // else: feedback[i] 'absent' olarak kalır.
        }
    }
    return feedback;
}


async function applyFeedbackToGridClassic(rowIdx, feedback, guessWord) {
    if (!gridContainer || !gridContainer.children[rowIdx]) return;
    const rowTiles = gridContainer.children[rowIdx].children;
    // ... (Klasik mod için animasyonlu karo güncelleme - önceki kodla aynı)
    const baseFlipDuration = 500;
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
                // tile.textContent = turkishUpper(guessWord[i]); // Zaten dolu olmalı
                setTimeout(() => {
                    // tile.classList.remove('filled'); // filled kalmalı, sadece renk değişir
                    tile.classList.add(feedback[i]);
                }, baseFlipDuration / 2);
                setTimeout(resolve, baseFlipDuration);
            }, delayBetweenTiles * i);
        });
        animationPromises.push(promise);
    }
    await Promise.all(animationPromises);
}

async function applyFeedbackToGridDynamic(feedback, guessWord) {
    // Aktif satırdaki tile'ları güncelle (bunlar zaten currentTiles içinde)
    const activeRow = document.getElementById(`dynamic-row-${currentRow}`);
    if (!activeRow) return;

    const tilesToAnimate = Array.from(activeRow.children); // O anki DOM'daki tile'lar

    const baseFlipDuration = 500;
    let delayBetweenTiles = 100;
    if (guessWord.length >= 7) delayBetweenTiles = 75;
    if (guessWord.length >= 9) delayBetweenTiles = 50;

    const animationPromises = [];

    for (let i = 0; i < tilesToAnimate.length; i++) {
        const tile = tilesToAnimate[i];
        if (!tile) continue;

        const promise = new Promise(resolve => {
            setTimeout(() => {
                tile.classList.add('flip-reveal');
                // tile.textContent zaten dolu
                setTimeout(() => {
                    // tile.classList.remove('filled'); // filled kalmalı
                    tile.classList.add(feedback[i] || 'absent'); // feedback[i] yoksa (tahmin hedeften uzunsa) absent
                }, baseFlipDuration / 2);

                setTimeout(resolve, baseFlipDuration);
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
            // 'correct' her zaman diğerlerini ezer
            if (status === 'correct') {
                keyButton.className = 'key'; // Önceki class'ları temizle (large hariç)
                if (keyButton.textContent === 'ENTER' || keyButton.textContent === '⌫') keyButton.classList.add('large');
                keyButton.classList.add('correct');
                keyButton.dataset.status = 'correct';
            } else if (status === 'present' && currentStatus !== 'correct') {
                keyButton.className = 'key';
                if (keyButton.textContent === 'ENTER' || keyButton.textContent === '⌫') keyButton.classList.add('large');
                keyButton.classList.add('present');
                keyButton.dataset.status = 'present';
            } else if (status === 'absent' && !currentStatus) { // Sadece daha iyi bir status yoksa absent yap
                keyButton.className = 'key';
                if (keyButton.textContent === 'ENTER' || keyButton.textContent === '⌫') keyButton.classList.add('large');
                keyButton.classList.add('absent');
                keyButton.dataset.status = 'absent';
            }
        }
    }
}


function getClassicGuessesWithFeedback() {
    const guesses = [];
    if (!gridContainer || currentGameMode !== 'classic') return guesses;

    const limit = gameOver ? currentRow + 1 : currentRow;
    for (let r = 0; r < limit; r++) {
        if (!gridContainer.children[r]) continue;
        const rowTiles = gridContainer.children[r].children;
        let word = "";
        const feedbackArr = [];
        let rowComplete = true;
        for (let c = 0; c < currentWordLength; c++) {
            const tile = rowTiles[c];
            if (tile && tile.textContent) {
                word += turkishLower(tile.textContent);
                let statusFound = false;
                if (tile.classList.contains('correct')) {feedbackArr.push('correct'); statusFound = true;}
                else if (tile.classList.contains('present')) {feedbackArr.push('present'); statusFound = true;}
                else if (tile.classList.contains('absent')) {feedbackArr.push('absent'); statusFound = true;}
                if(!statusFound && tile.classList.contains('filled')) { // Henüz değerlendirilmemiş ama dolu
                    // Bu durum olmamalı, submit sonrası değerlendirilir.
                }
            } else { rowComplete = false; break; }
        }
        if (rowComplete && word.length === currentWordLength && feedbackArr.length === currentWordLength) {
            guesses.push({ word, feedback: feedbackArr });
        }
    }
    return guesses;
}


function showMessage(message, duration = 2000, isError = false) {
    if (!messagePopup) return;
    messagePopup.textContent = message;
    messagePopup.classList.add("show");
    setTimeout(() => messagePopup.classList.remove("show"), duration);
}

function showEndGameModal(won, guessesData) {
    if (!endGameModal || !modalTitle || !modalMessage || !modalCorrectWord) return;

    const attempts = guessesData.length;

    if (won) {
        modalTitle.textContent = "Tebrikler!";
        modalMessage.textContent = `Kelimeyi ${attempts} denemede buldunuz.`;
    } else {
        modalTitle.textContent = "Oyun Bitti!";
        modalMessage.textContent = (currentGameMode === 'dynamic' && attempts >= maxTries) ?
            `Deneme hakkınız bitti.` :
            "Bu sefer olmadı. Denemeye devam!";
    }
    modalCorrectWord.textContent = turkishUpper(targetWord);
    endGameModal.style.display = "flex";
}

// --- Oyun Başlatma ve Kurulum ---
async function initializeGame() {
    console.log(">>> initializeGame çağrıldı. Mod:", currentGameMode, "Klasik Uzunluk:", selectedClassicLength, "Dinamik Hedef Uzunluk:", (currentGameMode === 'dynamic' ? currentWordLength : 'N/A'));

    if (currentGameMode === 'classic') {
        if (!selectedClassicLength || !VALID_GAME_LENGTHS.includes(selectedClassicLength)) {
            console.error("initializeGame HATA (Klasik): Geçerli bir kelime uzunluğu seçilmedi.");
            showMessage("Lütfen geçerli bir kelime uzunluğu seçin.", 3000, true);
            resetToModeSelection(); return;
        }
        currentWordLength = selectedClassicLength; // Klasik modda seçilen uzunluk
        maxTries = CLASSIC_MAX_TRIES;
    } else if (currentGameMode === 'dynamic') {
        // currentWordLength ve maxTries zaten selectGameMode('dynamic') içinde ayarlandı.
        if (!currentWordLength) {
             console.error("initializeGame HATA (Dinamik): Hedef kelime uzunluğu ayarlanmamış.");
             resetToModeSelection(); return;
        }
    } else {
        console.error("initializeGame HATA: Geçerli bir oyun modu seçilmedi.");
        resetToModeSelection(); return;
    }

    gameOver = false; gameWon = false;
    currentRow = 0;
    isProcessing = false;
    targetWord = ""; encodedTargetWord = "";
    gameHistory = []; currentTiles = []; // Dinamik mod için sıfırla

    if (currentGameMode === 'classic') currentCol = 0;


    clearOldGameStates();

    if (dictionary.length === 0) {
        console.error("initializeGame HATA: Sözlük boş.");
        showMessage("Oyun başlatılamadı: Sözlük hatası.", 3000, true);
        resetToModeSelection(); return;
    }

    // Hedef kelimeyi seç
    if (!selectTargetWord()) { // Bu fonksiyon targetWord ve encodedTargetWord'ü ayarlar
        console.error("initializeGame HATA: Hedef kelime seçilemedi.");
        showMessage("Hedef kelime oluşturulamadı. Lütfen tekrar deneyin.", 3000, true);
        resetToModeSelection(); return;
    }

    // UI Güncellemeleri
      if (wordLengthDisplay) {
        if (currentGameMode === 'classic') {
            wordLengthDisplay.textContent = `${currentWordLength} Harfli Kelime`;
        } else { // dynamic
            wordLengthDisplay.textContent = "Hedef Uzunluğu Bilinmiyor"; // VEYA "4-9 Harf Arası" gibi genel bir ifade
            // Veya tamamen gizleyebiliriz: wordLengthDisplay.style.display = 'none'; (veya CSS ile)
        }
    }
    if (totalWordsDisplay) { // totalWordsDisplay'i de moddan bağımsız veya daha genel hale getirelim
        if (dictionary.length > 0) {
             totalWordsDisplay.textContent = `Sözlükte ${dictionary.length} kelime var.`;
        } else {
            totalWordsDisplay.textContent = "";
        }
    }



    createGrid(); // Moduna göre grid oluşturur
    createKeyboard(); // Klavye her zaman aynı
    // Klavyeyi temizle
    document.querySelectorAll('.key').forEach(key => {
        key.classList.remove('absent', 'present', 'correct');
        delete key.dataset.status;
    });


    // Kayıtlı oyunu yüklemeyi dene (MODA GÖRE)
    const savedGameState = loadGameState(); // Bu, currentGameMode ve selectedClassicLength'i kullanır
    let restoreSuccess = false;

    if (savedGameState && savedGameState.targetWord) {
        // Kayıtlı kelime, şu anki hedef kelimeyle (kodlanmış olarak) eşleşiyor mu?
        // Dinamik modda, targetWord her seferinde rastgele seçildiği için bu kontrol anlamsız olabilir.
        // Sadece klasik modda veya dinamik modda GÜNLÜK bir kelime varsa bu mantıklı.
        // Şimdilik, eğer bir kayıt varsa ve tarih/mod uyuyorsa devam etmeye çalışalım.
        // Özellikle dinamik modda targetWord'ü doğrudan yüklemek yerine,
        // sadece geçmişi (gameHistory) yükleyip, hedefi yeniden seçebiliriz.
        // Basitlik için, şimdilik targetWord'ü de yüklüyoruz.

        const loadedTarget = turkishLower(savedGameState.targetWord);
        const loadedEncodedTarget = encodeToBase64(loadedTarget);

        // Eğer yüklenen kelime şu anki hedef kelimeyle aynıysa (kodlanmış hallerini karşılaştır)
        // VEYA dinamik moddaysak ve kayıt varsa (ve hedef uzunluğu da eşleşiyorsa)
        let canRestore = false;
        if (currentGameMode === 'classic' && loadedEncodedTarget === encodedTargetWord) {
            canRestore = true;
        } else if (currentGameMode === 'dynamic' && savedGameState.targetLength === currentWordLength) {
            // Dinamik modda hedef her zaman farklı olabilir, ama geçmişi yükleyebiliriz
            // ve hedefi de kayıttan alabiliriz.
            targetWord = loadedTarget;
            encodedTargetWord = loadedEncodedTarget;
            canRestore = true;
        }


        if (canRestore) {
            console.log(`Kaydedilmiş ${currentGameMode} oyunu yükleniyor.`);
            targetWord = loadedTarget; // Yüklenen orijinal kelimeyi kullan
            encodedTargetWord = loadedEncodedTarget;

            if (currentGameMode === 'classic' && savedGameState.guesses && savedGameState.currentRow !== undefined) {
                savedGameState.guesses.forEach((guessData, r) => {
                    // ... klasik gridi doldur ...
                     if (gridContainer && gridContainer.children[r]) {
                        const rowTiles = gridContainer.children[r].children;
                        for (let c = 0; c < currentWordLength; c++) {
                            if (rowTiles[c] && guessData.word[c]) {
                                rowTiles[c].textContent = turkishUpper(guessData.word[c]);
                                rowTiles[c].classList.remove('filled'); // Önceki stilleri temizle
                                rowTiles[c].classList.add(guessData.feedback[c]);
                                if (guessData.word[c]) rowTiles[c].classList.add('filled');
                            }
                        }
                    }
                });
                savedGameState.guesses.forEach(g => updateKeyboardColors(g.word, g.feedback));
                currentRow = savedGameState.currentRow;
                currentCol = 0; // Her zaman satır başı
            } else if (currentGameMode === 'dynamic' && savedGameState.dynamicGameHistory && savedGameState.attempts !== undefined) {
                gameHistory = savedGameState.dynamicGameHistory;
                currentRow = savedGameState.attempts; // Kaç deneme yapılmışsa o satırdayız
                // Geçmiş tahminleri grid'e yeniden çiz
                gameHistory.forEach(histEntry => {
                    const pastRow = document.createElement("div");
                    pastRow.classList.add("grid-row");
                    histEntry.word.split('').forEach((char, idx) => {
                        const tile = document.createElement("div");
                        tile.classList.add("tile", "filled", histEntry.feedback[idx]);
                        tile.textContent = turkishUpper(char);
                        pastRow.appendChild(tile);
                    });
                    gridContainer.insertBefore(pastRow, document.getElementById(`dynamic-row-${currentRow}`)); // Aktif satırın öncesine ekle
                    updateKeyboardColors(histEntry.word, histEntry.feedback);
                });
                // Yeni aktif satır zaten createGrid -> createNewDynamicRow ile oluşturulmuş olmalı
                // veya burada oluşturulabilir.
                if (currentRow < maxTries && !(savedGameState.won || savedGameState.lost)) {
                     // createNewDynamicRow(); // Aktif satırı tekrar oluşturmaya gerek yok, zaten var
                }
            }

            gameWon = savedGameState.won || false;
            gameOver = gameWon || (savedGameState.lost || false);

            if (gameOver) {
                const modalGuesses = currentGameMode === 'classic' ? savedGameState.guesses : savedGameState.dynamicGameHistory;
                showEndGameModal(gameWon, modalGuesses || []);
            }
            restoreSuccess = true;
        }
    }


    if (initialSetupScreen) initialSetupScreen.style.display = 'none';
    if (gameArea) gameArea.style.display = 'flex';
    console.log(">>> initializeGame tamamlandı. Oyun arayüzü gösteriliyor.");
}


function resetToModeSelection() {
    gameModeSelectionScreen.style.display = 'flex';
    initialSetupScreen.style.display = 'none';
    gameArea.style.display = 'none';
    if (endGameModal) endGameModal.style.display = 'none';

    currentGameMode = null;
    selectedClassicLength = 0;
    currentWordLength = 0;
    // Diğer oyun state'lerini de sıfırlamak iyi olabilir
    targetWord = ""; encodedTargetWord = "";
    gameOver = false; gameWon = false;
    currentRow = 0; currentCol = 0;
    gameHistory = []; currentTiles = [];

    // Klasik mod uzunluk seçimindeki seçimi kaldır
    document.querySelectorAll('.length-options button.selected').forEach(btn => btn.classList.remove('selected'));
    if(startSelectedLengthGameBtn) startSelectedLengthGameBtn.disabled = true;

    // Başlıkları sıfırla
    if (gameTitleDisplay) gameTitleDisplay.textContent = "Oyun Başlığı";
    if (wordLengthDisplay) wordLengthDisplay.textContent = "X Harfli Kelime";
    if (totalWordsDisplay && dictionary.length > 0) totalWordsDisplay.textContent = `Sözlükte ${dictionary.length} kelime var.`;
    else if (totalWordsDisplay) totalWordsDisplay.textContent = `Sözlük Yükleniyor...`;

    console.log("resetToModeSelection çağrıldı.");
}


// --- Uygulamayı Başlat ---
document.addEventListener('DOMContentLoaded', () => {
    gameModeSelectionScreen = document.getElementById('game-mode-selection-screen');
    modeClassicBtn = document.getElementById('mode-classic-btn');
    modeDynamicBtn = document.getElementById('mode-dynamic-btn');
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
    gameTitleDisplay = document.getElementById("game-title-display");
    wordLengthDisplay = document.getElementById("word-length-display");
    totalWordsDisplay = document.getElementById("total-words-display");

    modeClassicBtn.addEventListener('click', () => selectGameMode('classic'));
    modeDynamicBtn.addEventListener('click', () => selectGameMode('dynamic'));

    startSelectedLengthGameBtn.addEventListener('click', () => {
        if (selectedClassicLength > 0) {
            initializeGame(); // Klasik mod için oyunu başlat
        } else {
            showMessage("Lütfen kelime uzunluğunu seçin.", 2000, true);
        }
    });

    modalNewGameBtn.addEventListener('click', resetToModeSelection);
    modalCloseBtn.addEventListener('click', () => {
        if(endGameModal) endGameModal.style.display = "none";
    });

    if (!window.physicalKeyboardListenerAttached) {
        window.addEventListener("keydown", (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            let pressedKey = e.key;
            // handleKeyPress içinde ekran kontrolleri var
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