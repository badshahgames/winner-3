// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBci1YLe6TGuv9NHFRf1ljBnLH-ULj8jWs",
  authDomain: "color-trado.firebaseapp.com",
  projectId: "color-trado",
  storageBucket: "color-trado.firebasestorage.app",
  messagingSenderId: "960118997572",
  appId: "1:960118997572:web:4d533860f2daa609b3b211",
  measurementId: "G-F3QLVXY0NW"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

// DOM elements
const authScreen = document.getElementById('auth-screen');
const gameScreen = document.getElementById('game-screen');
const googleSignInBtn = document.getElementById('googleSignIn');
const signOutBtn = document.getElementById('signOutBtn');
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const userAvatar = document.getElementById('user-avatar');
const userBalance = document.getElementById('user-balance');
const addFundsBtn = document.getElementById('addFundsBtn');
const adminPanel = document.getElementById('admin-panel');
const marketplaceGrid = document.getElementById('marketplace-grid');
const userCollection = document.getElementById('user-collection');
const paymentModal = document.getElementById('payment-modal');
const amountInput = document.getElementById('amount-input');
const confirmPaymentBtn = document.getElementById('confirm-payment');
const cancelPaymentBtn = document.getElementById('cancel-payment');

// Admin UID (replace with your admin UID)
const ADMIN_UID = "your-admin-uid-here";

// Current user data
let currentUser = null;

// Initialize the game
function initGame() {
  // Set up event listeners
  googleSignInBtn.addEventListener('click', signInWithGoogle);
  signOutBtn.addEventListener('click', signOut);
  addFundsBtn.addEventListener('click', showPaymentModal);
  confirmPaymentBtn.addEventListener('click', processPayment);
  cancelPaymentBtn.addEventListener('click', hidePaymentModal);

  // Check auth state
  auth.onAuthStateChanged(user => {
    if (user) {
      // User is signed in
      currentUser = user;
      authScreen.classList.add('hidden');
      gameScreen.classList.remove('hidden');
      updateUserInfo(user);
      
      // Check if admin
      if (user.uid === ADMIN_UID) {
        adminPanel.classList.remove('hidden');
      }
      
      // Load game data
      loadGameData(user.uid);
    } else {
      // User is signed out
      currentUser = null;
      authScreen.classList.remove('hidden');
      gameScreen.classList.add('hidden');
    }
  });
}

// Sign in with Google
function signInWithGoogle() {
  auth.signInWithPopup(provider)
    .then((result) => {
      // Check if user exists in Firestore
      const user = result.user;
      const userRef = db.collection('users').doc(user.uid);
      
      userRef.get().then(doc => {
        if (!doc.exists) {
          // Create new user document
          userRef.set({
            name: user.displayName,
            email: user.email,
            balance: 100, // Starting balance
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            isAdmin: user.uid === ADMIN_UID
          });
        }
      });
    })
    .catch((error) => {
      console.error("Sign in error:", error);
      alert("Sign in failed: " + error.message);
    });
}

// Sign out
function signOut() {
  auth.signOut();
}

// Update user info in UI
function updateUserInfo(user) {
  userName.textContent = user.displayName || "User";
  userEmail.textContent = user.email;
  if (user.photoURL) {
    userAvatar.src = user.photoURL;
  }
}

// Load game data
function loadGameData(userId) {
  // Load user balance
  db.collection('users').doc(userId).onSnapshot(doc => {
    if (doc.exists) {
      const userData = doc.data();
      userBalance.textContent = userData.balance.toFixed(2);
    }
  });

  // Load marketplace colors
  db.collection('colors')
    .where('owner', '==', 'marketplace')
    .onSnapshot(snapshot => {
      marketplaceGrid.innerHTML = '';
      snapshot.forEach(doc => {
        const color = doc.data();
        createColorCard(color, doc.id, 'marketplace');
      });
    });

  // Load user's collection
  db.collection('colors')
    .where('owner', '==', userId)
    .onSnapshot(snapshot => {
      userCollection.innerHTML = '';
      snapshot.forEach(doc => {
        const color = doc.data();
        createColorCard(color, doc.id, 'collection');
      });
    });
}

