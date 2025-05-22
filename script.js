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

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBci1YLe6TGuv9NHFRf1ljBnLH-ULj8jWs",
  authDomain: "color-trado.firebaseapp.com",
  projectId: "color-trado",
  storageBucket: "color-trado.firebasestorage.app",
  messagingSenderId: "960118997572",
  appId: "1:960118997572:web:4d533860f2daa609b3b211"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Stripe integration
const stripe = Stripe('YOUR_STRIPE_PUBLIC_KEY');

// DOM elements
const authScreen = document.getElementById('auth-screen');
const gameScreen = document.getElementById('game-screen');
const googleSignInBtn = document.getElementById('googleSignIn');
const signOutBtn = document.getElementById('signOutBtn');
const userName = document.getElementById('user-name');
const userAvatar = document.getElementById('user-avatar');
const userBalance = document.getElementById('user-balance');
const addFundsBtn = document.getElementById('addFundsBtn');
const roundTimer = document.getElementById('round-timer');
const roundNumber = document.getElementById('round-number');
const currentColor = document.getElementById('current-color');
const betAmountInput = document.getElementById('bet-amount');
const placeBetBtn = document.getElementById('place-bet');
const historyGrid = document.getElementById('history-grid');
const paymentModal = document.getElementById('payment-modal');
const amountOptions = document.querySelectorAll('.amount-option');
const customAmountInput = document.getElementById('custom-amount');
const confirmPaymentBtn = document.getElementById('confirm-payment');
const cancelPaymentBtn = document.getElementById('cancel-payment');

// Game state
let currentUser = null;
let currentRound = null;
let roundInterval = null;
let timeLeft = 0;
let userBet = null;

// Initialize the game
function initGame() {
  setupEventListeners();
  setupAuthStateListener();
  setupRoundListener();
  setupHistoryListener();
}

// Set up event listeners
function setupEventListeners() {
  googleSignInBtn.addEventListener('click', signInWithGoogle);
  signOutBtn.addEventListener('click', handleSignOut);
  addFundsBtn.addEventListener('click', showPaymentModal);
  placeBetBtn.addEventListener('click', placeBet);
  amountOptions.forEach(option => {
    option.addEventListener('click', () => selectAmount(option.dataset.amount));
  });
  confirmPaymentBtn.addEventListener('click', processPayment);
  cancelPaymentBtn.addEventListener('click', hidePaymentModal);
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
    } else {
      currentUser = null;
      authScreen.classList.remove('hidden');
      gameScreen.classList.add('hidden');
      resetGameState();
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
  } else if (currentRound.status === 'ended') {
    currentColor.style.backgroundColor = currentRound.result.color;
    roundTimer.textContent = 'Round Ended';
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
async function loadUserData(userId) {
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
  
  const amount = parseFloat(betAmountInput.value);
  if (isNaN(amount) {
    alert('Please enter a valid bet amount');
    return;
  }
  
  const selectedColor = document.querySelector('.prediction-btn.active');
  if (!selectedColor) {
    alert('Please select a color to bet on');
    return;
  }
  
  const color = selectedColor.dataset.color;
  const multiplier = getMultiplierForColor(color);
  
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
        color,
        amount,
        multiplier,
        timestamp: serverTimestamp()
      });
    });
    
    userBet = { color, amount, multiplier };
    alert(`Bet placed: ₹${amount} on ${color}`);
  } catch (error) {
    console.error('Bet placement failed:', error);
    alert(`Bet failed: ${error}`);
  }
}

// Get multiplier for color
function getMultiplierForColor(color) {
  switch (color) {
    case 'red': return 2;
    case 'green': return 5;
    case 'blue': return 10;
    default: return 1;
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

// Select amount
function selectAmount(amount) {
  customAmountInput.value = amount;
}

// Process payment
async function processPayment() {
  const amount = parseFloat(customAmountInput.value);
  if (isNaN(amount) || amount < 10) {
    alert('Please enter a valid amount (minimum ₹10)');
    return;
  }
  
  try {
    // Create a payment intent on your server (you'll need a backend for this)
    // This is a placeholder - you'll need to implement your own payment processing
    const response = await fetch('YOUR_BACKEND_ENDPOINT/create-payment-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await currentUser.getIdToken()}`
      },
      body: JSON.stringify({
        amount: amount * 100, // in paise
        currency: 'INR',
        userId: currentUser.uid
      })
    });
    
    const { clientSecret } = await response.json();
    
    // Confirm payment with Stripe
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: window.location.href,
        receipt_email: currentUser.email,
      },
    });
    
    if (error) throw error;
    
    alert('Payment successful! Your balance will be updated shortly.');
    hidePaymentModal();
  } catch (error) {
    console.error('Payment failed:', error);
    alert(`Payment failed: ${error.message}`);
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
  userBet = null;
}

// Sign in with Google
async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
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
    } else {
      // Update last login time
      await updateDoc(userRef, {
        lastLogin: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Sign in failed:', error);
    alert(`Sign in failed: ${error.message}`);
  }
}

// Handle sign out
function handleSignOut() {
  signOut(auth);
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', initGame);
