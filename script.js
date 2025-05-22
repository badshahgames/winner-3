// Import Firebase v10+ modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    onSnapshot,
    serverTimestamp,
    increment,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBci1YLe6TGuv9NHFRf1ljBnLH-ULj8jWs", // Replace with your actual API key
    authDomain: "color-trado.firebaseapp.com",
    projectId: "color-trado",
    storageBucket: "color-trado.firebasestorage.app",
    messagingSenderId: "960118997572",
    appId: "1:960118997572:web:4d533860f2daa609b3b211",
    measurementId: "G-F3QLVXY0NW"
};

// Initialize Firebase
let app;
let auth;
let db;
let provider;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    provider = new GoogleAuthProvider();
    console.log('Firebase initialized successfully.');
} catch (error) {
    console.error('Error initializing Firebase:', error);
}

// DOM elements
const authScreen = document.getElementById('auth-screen');
const gameScreen = document.getElementById('game-screen');
const googleSignInBtn = document.getElementById('googleSignIn');
const signOutBtn = document.getElementById('signOutBtn');
const userName = document.getElementById('user-name');
const userAvatar = document.getElementById('user-avatar');
const userBalance = document.getElementById('user-balance');
const addFundsBtn = document.getElementById('addFundsBtn');
const roundNumber = document.getElementById('round-number');
const roundTimer = document.getElementById('round-timer');
const currentColor = document.getElementById('current-color');
const betAmountInput = document.getElementById('bet-amount');
const placeBetBtn = document.getElementById('place-bet');
const historyGrid = document.getElementById('history-grid');
const paymentModal = document.getElementById('payment-modal');
const closeModalBtn = document.getElementById('close-modal');
const amountOptions = document.querySelectorAll('.amount-option');
const customAmountInput = document.getElementById('custom-amount');
const copyVpaBtn = document.getElementById('copy-vpa');
const confirmPaymentBtn = document.getElementById('confirm-payment');
const minusBtn = document.querySelector('.amount-btn.minus');
const plusBtn = document.querySelector('.amount-btn.plus');
const predictionBtns = document.querySelectorAll('.prediction-btn');

// Game state
let currentUser = null;
let currentRound = null;
let roundInterval = null;
let timeLeft = 0;
let selectedColor = null;
let selectedMultiplier = 1;

// Initialize the game
function initGame() {
    setupEventListeners();
    setupAuthStateListener();
    setupRoundListener();
    setupHistoryListener();
}

// Set up event listeners
function setupEventListeners() {
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', signInWithGoogle);
        console.log('Google Sign-in button event listener attached.');
    } else {
        console.error('Google Sign-in button element not found.');
    }

    if (signOutBtn) {
        signOutBtn.addEventListener('click', handleSignOut);
    }
    if (addFundsBtn) {
        addFundsBtn.addEventListener('click', showPaymentModal);
    }
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', hidePaymentModal);
    }
    if (placeBetBtn) {
        placeBetBtn.addEventListener('click', placeBet);
    }
    if (copyVpaBtn) {
        copyVpaBtn.addEventListener('click', copyVpa);
    }
    if (confirmPaymentBtn) {
        confirmPaymentBtn.addEventListener('click', confirmPayment);
    }

    amountOptions.forEach(option => {
        option.addEventListener('click', () => {
            customAmountInput.value = option.dataset.amount;
        });
    });

    if (minusBtn) {
        minusBtn.addEventListener('click', () => {
            const currentValue = parseInt(betAmountInput.value) || 10;
            if (currentValue > 10) {
                betAmountInput.value = currentValue - 10;
            }
        });
    }

    if (plusBtn) {
        plusBtn.addEventListener('click', () => {
            const currentValue = parseInt(betAmountInput.value) || 10;
            betAmountInput.value = currentValue + 10;
        });
    }

    predictionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            predictionBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedColor = btn.dataset.color;
            selectedMultiplier = parseInt(btn.dataset.multiplier);
        });
    });
}

// Set up auth state listener
function setupAuthStateListener() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            authScreen.classList.add('hidden');
            gameScreen.classList.remove('hidden');
            updateUserInfo(user);
            loadUserData(user.uid);
            console.log('User is signed in:', user);
        } else {
            currentUser = null;
            authScreen.classList.remove('hidden');
            gameScreen.classList.add('hidden');
            resetGameState();
            console.log('User is signed out.');
        }
    });
}

// Set up round listener
function setupRoundListener() {
    const roundRef = doc(db, 'game', 'currentRound');

    onSnapshot(roundRef, (doc) => {
        if (doc.exists()) {
            currentRound = doc.data();
            updateRoundDisplay();

            // Clear any existing interval
            if (roundInterval) clearInterval(roundInterval);

            // Start countdown if round is active
            if (currentRound.status === 'running') {
                startRoundCountdown();
            }
        }
    });
}

// Set up history listener
function setupHistoryListener() {
    const historyRef = collection(db, 'history');
    const q = query(historyRef, where('timestamp', '>', new Date(Date.now() - 86400000))); // Last 24 hours

    onSnapshot(q, (snapshot) => {
        historyGrid.innerHTML = '';
        snapshot.docs.forEach(doc => {
            const result = doc.data();
            addHistoryItem(result);
        });
    });
}