// Create color card element
function createColorCard(color, colorId, type) {
  const card = document.createElement('div');
  card.className = 'color-card';
  card.style.backgroundColor = color.hex;
  
  const name = document.createElement('h3');
  name.textContent = color.name;
  
  const price = document.createElement('div');
  price.className = 'color-price';
  price.textContent = `₹${color.price.toFixed(2)}`;
  
  card.appendChild(name);
  card.appendChild(price);
  
  if (type === 'marketplace') {
    card.addEventListener('click', () => buyColor(colorId, color.price));
  }
  
  if (type === 'collection') {
    card.addEventListener('click', () => sellColor(colorId, color.price));
  }
  
  if (type === 'marketplace') {
    marketplaceGrid.appendChild(card);
  } else {
    userCollection.appendChild(card);
  }
}

// Buy color
function buyColor(colorId, price) {
  if (!currentUser) return;
  
  const userRef = db.collection('users').doc(currentUser.uid);
  const colorRef = db.collection('colors').doc(colorId);
  
  db.runTransaction(transaction => {
    return transaction.get(userRef).then(userDoc => {
      if (!userDoc.exists) throw "User document does not exist!";
      
      const userData = userDoc.data();
      if (userData.balance < price) {
        throw "Not enough balance to buy this color!";
      }
      
      // Update user balance
      transaction.update(userRef, {
        balance: firebase.firestore.FieldValue.increment(-price)
      });
      
      // Transfer color ownership
      transaction.update(colorRef, {
        owner: currentUser.uid
      });
    });
  }).then(() => {
    alert("Color purchased successfully!");
  }).catch(error => {
    console.error("Transaction failed:", error);
    alert("Purchase failed: " + error);
  });
}

// Sell color
function sellColor(colorId, price) {
  if (!currentUser) return;
  
  const userRef = db.collection('users').doc(currentUser.uid);
  const colorRef = db.collection('colors').doc(colorId);
  
  db.runTransaction(transaction => {
    return transaction.get(userRef).then(userDoc => {
      if (!userDoc.exists) throw "User document does not exist!";
      
      // Update user balance
      transaction.update(userRef, {
        balance: firebase.firestore.FieldValue.increment(price)
      });
      
      // Transfer color to marketplace
      transaction.update(colorRef, {
        owner: 'marketplace'
      });
    });
  }).then(() => {
    alert("Color sold successfully!");
  }).catch(error => {
    console.error("Transaction failed:", error);
    alert("Sale failed: " + error);
  });
}

// Payment functions
function showPaymentModal() {
  paymentModal.classList.remove('hidden');
}

function hidePaymentModal() {
  paymentModal.classList.add('hidden');
  amountInput.value = '';
}

function processPayment() {
  const amount = parseFloat(amountInput.value);
  
  if (isNaN(amount) {
    alert("Please enter a valid amount");
    return;
  }
  
  if (amount < 10) {
    alert("Minimum amount is ₹10");
    return;
  }
  
  // Create Razorpay options
  const options = {
    key: "YOUR_RAZORPAY_KEY",
    amount: amount * 100, // in paise
    currency: "INR",
    name: "Color Trading Game",
    description: "Add funds to wallet",
    image: "assets/default-avatar.png",
    prefill: {
      name: currentUser.displayName || "User",
      email: currentUser.email || "9825537505@fam",
      contact: "9825537505"
    },
    handler: function(response) {
      // Payment success
      addFundsToWallet(amount);
      hidePaymentModal();
    },
    theme: {
      color: "#6c5ce7"
    }
  };
  
  const rzp = new Razorpay(options);
  rzp.open();
}

function addFundsToWallet(amount) {
  if (!currentUser) return;
  
  const userRef = db.collection('users').doc(currentUser.uid);
  
  userRef.update({
    balance: firebase.firestore.FieldValue.increment(amount)
  }).then(() => {
    alert(`Successfully added ₹${amount.toFixed(2)} to your wallet!`);
  }).catch(error => {
    console.error("Error adding funds:", error);
    alert("Failed to add funds: " + error.message);
  });
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', initGame);
