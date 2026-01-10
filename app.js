// Global state variables
let allQuestions = [];
let examQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let flaggedQuestions = [];
let questionResults = [];
let timerInterval = null;
let timeRemaining = 0;
let startTime = 0;
let examSubmitted = false;

// DOM elements
let startExamBtn,
  prevBtn,
  nextBtn,
  submitBtn,
  flagBtn,
  reviewAnswersBtn,
  restartExamBtn;

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Cache DOM elements
  startExamBtn = document.getElementById("startExamBtn");
  prevBtn = document.getElementById("prevBtn");
  nextBtn = document.getElementById("nextBtn");
  submitBtn = document.getElementById("submitBtn");
  flagBtn = document.getElementById("flagBtn");
  reviewAnswersBtn = document.getElementById("reviewAnswersBtn");
  restartExamBtn = document.getElementById("restartExamBtn");

  // Add event listeners
  startExamBtn.addEventListener("click", startExam);
  prevBtn.addEventListener("click", previousQuestion);
  nextBtn.addEventListener("click", nextQuestion);
  submitBtn.addEventListener("click", submitExam);
  flagBtn.addEventListener("click", toggleFlag);
  reviewAnswersBtn.addEventListener("click", reviewAnswers);
  restartExamBtn.addEventListener("click", restartExam);
});

// Load questions from questions.json file
async function loadQuestionsFromFile() {
  try {
    const response = await fetch("questions.json");
    const data = await response.json();
    allQuestions = data.questions;
    return true;
  } catch (error) {
    alert("Error loading questions.json: " + error.message);
    return false;
  }
}

// Main exam start function
async function startExam() {
  // Load questions from file if not already loaded
  if (allQuestions.length === 0) {
    const loaded = await loadQuestionsFromFile();
    if (!loaded) return;
  }

  if (!allQuestions || allQuestions.length === 0) {
    alert("No questions found in JSON!");
    return;
  }

  // Get settings
  const questionCount = parseInt(
    document.getElementById("questionCount").value
  );
  const timeLimit = parseInt(document.getElementById("timeLimit").value);
  const difficulty = document.getElementById("difficulty").value;

  // Filter and select questions
  examQuestions = selectQuestions(allQuestions, questionCount, difficulty);

  if (examQuestions.length < questionCount) {
    alert(
      `Only ${examQuestions.length} questions available with selected criteria.`
    );
  }

  // Decrypt questions
  examQuestions = examQuestions.map((q) => {
    const decrypted = JSON.parse(atob(q.data));
    return {
      ...q,
      questionText: decrypted.question,
      options: shuffleArray(decrypted.options),
    };
  });

  // Initialize
  userAnswers = new Array(examQuestions.length).fill(null);
  flaggedQuestions = new Array(examQuestions.length).fill(false);
  questionResults = new Array(examQuestions.length).fill(null);
  currentQuestionIndex = 0;
  examSubmitted = false;
  startTime = Date.now();

  // Setup timer
  if (timeLimit > 0) {
    timeRemaining = timeLimit * 60;
    startTimer();
  }

  // Show exam screen
  document.getElementById("setupScreen").style.display = "none";
  document.getElementById("examScreen").classList.add("active");
  document.getElementById("timer").classList.remove("hidden");

  // Render
  renderQuestionNavigation();
  renderQuestion();
}

// Question selection logic
function selectQuestions(questions, count, difficulty) {
  let filtered = questions;

  if (difficulty !== "all") {
    if (difficulty === "mixed") {
      // Realistic mix: 30% easy, 50% medium, 20% hard
      const easy = questions.filter((q) => q.difficulty === "easy");
      const medium = questions.filter((q) => q.difficulty === "medium");
      const hard = questions.filter((q) => q.difficulty === "hard");

      const easyCount = Math.floor(count * 0.3);
      const hardCount = Math.floor(count * 0.2);
      const mediumCount = count - easyCount - hardCount;

      filtered = [
        ...shuffleArray(easy).slice(0, easyCount),
        ...shuffleArray(medium).slice(0, mediumCount),
        ...shuffleArray(hard).slice(0, hardCount),
      ];
    } else {
      filtered = questions.filter((q) => q.difficulty === difficulty);
    }
  }

  return shuffleArray(filtered).slice(0, count);
}

