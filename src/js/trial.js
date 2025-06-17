class TrialManager {
  constructor() {
    this.userGroup = null;
    this.currentTrial = 0;
    this.totalTrials = 0;
    this.trialData = [];
    this.keyHandler = null;
    this.trialTimer = null;
    this.fixationTimer = null;
    this.feedbackTimer = null;
    this.currentStimulus = null;
    this.stimulusStartTime = 0;
    this.stimulusEndTime = 0;

    // CRITICAL: Response limiting flags
    this.awaitingResponse = false;
    this.responseReceived = false; // NEW: Prevents multiple responses per trial

    this.isPractice = true;
    this.feedbackEnabled = true;
    this.dataService = new DataService();

    // Trial configurations (unchanged)
    this.config = {
      practice: {
        1: { visual: 50, audio1: 0, audio2: 0 },
        2: { visual: 30, audio1: 10, audio2: 0 },
        3: { visual: 25, audio1: 12, audio2: 13 },
      },
      actual: {
        1: { visual: 500, audio1: 0, audio2: 0 },
        2: { visual: 375, audio1: 125, audio2: 0 },
        3: { visual: 250, audio1: 125, audio2: 125 },
      },
    };

    this.timing = {
      stimulusMin: 500,
      stimulusMax: 1000,
      fixationCross: 500,
      feedbackDuration: 1000,
      audioStimulus: 1000,
    };

    this.audioFiles = {
      sound1: new Audio("/sound1.mp3"),
      sound2: new Audio("/sound2.mp3"),
    };

    this.preloadAudio();
  }

  preloadAudio() {
    Object.values(this.audioFiles).forEach((audio) => {
      audio.preload = "auto";
      audio.load();
    });
  }

  init(group, isPractice = true, userUuid = null) {
    this.userGroup = group;
    this.isPractice = isPractice;
    this.feedbackEnabled = isPractice;
    this.currentTrial = 0;
    this.trialData = [];

    if (!isPractice && userUuid) {
      this.dataService.initSession(userUuid, group);
    }

    this.generateTrialSequence();
    this.setupKeyboardHandlers();
    this.showTrialInstructions();
  }

  generateTrialSequence() {
    const config = this.isPractice
      ? this.config.practice[this.userGroup]
      : this.config.actual[this.userGroup];
    const trials = [];

    console.log(`Generating trials for Group ${this.userGroup}:`, config);

    // Add visual trials
    for (let i = 0; i < config.visual; i++) {
      trials.push({
        type: "visual",
        stimulus: Math.floor(Math.random() * 9) + 1,
      });
    }

    // Add audio trials
    if (this.userGroup >= 2 && config.audio1 > 0) {
      for (let i = 0; i < config.audio1; i++) {
        trials.push({
          type: "audio1",
          stimulus: "sound1",
        });
      }
    }

    if (this.userGroup === 3 && config.audio2 > 0) {
      for (let i = 0; i < config.audio2; i++) {
        trials.push({
          type: "audio2",
          stimulus: "sound2",
        });
      }
    }

    this.trialData = this.shuffleArray(trials);
    this.totalTrials = this.trialData.length;

    console.log(`Generated ${this.totalTrials} total trials`);
  }

  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * FIXED: Setup keyboard handlers with proper response limiting
   */
  setupKeyboardHandlers() {
    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler);
    }

    this.keyHandler = (event) => {
      // CRITICAL: Only accept first response per trial
      if (!this.awaitingResponse || this.responseReceived) {
        return; // Ignore subsequent key presses
      }

      event.preventDefault();

      const response = this.getResponseType(event.key);
      if (response) {
        // IMMEDIATELY mark response as received to prevent duplicates
        this.responseReceived = true;
        this.handleResponse(response);
      }
    };

    document.addEventListener("keydown", this.keyHandler);
  }

  getResponseType(key) {
    switch (key) {
      case " ":
        return "spacebar";
      case "ArrowLeft":
        return "arrowleft";
      case "ArrowRight":
        return "arrowright";
      default:
        return null;
    }
  }

  showTrialInstructions() {
    const trialType = this.isPractice ? "Practice Trial" : "Actual Experiment";
    const estimatedTime = this.calculateEstimatedTime();

    document.getElementById("app").innerHTML = `
      <div class="app-content">
        <h1>${trialType}</h1>
        <div class="group-info">Group ${this.userGroup}</div>
        <div class="instruction-text">
          ${
            this.isPractice
              ? `You will now complete ${this.totalTrials} practice trials with feedback enabled.`
              : `You will now complete the actual experiment (${this.totalTrials} trials). This will take approximately ${estimatedTime} minutes.`
          }
          <br><br>
          Remember:<br>
          • Press SPACEBAR for all numbers except 3<br>
          • Do NOT press anything when you see 3
          ${this.userGroup > 1 ? "<br>• Press ← for first audio sound" : ""}
          ${this.userGroup === 3 ? "<br>• Press → for second audio sound" : ""}
        </div>
      </div>
      <div class="app-footer">
        <div class="navigation-hint">Press SPACEBAR to begin</div>
      </div>
    `;

    const startHandler = (event) => {
      if (event.key === " ") {
        event.preventDefault();
        document.removeEventListener("keydown", startHandler);
        this.startTrial();
      }
    };

    document.addEventListener("keydown", startHandler);
  }

  calculateEstimatedTime() {
    const avgStimulusTime =
      (this.timing.stimulusMin + this.timing.stimulusMax) / 2;
    const avgTrialTime = avgStimulusTime + this.timing.fixationCross;
    const totalTime = (this.totalTrials * avgTrialTime) / 1000 / 60;
    return Math.ceil(totalTime);
  }

  /**
   * Start trial with countdown for first trial only
   */
  startTrial() {
    if (this.currentTrial >= this.totalTrials) {
      this.endTrials();
      return;
    }

    if (this.currentTrial === 0) {
      this.showCountdown();
    } else {
      this.beginTrial();
    }
  }

  showCountdown() {
    let count = 3;
    const showCount = () => {
      if (count > 0) {
        document.getElementById("app").innerHTML = `
          <div class="app-content">
            <div class="countdown-display">
              <div class="countdown-number">${count}</div>
            </div>
            <div class="trial-progress">Starting in ${count}...</div>
          </div>
        `;
      } else {
        document.getElementById("app").innerHTML = `
          <div class="app-content">
            <div class="countdown-display">
              <div class="countdown-start">START!</div>
            </div>
            <div class="trial-progress">Let's begin!</div>
          </div>
        `;
      }

      count--;
      if (count >= -1) {
        setTimeout(showCount, 1000);
      } else {
        setTimeout(() => this.beginTrial(), 800);
      }
    };
    showCount();
  }

  /**
   * FIXED: Begin trial with proper response state reset
   */
  beginTrial() {
    const trial = this.trialData[this.currentTrial];
    this.currentStimulus = trial;

    // CRITICAL: Reset response flags for new trial
    this.awaitingResponse = true;
    this.responseReceived = false; // Allow one response for this trial

    this.stimulusStartTime = Date.now();

    this.showStimulus(trial);

    const stimulusDuration =
      Math.random() * (this.timing.stimulusMax - this.timing.stimulusMin) +
      this.timing.stimulusMin;

    this.trialTimer = setTimeout(() => {
      this.stimulusEndTime = Date.now();
      this.endStimulus();
    }, stimulusDuration);
  }

  showStimulus(trial) {
    if (trial.type === "visual") {
      document.getElementById("app").innerHTML = `
        <div class="app-content">
          <div class="stimulus-display">
            <div class="number-stimulus">${trial.stimulus}</div>
          </div>
          <div class="trial-progress">Trial ${this.currentTrial + 1} of ${
        this.totalTrials
      }</div>
        </div>
      `;
    } else {
      document.getElementById("app").innerHTML = `
        <div class="app-content">
          <div class="stimulus-display">
            <div class="audio-stimulus">♪</div>
          </div>
          <div class="trial-progress">Trial ${this.currentTrial + 1} of ${
        this.totalTrials
      }</div>
        </div>
      `;

      const audioFile =
        trial.stimulus === "sound1"
          ? this.audioFiles.sound1
          : this.audioFiles.sound2;
      audioFile.currentTime = 0;
      audioFile.play().catch((e) => console.error("Audio play failed:", e));
    }
  }

  /**
   * FIXED: End stimulus with timeout handling
   */
  endStimulus() {
    this.awaitingResponse = false;

    // If no response was received during stimulus, handle timeout
    if (!this.responseReceived) {
      this.handleResponse(null); // null = no response
    }
  }

  /**
   * FIXED: Handle response with proper state management
   */
  handleResponse(response) {
    if (!this.currentStimulus) return;

    // Ensure response is only processed once
    if (!this.responseReceived && response !== null) {
      this.responseReceived = true;
    }

    this.awaitingResponse = false;
    const trial = this.currentStimulus;
    const responseTime = response ? Date.now() - this.stimulusStartTime : null;

    if (!this.stimulusEndTime) {
      this.stimulusEndTime = Date.now();
    }

    if (this.trialTimer) {
      clearTimeout(this.trialTimer);
      this.trialTimer = null;
    }

    // Determine correctness for feedback only
    let isCorrect = false;
    if (trial.type === "visual") {
      if (trial.stimulus === 3) {
        isCorrect = response === null;
      } else {
        isCorrect = response === "spacebar";
      }
    } else {
      const expectedResponse =
        trial.type === "audio1" ? "arrowleft" : "arrowright";
      isCorrect = response === expectedResponse;
    }

    // Record trial for actual experiment
    if (!this.isPractice) {
      const trialResult = {
        trialNumber: this.currentTrial + 1,
        type: trial.type,
        stimulus: trial.stimulus,
        response: response,
        responseTime: responseTime,
        stimulusStartTime: this.stimulusStartTime,
        stimulusEndTime: this.stimulusEndTime,
        correct: isCorrect,
      };

      this.dataService.recordTrial(trialResult);
    }

    // Reduced logging
    if (trial.type !== "audio2") {
      console.log(`Trial ${this.currentTrial + 1}:`, {
        type: trial.type,
        stimulus: trial.stimulus,
        response: response,
        correct: isCorrect,
        rt: responseTime,
      });
    }

    if (this.feedbackEnabled) {
      this.showFeedback(isCorrect);
    } else {
      this.showFixationCross();
    }
  }

  showFeedback(isCorrect) {
    const trial = this.currentStimulus;
    const feedbackColor = isCorrect ? "#10b981" : "#ef4444";

    if (trial.type === "visual") {
      document.getElementById("app").innerHTML = `
        <div class="app-content">
          <div class="stimulus-display">
            <div class="number-stimulus" style="color: ${feedbackColor};">${
        trial.stimulus
      }</div>
          </div>
          <div class="trial-progress">Trial ${this.currentTrial + 1} of ${
        this.totalTrials
      }</div>
        </div>
      `;
    } else {
      document.getElementById("app").innerHTML = `
        <div class="app-content">
          <div class="stimulus-display">
            <div class="audio-stimulus" style="color: ${feedbackColor};">♪</div>
          </div>
          <div class="trial-progress">Trial ${this.currentTrial + 1} of ${
        this.totalTrials
      }</div>
        </div>
      `;
    }

    this.feedbackTimer = setTimeout(() => {
      this.showFixationCross();
    }, this.timing.feedbackDuration);
  }

  showFixationCross() {
    document.getElementById("app").innerHTML = `
      <div class="app-content">
        <div class="fixation-cross">+</div>
        <div class="trial-progress">Trial ${this.currentTrial + 1} of ${
      this.totalTrials
    }</div>
      </div>
    `;

    this.fixationTimer = setTimeout(() => {
      this.currentTrial++;
      this.currentStimulus = null;

      if (this.currentTrial < this.totalTrials) {
        this.beginTrial();
      } else {
        this.endTrials();
      }
    }, this.timing.fixationCross);
  }

  async endTrials() {
    this.cleanup();

    if (this.isPractice) {
      this.showActualExperimentPrompt();
    } else {
      await this.saveExperimentData();
    }
  }

  async saveExperimentData() {
    document.getElementById("app").innerHTML = `
      <div class="app-content">
        <h1>Saving Data...</h1>
        <div class="group-info">Group ${this.userGroup}</div>
        <div class="instruction-text">
          Please wait while we save your experiment data.
          <br><br>
          Do not close this window.
        </div>
      </div>
      <div class="app-footer">
        <div class="navigation-hint">Saving in progress...</div>
      </div>
    `;

    try {
      const success = await this.dataService.saveExperimentData();
      if (success) {
        this.showExperimentComplete();
      } else {
        this.showSaveError();
      }
    } catch (error) {
      console.error("Error saving experiment data:", error);
      this.showSaveError();
    }
  }

  showSaveError() {
    document.getElementById("app").innerHTML = `
      <div class="app-content">
        <h1>Save Error</h1>
        <div class="group-info">Group ${this.userGroup}</div>
        <div class="instruction-text">
          There was an error saving your data. Please contact the researcher immediately.
          <br><br>
          Your session ID: ${this.dataService.userUuid}
          <br>
          Trials completed: ${this.totalTrials}
        </div>
      </div>
      <div class="app-footer">
        <div class="navigation-hint">Please contact researcher</div>
      </div>
    `;
  }

  showActualExperimentPrompt() {
    const estimatedTime = this.calculateActualExperimentTime();

    document.getElementById("app").innerHTML = `
      <div class="app-content">
        <h1>Practice Complete!</h1>
        <div class="group-info">Group ${this.userGroup}</div>
        <div class="instruction-text">
          Great! You've completed the practice trials. 
          <br><br>
          The actual experiment will take approximately <strong>${estimatedTime} minutes</strong> and will not provide feedback.
          <br><br>
          Are you ready to begin the actual experiment?
        </div>
      </div>
      <div class="app-footer">
        <div class="navigation-hint">Press SPACEBAR to continue</div>
      </div>
    `;

    const confirmHandler = (event) => {
      if (event.key === " ") {
        event.preventDefault();
        document.removeEventListener("keydown", confirmHandler);
        this.showFinalConfirmation();
      }
    };

    document.addEventListener("keydown", confirmHandler);
  }

  showFinalConfirmation() {
    const estimatedTime = this.calculateActualExperimentTime();

    const overlay = document.createElement("div");
    overlay.className = "confirmation-overlay";
    overlay.innerHTML = `
      <div class="confirmation-dialog">
        <h3>Begin Actual Experiment?</h3>
        <p>The experiment will take approximately <strong>${estimatedTime} minutes</strong> to complete.</p>
        <div class="confirmation-buttons">
          <button class="btn btn-secondary" onclick="this.closest('.confirmation-overlay').remove();">Not Ready</button>
          <button class="btn btn-primary" onclick="window.trialManager.startActualExperiment(); this.closest('.confirmation-overlay').remove();">Start Experiment</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    window.trialManager = this;
  }

  calculateActualExperimentTime() {
    const config = this.config.actual[this.userGroup];
    const totalTrials = config.visual + config.audio1 + config.audio2;
    const avgStimulusTime =
      (this.timing.stimulusMin + this.timing.stimulusMax) / 2;
    const avgTrialTime = avgStimulusTime + this.timing.fixationCross;
    const totalTime = (totalTrials * avgTrialTime) / 1000 / 60;
    return Math.ceil(totalTime);
  }

  startActualExperiment() {
    const uuid = window.experimentApp
      ? window.experimentApp.userData?.unique_id
      : null;
    if (!uuid) {
      console.error("No UUID available for data collection");
    }

    this.init(this.userGroup, false, uuid);
  }

  showExperimentComplete() {
    document.getElementById("app").innerHTML = `
      <div class="app-content">
        <h1>Experiment Complete!</h1>
        <div class="group-info">Group ${this.userGroup}</div>
        <div class="instruction-text">
          Thank you for participating in this experiment. 
          <br><br>
          You have successfully completed all ${this.totalTrials} trials.
          <br><br>
          Please notify the researcher that you have finished.
        </div>
      </div>
      <div class="app-footer">
        <div class="navigation-hint">Experiment Complete</div>
      </div>
    `;

    this.createConfettiAnimation();
  }

  createConfettiAnimation() {
    const colors = [
      "#ff6b6b",
      "#4ecdc4",
      "#45b7d1",
      "#f9ca24",
      "#6c5ce7",
      "#a55eea",
    ];
    const confettiContainer = document.createElement("div");
    confettiContainer.id = "confetti-container";
    confettiContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
    `;

    document.body.appendChild(confettiContainer);

    for (let i = 0; i < 100; i++) {
      setTimeout(() => {
        this.createConfettiPiece(confettiContainer, colors);
      }, i * 50);
    }

    setTimeout(() => {
      if (confettiContainer.parentNode) {
        confettiContainer.parentNode.removeChild(confettiContainer);
      }
    }, 5000);
  }

  createConfettiPiece(container, colors) {
    const confetti = document.createElement("div");
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 10 + 5;
    const left = Math.random() * 100;
    const animationDuration = Math.random() * 3 + 2;
    const rotationSpeed = Math.random() * 360 + 180;

    confetti.style.cssText = `
      position: absolute;
      top: -10px;
      left: ${left}%;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${Math.random() > 0.5 ? "50%" : "0"};
      animation: confetti-fall ${animationDuration}s linear forwards;
      z-index: 1001;
    `;

    if (!document.getElementById("confetti-styles")) {
      const style = document.createElement("style");
      style.id = "confetti-styles";
      style.textContent = `
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(${rotationSpeed}deg);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    container.appendChild(confetti);

    setTimeout(() => {
      if (confetti.parentNode) {
        confetti.parentNode.removeChild(confetti);
      }
    }, animationDuration * 1000 + 100);
  }

  cleanup() {
    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }

    if (this.trialTimer) {
      clearTimeout(this.trialTimer);
      this.trialTimer = null;
    }

    if (this.fixationTimer) {
      clearTimeout(this.fixationTimer);
      this.fixationTimer = null;
    }

    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }

    this.awaitingResponse = false;
    this.responseReceived = false;
    this.currentStimulus = null;
    this.stimulusStartTime = 0;

    Object.values(this.audioFiles).forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });

    console.log("Trial cleanup completed");
  }
}