// Update round display
function updateRoundDisplay() {
    roundNumber.textContent = currentRound.roundNumber;

    if (currentRound.status === 'running') {
        currentColor.style.backgroundColor = 'transparent';
        timeLeft = Math.floor((currentRound.endTime.toDate() - Date.now()) / 1000);
        updateTimerDisplay();
        if (placeBetBtn) placeBetBtn.disabled = false;
    } else if (currentRound.status === 'ended') {
        currentColor.style.backgroundColor = currentRound.result.color;
        roundTimer.textContent = 'Round Ended';
        if (placeBetBtn) placeBetBtn.disabled = true;
    }
}

// Start round countdown
function startRoundCountdown() {
    updateTimerDisplay();

    roundInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            clearInterval(roundInterval);
            roundTimer.textContent = 'Calculating...';
        }
    }, 1000);
}

// Update timer display
function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    roundTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Update user info
function updateUserInfo(user) {
    userName.textContent = user.displayName || 'Player';
    if (user.photoURL) {
        userAvatar.src = user.photoURL;
    }
}

// Load user data
function loadUserData(userId) {
    const userRef = doc(db, 'users', userId);

    onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
            const userData = doc.data();
            userBalance.textContent = userData.balance.toFixed(2);
        }
    });
}

// Place bet
async function placeBet() {
    if (!currentUser || !currentRound || currentRound.status !== 'running') return;

    const amount = parseInt(betAmountInput.value);
    if (isNaN(amount)) {
        alert('Please enter a valid bet amount');
        return;
    }

    if (!selectedColor) {
        alert('Please select a color to bet on');
        return;
    }

    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const betRef = doc(db, 'bets', `${currentUser.uid}_${currentRound.roundNumber}`);

        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw 'User not found';

            const userData = userDoc.data();
            if (userData.balance < amount) throw 'Insufficient balance';

            // Deduct bet amount from balance
            transaction.update(userRef, {
                balance: increment(-amount)
            });

            // Record the bet
            transaction.set(betRef, {
                userId: currentUser.uid,
                roundNumber: currentRound.roundNumber,
                color: selectedColor,
                amount,
                multiplier: selectedMultiplier,
                timestamp: serverTimestamp()
            });
        });

        alert(`Bet placed: ₹${amount} on ${selectedColor}`);
    } catch (error) {
        console.error('Bet placement failed:', error);
        alert(`Bet failed: ${error}`);
    }
}

// Show payment modal
function showPaymentModal() {
    paymentModal.classList.remove('hidden');
}

// Hide payment modal
function hidePaymentModal() {
    paymentModal.classList.add('hidden');
}

// Copy UPI ID
function copyVpa() {
    navigator.clipboard.writeText('9825537505@fam')
        .then(() => {
            if (copyVpaBtn) {
                copyVpaBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyVpaBtn.textContent = 'Copy';
                }, 2000);
            }
        })
        .catch(err => {
            console.error('Failed to copy: ', err);
        });
}

// Confirm payment
async function confirmPayment() {
    const amount = parseInt(customAmountInput.value);
    if (isNaN(amount) || amount < 10) {
        alert('Please enter a valid amount (minimum ₹10)');
        return;
    }

    try {
        // In a real app, you would verify the payment with your backend
        // For this demo, we'll simulate a successful payment
        const userRef = doc(db, 'users', currentUser.uid);

        await updateDoc(userRef, {
            balance: increment(amount),
            lastDeposit: serverTimestamp()
        });

        alert(`₹${amount} has been added to your balance!`);
        hidePaymentModal();
    } catch (error) {
        console.error('Payment confirmation failed:', error);
        alert('Failed to confirm payment. Please try again.');
    }
}

// Add history item
function addHistoryItem(result) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.style.backgroundColor = result.color;
    item.textContent = result.color.charAt(0).toUpperCase();
    historyGrid.appendChild(item);
}

// Reset game state
function resetGameState() {
    if (roundInterval) clearInterval(roundInterval);
    currentRound = null;
    selectedColor = null;
}

// Sign in with Google
async function signInWithGoogle() {
    console.log('signInWithGoogle function called');
    if (!auth || !provider) {
        console.error('Firebase Auth or Google Provider not initialized.');
        alert('Authentication service is not available.');
        return;
    }
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        console.log('Sign-in successful:', user);

        // Check if user exists in Firestore
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            // Create new user document
            await setDoc(userRef, {
                name: user.displayName,
                email: user.email,
                balance: 0,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp()
            });
            console.log('New user created in Firestore.');
        } else {
            // Update last login time
            await updateDoc(userRef, {
                lastLogin: serverTimestamp()
            });
            console.log('Existing user logged in, last login updated.');
        }
    } catch (error) {
        console.error('Sign in failed:', error);
        alert(`Sign in failed: ${error.message}`);
    }
}

// Handle sign out
function handleSignOut() {
    signOut(auth);
    console.log('User signed out.');
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', initGame);