// Utility: Shuffle array
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Render current question
function renderQuestion() {
  const question = examQuestions[currentQuestionIndex];
  const inputType = question.multipleCorrect ? "checkbox" : "radio";
  const inputName = `question-${currentQuestionIndex}`;

  let html = `
    <div class="question-header">
      <div class="question-number">Question ${currentQuestionIndex + 1} of ${
    examQuestions.length
  }</div>
    </div>
    <div class="question-text">${question.questionText}</div>
    <div class="options-container">
  `;

  question.options.forEach((option, index) => {
    const optionId = `q${currentQuestionIndex}-opt${index}`;
    const isChecked = userAnswers[currentQuestionIndex]?.includes(index)
      ? "checked"
      : "";
    const resultClass = examSubmitted
      ? getOptionClass(currentQuestionIndex, index)
      : "";

    html += `
      <div class="option ${resultClass}">
        <input type="${inputType}"
               id="${optionId}"
               name="${inputName}"
               value="${index}"
               ${isChecked}
               ${examSubmitted ? "disabled" : ""}>
        <label for="${optionId}">${option.text}</label>
      </div>
    `;
  });

  html += "</div>";
  document.getElementById("questionCard").innerHTML = html;

  // Add event listeners to each option
  question.options.forEach((_, index) => {
    const optionDiv = document.querySelector(
      `#q${currentQuestionIndex}-opt${index}`
    ).parentElement;
    if (!examSubmitted) {
      optionDiv.addEventListener("click", () => selectOption(index));
    }

    const input = document.getElementById(
      `q${currentQuestionIndex}-opt${index}`
    );
    if (input && !examSubmitted) {
      input.addEventListener("change", () => saveAnswer(index));
    }
  });

  // Update buttons
  prevBtn.disabled = currentQuestionIndex === 0;
  nextBtn.classList.toggle(
    "hidden",
    currentQuestionIndex === examQuestions.length - 1 && !examSubmitted
  );
  submitBtn.classList.toggle(
    "hidden",
    currentQuestionIndex !== examQuestions.length - 1 || examSubmitted
  );

  // Update flag button
  if (examSubmitted) {
    flagBtn.style.display = "none";
  } else {
    flagBtn.style.display = "block";
    flagBtn.textContent = flaggedQuestions[currentQuestionIndex]
      ? "🚩 Flagged"
      : "🚩 Flag for Review";
    flagBtn.style.background = flaggedQuestions[currentQuestionIndex]
      ? "#f59e0b"
      : "#e2e8f0";
    flagBtn.style.color = flaggedQuestions[currentQuestionIndex]
      ? "white"
      : "#2d3748";
  }

  updateProgress();
}

// Toggle flag on current question
function toggleFlag() {
  flaggedQuestions[currentQuestionIndex] =
    !flaggedQuestions[currentQuestionIndex];
  renderQuestion();
  renderQuestionNavigation();
}

// Handle option selection
function selectOption(optionIndex) {
  if (examSubmitted) return;

  const question = examQuestions[currentQuestionIndex];
  const checkbox = document.getElementById(
    `q${currentQuestionIndex}-opt${optionIndex}`
  );

  if (question.multipleCorrect) {
    checkbox.checked = !checkbox.checked;
  } else {
    // Radio behavior - uncheck all others
    question.options.forEach((_, idx) => {
      const cb = document.getElementById(`q${currentQuestionIndex}-opt${idx}`);
      cb.checked = idx === optionIndex;
    });
  }

  saveAnswer(optionIndex);
}

// Save answer
function saveAnswer(optionIndex) {
  const question = examQuestions[currentQuestionIndex];

  if (question.multipleCorrect) {
    const checked = [];
    question.options.forEach((_, idx) => {
      const checkbox = document.getElementById(
        `q${currentQuestionIndex}-opt${idx}`
      );
      if (checkbox.checked) checked.push(idx);
    });
    userAnswers[currentQuestionIndex] = checked;
  } else {
    userAnswers[currentQuestionIndex] = [optionIndex];
  }

  updateProgress();
  renderQuestionNavigation();
}

// Get option class for results
function getOptionClass(questionIndex, optionIndex) {
  const question = examQuestions[questionIndex];
  const userAnswer = userAnswers[questionIndex] || [];
  const isUserSelected = userAnswer.includes(optionIndex);
  const isCorrect = question.options[optionIndex].correct;

  if (isUserSelected && isCorrect) return "correct";
  if (isUserSelected && !isCorrect) return "incorrect";
  if (!isUserSelected && isCorrect) return "missed";
  return "";
}

// Navigation functions
function nextQuestion() {
  if (currentQuestionIndex < examQuestions.length - 1) {
    currentQuestionIndex++;
    renderQuestion();
  }
}

function previousQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    renderQuestion();
  }
}

function jumpToQuestion(index) {
  currentQuestionIndex = index;
  renderQuestion();
}

// Render question navigation grid
function renderQuestionNavigation() {
  const grid = document.getElementById("questionGrid");
  grid.innerHTML = "";

  examQuestions.forEach((_, index) => {
    const btn = document.createElement("button");
    btn.className = "question-btn";
    btn.textContent = index + 1;
    btn.onclick = () => jumpToQuestion(index);

    // Current question
    if (index === currentQuestionIndex) {
      btn.classList.add("current");
    }
    // Show results if exam submitted
    else if (examSubmitted && questionResults[index] !== null) {
      if (questionResults[index]) {
        btn.classList.add("correct-answer");
      } else {
        btn.classList.add("wrong");
      }
    }
    // Flagged during exam
    else if (flaggedQuestions[index]) {
      btn.classList.add("flagged");
    }
    // Answered
    else if (userAnswers[index] && userAnswers[index].length > 0) {
      btn.classList.add("answered");
    }

    grid.appendChild(btn);
  });
}

// Update progress indicators
function updateProgress() {
  const answered = userAnswers.filter((a) => a && a.length > 0).length;
  const percentage = (currentQuestionIndex / examQuestions.length) * 100;

  document.getElementById("progressText").textContent = `${
    currentQuestionIndex + 1
  }/${examQuestions.length}`;
  document.getElementById("answeredCount").textContent = answered;
  document.getElementById("progressFill").style.width = percentage + "%";
}

// Timer functions
function startTimer() {
  const timerDisplay = document.getElementById("timeDisplay");
  const timerElement = document.getElementById("timer");

  timerInterval = setInterval(() => {
    timeRemaining--;

    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timerDisplay.textContent = `${minutes}:${seconds
      .toString()
      .padStart(2, "0")}`;

    if (timeRemaining === 600) {
      timerElement.classList.add("warning");
    }

    if (timeRemaining === 300) {
      timerElement.classList.remove("warning");
      timerElement.classList.add("critical");
    }

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      alert("Time is up! Submitting your exam...");
      submitExam();
    }
  }, 1000);
}

// Submit exam
function submitExam() {
  if (!examSubmitted) {
    const unanswered = userAnswers.filter((a) => !a || a.length === 0).length;

    if (unanswered > 0) {
      if (
        !confirm(`You have ${unanswered} unanswered questions. Submit anyway?`)
      ) {
        return;
      }
    }
  }

  examSubmitted = true;
  if (timerInterval) clearInterval(timerInterval);

  calculateResults();
}

// Calculate and display results
function calculateResults() {
  let correct = 0;

  examQuestions.forEach((question, index) => {
    const userAnswer = userAnswers[index] || [];
    const correctAnswers = question.options
      .map((opt, idx) => (opt.correct ? idx : -1))
      .filter((idx) => idx !== -1);

    // All-or-nothing scoring
    const isCorrect =
      userAnswer.length === correctAnswers.length &&
      userAnswer.every((idx) => correctAnswers.includes(idx));

    questionResults[index] = isCorrect;
    if (isCorrect) correct++;
  });

  const percentage = ((correct / examQuestions.length) * 100).toFixed(1);
  const passed = percentage >= 85;
  const timeSpent = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(timeSpent / 60);
  const seconds = timeSpent % 60;

  // Display results
  document.getElementById("finalScore").textContent = percentage + "%";
  document.getElementById("passStatus").textContent = passed
    ? "PASSED ✓"
    : "FAILED ✗";
  document.getElementById("passStatus").className =
    "results-status " + (passed ? "pass" : "fail");
  document.getElementById("correctCount").textContent = correct;
  document.getElementById("incorrectCount").textContent =
    examQuestions.length - correct;
  document.getElementById("timeSpent").textContent = `${minutes}:${seconds
    .toString()
    .padStart(2, "0")}`;

  // Update navigation to show results
  renderQuestionNavigation();

  // Show results screen
  document.getElementById("examScreen").classList.remove("active");
  document.getElementById("resultsScreen").classList.add("active");
}

// Review answers
function reviewAnswers() {
  document.getElementById("resultsScreen").classList.remove("active");
  document.getElementById("examScreen").classList.add("active");
  currentQuestionIndex = 0;
  renderQuestion();
}

// Restart exam
function restartExam() {
  location.reload();
}
