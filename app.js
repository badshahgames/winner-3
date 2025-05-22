import { auth, signInWithGoogle, logout } from './firebase.js';

// Elements
const authScreen = document.getElementById('auth-screen');
const gameScreen = document.getElementById('game-screen');
const googleSigninBtn = document.getElementById('google-signin');
const logoutBtn = document.getElementById('logout');
const userNameEl = document.getElementById('user-name');
const userPicEl = document.getElementById('user-pic');
const addMoneyBtn = document.getElementById('add-money');
const paymentModal = document.getElementById('payment-modal');
const cancelPaymentBtn = document.getElementById('cancel-payment');
const proceedPaymentBtn = document.getElementById('proceed-payment');
const amountOptions = document.querySelectorAll('.amount-option');
const customAmountInput = document.getElementById('custom-amount');

let selectedAmount = 0;

// Auth
auth.onAuthStateChanged(user => {
  if (user) {
    authScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    userNameEl.textContent = user.displayName;
    userPicEl.src = user.photoURL;
  } else {
    authScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
  }
});

googleSigninBtn.addEventListener('click', signInWithGoogle);
logoutBtn.addEventListener('click', logout);

// Payment logic
addMoneyBtn.addEventListener('click', () => {
  paymentModal.classList.remove('hidden');
});

cancelPaymentBtn.addEventListener('click', () => {
  paymentModal.classList.add('hidden');
  selectedAmount = 0;
  customAmountInput.value = '';
});

amountOptions.forEach(btn => {
  btn.addEventListener('click', () => {
    selectedAmount = parseInt(btn.dataset.amount);
    customAmountInput.value = '';
  });
});

customAmountInput.addEventListener('input', () => {
  selectedAmount = parseInt(customAmountInput.value) || 0;
});

proceedPaymentBtn.addEventListener('click', () => {
  if (selectedAmount <= 0) {
    alert('Please enter a valid amount.');
    return;
  }

  const options = {
    key: "rzp_test_qN4UylKc0jD6t4", // Replace with your actual Razorpay key
    amount: selectedAmount * 100,
    currency: "INR",
    name: "Color Trado",
    description: "Wallet Top-up",
    image: "https://color-trado.firebaseapp.com/logo.png",
    handler: function (response) {
      alert("Payment successful: " + response.razorpay_payment_id);
      paymentModal.classList.add('hidden');
    },
    prefill: {
      name: auth.currentUser.displayName,
      email: auth.currentUser.email,
      contact: "9825537505" // Fixed contact as requested
    },
    theme: {
      color: "#6c5ce7"
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
});
